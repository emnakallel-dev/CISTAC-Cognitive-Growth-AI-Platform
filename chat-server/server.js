import 'dotenv/config'
import express from 'express'
import { db } from './db/db.js'
import { DIMENSIONS, SCORING_VERSION, COLLAB_WEIGHTS, estimate, collabTotal } from './scoring.js'

const { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, AUTH_MODE = 'demo' } = process.env
const PORT = process.env.PORT || 8787

if (!LLM_BASE_URL || !LLM_MODEL) {
  console.error('Missing LLM_BASE_URL or LLM_MODEL in chat-server/.env')
  process.exit(1)
}

// ---------- Auth: demo user now, Clerk later ----------
let clerk = null
if (AUTH_MODE === 'clerk') clerk = await import('@clerk/express')

const app = express()
app.use(express.json({ limit: '50kb' }))
if (clerk) app.use(clerk.clerkMiddleware())

function requireUser(req, res, next) {
  let userId = 'demo-user' // demo mode
  if (clerk) {
    userId = clerk.getAuth(req).userId // verified token, never the request body
    if (!userId) return res.status(401).json({ error: 'Please sign in.' })
  }
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId)
  req.userId = userId
  next()
}

// ---------- Helpers ----------
const SYSTEM_PROMPT = `You are a friendly cognitive growth coach inside a learning app.
Rules:
- Use plain, warm language. Keep answers under 150 words unless asked for more.
- This is NOT a clinical tool. Never diagnose and never use medical or clinical terms.
- Describe skills as things that can grow with practice, not fixed traits.
- Explain WHY you give each suggestion, in one sentence, using the user's data when available.
- Be honest about uncertainty: mention the ranges, say "may" or "seems", never promise results.
- Never invent scores or history. Only use data given to you.
- If the user seems distressed or mentions a health concern, respond kindly and suggest talking to a trusted person or a professional.`

const FALLBACK =
  "I can't reach the AI service right now, so here is a general tip: pick one skill, practise it for a few minutes a day, and check your progress after a week."

const now = () => new Date().toISOString()
const norm = (s) => String(s ?? '').trim().toLowerCase()

function publicQuestion(r) {
  // correct_answer is deliberately never included
  return {
    id: r.id,
    dimension: r.dimension,
    difficulty: r.difficulty,
    prompt: r.prompt,
    options: JSON.parse(r.options_json),
  }
}

function ownsSession(sessionId, userId) {
  return db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?').get(sessionId, userId)
}

function buildContext(userId) {
  const s = db
    .prepare('SELECT * FROM profile_snapshots WHERE user_id = ? ORDER BY taken_at DESC, id DESC LIMIT 1')
    .get(userId)
  if (!s) return null
  const c = db
    .prepare('SELECT total FROM collaboration_scores WHERE user_id = ? ORDER BY taken_at DESC, id DESC LIMIT 1')
    .get(userId)
  const recs = db
    .prepare('SELECT text FROM recommendations WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 3')
    .all(userId)
  const lines = DIMENSIONS.map(
    (d) => `${d}: ${s[d]}% (likely ${s[`${d}_low`]}-${s[`${d}_high`]}%, from ${s[`${d}_n`]} tasks)`
  )
  return `Known data about this user (estimates, not facts):
${lines.join('\n')}
AI Collaboration Score: ${c ? c.total : 'not available'}/100.
Current recommendations: ${recs.map((r) => r.text).join(' | ') || 'none'}.
Use these numbers to explain your advice and always mention the uncertainty. Never invent other data.`
}

// ---------- Chat ----------
app.post('/api/chat', requireUser, async (req, res) => {
  const incoming = req.body?.messages
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' })
  }
  const messages = incoming
    .slice(-20)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
  if (messages.length === 0) return res.status(400).json({ error: 'No valid messages.' })

  const context = buildContext(req.userId)
  const fullMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(context ? [{ role: 'system', content: context }] : []),
    ...messages,
  ]

  try {
    const upstream = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(LLM_API_KEY ? { Authorization: `Bearer ${LLM_API_KEY}` } : {}),
      },
      body: JSON.stringify({ model: LLM_MODEL, messages: fullMessages, temperature: 0.7, max_tokens: 400 }),
    })
    if (!upstream.ok) {
      console.error('AI provider error', upstream.status, await upstream.text())
      return res.json({ reply: FALLBACK, fallback: true })
    }
    const data = await upstream.json()
    const reply = data.choices?.[0]?.message?.content
    if (!reply) return res.json({ reply: FALLBACK, fallback: true })

    const last = messages[messages.length - 1]
    const save = db.prepare(
      'INSERT INTO coach_messages (user_id, role, content, created_at) VALUES (?, ?, ?, ?)'
    )
    if (last?.role === 'user') save.run(req.userId, 'user', last.content, now())
    save.run(req.userId, 'assistant', reply, now())
    res.json({ reply })
  } catch (err) {
    console.error(err)
    res.json({ reply: FALLBACK, fallback: true })
  }
})

// ---------- Brain Twin / Progress ----------
app.get('/api/history', requireUser, (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT p.*, c.total AS collab_score
         FROM profile_snapshots p LEFT JOIN collaboration_scores c ON c.snapshot_id = p.id
         WHERE p.user_id = ? ORDER BY p.taken_at, p.id`
      )
      .all(req.userId)
  )
})

app.get('/api/collaboration', requireUser, (req, res) => {
  const c = db
    .prepare('SELECT * FROM collaboration_scores WHERE user_id = ? ORDER BY taken_at DESC, id DESC LIMIT 1')
    .get(req.userId)
  if (!c) return res.json(null)
  res.json({
    total: c.total,
    formula_version: c.formula_version,
    weights: COLLAB_WEIGHTS,
    components: {
      clarification: c.clarification,
      critical_verification: c.critical_verification,
      iteration: c.iteration,
      autonomy: c.autonomy,
      responsible_use: c.responsible_use,
    },
  })
})

// ---------- Recommendations ----------
app.get('/api/recommendations', requireUser, (req, res) => {
  res.json(
    db.prepare('SELECT * FROM recommendations WHERE user_id = ? ORDER BY created_at DESC, id DESC').all(req.userId)
  )
})

// ---------- Assessment ----------
// 1) start: create a session and pick questions at the user's current difficulty
app.post('/api/sessions', requireUser, (req, res) => {
  const sessionId = Number(
    db.prepare('INSERT INTO sessions (user_id, started_at) VALUES (?, ?)').run(req.userId, now()).lastInsertRowid
  )
  const questions = []
  for (const dim of DIMENSIONS) {
    const plan = db
      .prepare('SELECT current_difficulty FROM learning_plans WHERE user_id = ? AND dimension = ?')
      .get(req.userId, dim)
    const maxD = plan?.current_difficulty ?? 1
    // least-answered questions first, so the user rarely sees a repeat
    const rows = db
      .prepare(
        `SELECT q.id, q.dimension, q.difficulty, q.prompt, q.options_json
         FROM questions q
         WHERE q.dimension = ? AND q.difficulty <= ?
         ORDER BY (SELECT COUNT(*) FROM task_results t WHERE t.user_id = ? AND t.question_id = q.id), RANDOM()
         LIMIT 2`
      )
      .all(dim, maxD, req.userId)
    questions.push(...rows.map(publicQuestion))
  }
  res.json({ sessionId, questions })
})

// 2) answer: the server checks correctness
app.post('/api/sessions/:id/answers', requireUser, (req, res) => {
  const sessionId = Number(req.params.id)
  if (!ownsSession(sessionId, req.userId)) return res.status(404).json({ error: 'Session not found.' })
  const { questionId, answer, responseMs, retries } = req.body ?? {}
  const q = db.prepare('SELECT correct_answer FROM questions WHERE id = ?').get(Number(questionId))
  if (!q) return res.status(404).json({ error: 'Question not found.' })
  const correct = norm(answer) === norm(q.correct_answer) ? 1 : 0
  db.prepare(
    `INSERT INTO task_results (session_id, user_id, question_id, answer_given, is_correct, response_ms, retries)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(sessionId, req.userId, Number(questionId), String(answer ?? ''), correct, Number(responseMs) || null, Number(retries) || 0)
  res.json({ correct: !!correct })
})

// 3) finish: compute the new snapshot, adapt difficulty, create a recommendation
app.post('/api/sessions/:id/finish', requireUser, (req, res) => {
  const sessionId = Number(req.params.id)
  if (!ownsSession(sessionId, req.userId)) return res.status(404).json({ error: 'Session not found.' })
  const answered = db.prepare('SELECT COUNT(*) AS n FROM task_results WHERE session_id = ?').get(sessionId).n
  if (answered === 0) return res.status(400).json({ error: 'No answers in this session yet.' })

  const t = now()
  db.prepare('UPDATE sessions SET finished_at = ? WHERE id = ?').run(t, sessionId)

  const snapshot = {}
  const sessionStats = {}
  const stat = `SELECT COUNT(*) AS n, COALESCE(SUM(t.is_correct), 0) AS c
                FROM task_results t JOIN questions q ON q.id = t.question_id
                WHERE t.user_id = ? AND q.dimension = ?`
  for (const dim of DIMENSIONS) {
    const all = db.prepare(stat).get(req.userId, dim)
    snapshot[dim] = estimate(all.c, all.n)
    sessionStats[dim] = db.prepare(stat + ' AND t.session_id = ?').get(req.userId, dim, sessionId)
  }

  const cols = DIMENSIONS.flatMap((d) => [d, `${d}_low`, `${d}_high`, `${d}_n`])
  const vals = DIMENSIONS.flatMap((d) => [snapshot[d].value, snapshot[d].low, snapshot[d].high, snapshot[d].n])
  const snapId = Number(
    db
      .prepare(
        `INSERT INTO profile_snapshots (user_id, session_id, taken_at, scoring_version, ${cols.join(', ')})
         VALUES (${Array(cols.length + 4).fill('?').join(', ')})`
      )
      .run(req.userId, sessionId, t, SCORING_VERSION, ...vals).lastInsertRowid
  )

  // Collaboration score: no behaviour signals are measured yet, so carry the previous
  // components forward (or 50 if none). Replace with real signals when you define them.
  const prev = db
    .prepare('SELECT * FROM collaboration_scores WHERE user_id = ? ORDER BY taken_at DESC, id DESC LIMIT 1')
    .get(req.userId)
  const comp = {
    clarification: prev?.clarification ?? 50,
    critical_verification: prev?.critical_verification ?? 50,
    iteration: prev?.iteration ?? 50,
    autonomy: prev?.autonomy ?? 50,
    responsible_use: prev?.responsible_use ?? 50,
  }
  const total = collabTotal(comp)
  db.prepare(
    `INSERT INTO collaboration_scores
     (user_id, snapshot_id, taken_at, total, clarification, critical_verification, iteration, autonomy, responsible_use)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.userId, snapId, t, total, comp.clarification, comp.critical_verification, comp.iteration, comp.autonomy, comp.responsible_use)

  // Adaptive difficulty
  for (const dim of DIMENSIONS) {
    const { n, c } = sessionStats[dim]
    if (n < 1) continue
    const plan = db
      .prepare('SELECT current_difficulty FROM learning_plans WHERE user_id = ? AND dimension = ?')
      .get(req.userId, dim)
    const cur = plan?.current_difficulty ?? 1
    const acc = c / n
    const next = acc >= 0.8 ? Math.min(5, cur + 1) : acc <= 0.4 ? Math.max(1, cur - 1) : cur
    db.prepare(
      `INSERT INTO learning_plans (user_id, dimension, current_difficulty, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, dimension) DO UPDATE SET current_difficulty = excluded.current_difficulty, updated_at = excluded.updated_at`
    ).run(req.userId, dim, next, t)
  }

  // Rule-based, explainable recommendation: the lowest dimension
  const lowest = [...DIMENSIONS].sort((a, b) => snapshot[a].value - snapshot[b].value)[0]
  const s = snapshot[lowest]
  const recommendation = {
    dimension: lowest,
    text: `Practise a few ${lowest} tasks this week.`,
    rationale: `Your ${lowest} estimate is currently your lowest (about ${s.value}%, likely ${s.low}-${s.high}%, from ${s.n} tasks). More practice may help it grow and makes the estimate more reliable.`,
  }
  db.prepare(
    'INSERT INTO recommendations (user_id, created_at, dimension, text, rationale) VALUES (?, ?, ?, ?, ?)'
  ).run(req.userId, t, lowest, recommendation.text, recommendation.rationale)

  res.json({ snapshot, collab: total, recommendation })
})

// ---------- Consent and deletion (required by the brief) ----------
app.post('/api/consent', requireUser, (req, res) => {
  const { type, granted } = req.body ?? {}
  if (!type) return res.status(400).json({ error: 'Missing consent type.' })
  db.prepare('INSERT INTO consents (user_id, type, granted, policy_version, created_at) VALUES (?, ?, ?, ?, ?)').run(
    req.userId, String(type), granted ? 1 : 0, 'v1', now()
  )
  res.json({ ok: true })
})

app.delete('/api/me', requireUser, async (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.userId) // cascades to all user tables
  if (clerk) await clerk.clerkClient.users.deleteUser(req.userId)
  res.json({ ok: true })
})

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong.' })
})

app.listen(PORT, () => console.log(`chat-server running on http://localhost:${PORT}`))