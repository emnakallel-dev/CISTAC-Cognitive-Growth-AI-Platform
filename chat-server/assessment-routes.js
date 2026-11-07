import { Router } from 'express'
import { db } from './db/db.js'
import { tMaxMs, minPlausibleMs, detectRushing, buildResult, DIMS } from './assessment.js'

const router = Router()
const PER_DIM = Number(process.env.QUESTIONS_PER_DIM) || 8
const GRACE_MS = 1000
const getSession = (id, userId) =>
  db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(id, userId)
// Start a session: PER_DIM random questions per category, interleaved.
router.post('/sessions', (req, res) => {
  const userId = req.userId
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId)

  const lists = DIMS.map((d) =>
    db.prepare('SELECT id FROM questions WHERE dimension = ? ORDER BY RANDOM() LIMIT ?').all(d, PER_DIM).map((r) => r.id))
  const order = []
  for (let i = 0; i < PER_DIM; i++) for (const l of lists) if (l[i] != null) order.push(l[i])

  const info = db.prepare('INSERT INTO sessions (user_id, started_at, order_json) VALUES (?, ?, ?)')
    .run(userId, new Date().toISOString(), JSON.stringify(order))
  res.json({ sessionId: Number(info.lastInsertRowid), total: order.length })
})

router.get('/sessions/:id/next', (req, res) => {
  const s = getSession(req.params.id, req.userId)
  if (!s) return res.status(404).json({ error: 'not found' })
  const order = JSON.parse(s.order_json)
  if (s.cursor >= order.length) return res.json({ done: true })

  const qid = order[s.cursor]
  const q = db.prepare(
    'SELECT id, dimension, difficulty, prompt, image AS image_path, options_json FROM questions WHERE id = ?'
  ).get(qid)
  const tMax = tMaxMs(q)
  let r = db.prepare('SELECT served_at FROM responses WHERE session_id = ? AND question_id = ?').get(s.id, qid)
  if (!r) { // first serve starts the clock; reloading the page does NOT reset it
    r = { served_at: Date.now() }
    db.prepare('INSERT INTO responses (session_id, question_id, position, served_at, t_max_ms) VALUES (?,?,?,?,?)')
      .run(s.id, qid, s.cursor, r.served_at, tMax)
  }
  res.json({
    id: q.id, position: s.cursor + 1, total: order.length,
    prompt: q.prompt, image: q.image_path, options: JSON.parse(q.options_json),
    tMaxMs: tMax, remainingMs: Math.max(0, tMax - (Date.now() - r.served_at)),
  })
})

router.post('/sessions/:id/answer', (req, res) => {
  const { questionId, optionIndex } = req.body // optionIndex null = client timeout
  const s = getSession(req.params.id, req.userId)
  if (!s) return res.status(404).json({ error: 'not found' })
  const r = db.prepare('SELECT * FROM responses WHERE session_id = ? AND question_id = ? AND answered_at IS NULL').get(s.id, questionId)
  if (!r) return res.status(409).json({ error: 'not awaiting an answer' })

  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId)
  const options = JSON.parse(q.options_json)
  const now = Date.now()
  const tUser = now - r.served_at
  const timedOut = optionIndex == null || tUser > r.t_max_ms + GRACE_MS
  const correct = !timedOut && options[optionIndex] === q.correct_answer ? 1 : 0
  const rapid = !timedOut && tUser < minPlausibleMs(q, options) ? 1 : 0

  db.prepare(`UPDATE responses SET answered_at=?, t_user_ms=?, option_index=?, correct=?, timed_out=?, rapid=? WHERE id=?`)
    .run(now, tUser, optionIndex ?? null, correct, timedOut ? 1 : 0, rapid, r.id)
  const cursor = s.cursor + 1
  const total = JSON.parse(s.order_json).length
  db.prepare('UPDATE sessions SET cursor=?, status=? WHERE id=?').run(cursor, cursor >= total ? 'finished' : 'active', s.id)

  // anomaly check, max 2 interventions per session, at least 5 questions apart
  let coach = null
  const answered = db.prepare('SELECT * FROM responses WHERE session_id=? AND answered_at IS NOT NULL ORDER BY position').all(s.id)
  const hit = detectRushing(answered)
  if (hit) {
    db.prepare(`UPDATE responses SET suspect=1 WHERE id IN (${hit.ids.join(',')})`).run()
    if (s.coach_events < 2 && r.position - s.last_coach_pos >= 5 && cursor < total) {
      db.prepare('UPDATE sessions SET coach_events=coach_events+1, last_coach_pos=? WHERE id=?').run(r.position, s.id)
      coach = {
        type: 'rushing_check',
        message: "I noticed the last few answers came very quickly. Are you feeling distracted, or are you rushing? " +
          "No judgment — I just want your result to reflect what you can really do.",
        signals: { fast: hit.fast, wrong: hit.wrong, sameOption: hit.straight },
      }
    }
  }
  res.json({ done: cursor >= total, coach })
})

// Save the session result as one Brain Twin snapshot (once per session, only if reliable).
// Column "visual" holds logical reasoning (kept for compatibility with the existing schema).
const COLUMN = { logical: 'visual', numerical: 'numerical', spatial: 'spatial', verbal: 'verbal' }
const round1 = (x) => Math.round(x * 10) / 10

function saveSnapshot(session, rows, result) {
  if (!session || result.reliability === 'low' || result.globalScore == null) return
  if (db.prepare('SELECT 1 FROM profile_snapshots WHERE session_id = ?').get(session.id)) return

  const cat = result.adjusted.category
  const values = Object.values(cat).filter((v) => typeof v === 'number')
  const scale = values.length && values.every((v) => v <= 1) ? 100 : 1 // accept 0..1 or 0..100
  const cols = ['user_id', 'session_id', 'taken_at', 'scoring_version']
  const vals = [session.user_id, session.id, new Date().toISOString(), 'v2-time-weighted']

  for (const [dim, col] of Object.entries(COLUMN)) {
    const v = typeof cat[dim] === 'number' ? cat[dim] * scale : null
    const n = rows.filter((r) => r.dimension === dim && !r.suspect).length
    let low = null, high = null
    if (v != null && n > 0) { // approximate 95% range: narrows as n grows
      const p = Math.min(1, Math.max(0, v / 100))
      const margin = 1.96 * Math.sqrt((p * (1 - p)) / (n + 2)) * 100
      low = round1(Math.max(0, v - margin))
      high = round1(Math.min(100, v + margin))
    }
    cols.push(col, `${col}_low`, `${col}_high`, `${col}_n`)
    vals.push(v == null ? null : round1(v), low, high, n)
  }
  db.prepare(`INSERT INTO profile_snapshots (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...vals)
  db.prepare('UPDATE sessions SET finished_at = ? WHERE id = ?').run(new Date().toISOString(), session.id)
}

router.get('/sessions/:id/result', (req, res) => {
  const s = getSession(req.params.id, req.userId)
  if (!s) return res.status(404).json({ error: 'not found' })
  const rows = db.prepare(`SELECT r.*, q.dimension, q.points AS w FROM responses r
    JOIN questions q ON q.id = r.question_id
    WHERE r.session_id = ? AND r.answered_at IS NOT NULL`).all(s.id)
  const result = buildResult(rows)
  if (s.status === 'finished') saveSnapshot(s, rows, result)
  res.json(result)
})

router.get('/questions/stats', (_req, res) => {
  const rows = db.prepare('SELECT dimension, COUNT(*) AS total, SUM(image IS NOT NULL) AS with_image FROM questions GROUP BY dimension').all()
  res.json({ total: rows.reduce((s, r) => s + r.total, 0), byDimension: rows })
})


// Delete one test (its answers and its Brain Twin point).
router.delete('/sessions/:id', (req, res) => {
  const s = getSession(req.params.id, req.userId)
  if (!s) return res.status(404).json({ error: 'not found' })
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM profile_snapshots WHERE session_id = ?').run(s.id) // the schema would only set it to NULL
    db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id)                    // responses and task_results cascade
    db.exec('COMMIT')
  } catch (e) { db.exec('ROLLBACK'); throw e }
  res.json({ deleted: true, sessionId: s.id })
})

// Delete everything we keep about a user: tests, answers, profile history, coach messages.
router.delete('/me/data', (req, res) => {
  const userId = req.userId
  db.exec('BEGIN')
  try {
    for (const table of ['collaboration_scores', 'profile_snapshots', 'recommendations', 'coach_messages', 'goals', 'learning_plans', 'sessions']) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId)
    }
    db.exec('COMMIT')
  } catch (e) { db.exec('ROLLBACK'); throw e }
  res.json({ deleted: true })
})

export default router