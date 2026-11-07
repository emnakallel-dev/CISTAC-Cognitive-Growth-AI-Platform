import 'dotenv/config'
import express from 'express'
import { clerkMiddleware, getAuth } from '@clerk/express'

import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { collaborationScore } from './collab.js'

import assessment from './assessment-routes.js'

import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)



const IMAGE_DIR = path.join(__dirname, 'public')

const db = new DatabaseSync(fileURLToPath(new URL('./db/demo.db', import.meta.url)))

const { LLM_API_KEY, LLM_MODEL } = process.env
const LLM_BASE_URL = (process.env.LLM_BASE_URL || '').replace(/\/+$/, '')
const PORT = process.env.PORT || 8787

if (!LLM_BASE_URL || !LLM_MODEL) {
  console.error('Missing LLM_BASE_URL or LLM_MODEL in chat-server/.env')
  process.exit(1)
}

// Warn early if coach_messages does not have the columns this file uses.
const cmCols = db.prepare('PRAGMA table_info(coach_messages)').all().map((c) => c.name)
for (const c of ['user_id', 'role', 'content', 'created_at']) {  if (!cmCols.includes(c)) {
    console.error(`coach_messages has no "${c}" column. Found: ${cmCols.join(', ')}`)
  }
}

const SYSTEM_PROMPT = `You are a friendly cognitive growth coach inside a learning app.
Rules:
- Use plain, warm language. Keep answers under 150 words unless asked for more.
- This is NOT a clinical tool. Never diagnose and never use medical or clinical terms.
- Describe skills as things that can grow with practice, not fixed traits.
- Explain WHY you give each suggestion, in one sentence.
- Be honest about uncertainty: say "may" or "seems", never promise results.
- Never invent scores or history. Only use data given to you.
- If the user seems distressed or mentions a health concern, respond kindly and suggest talking to someone they trust or a qualified professional.`

const app = express()
app.use(express.json({ limit: '50kb' }))

app.use('/api', clerkMiddleware())

app.use('/api', (req, res, next) => {
  const { isAuthenticated, userId } = getAuth(req)

  if (!isAuthenticated || !userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  req.userId = userId
  next()
})
/* ----------------------------- DB helpers ----------------------------- */


const loadHistory = (userId, limit = 20) =>
  db
    .prepare('SELECT role, content, created_at FROM coach_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(userId, limit)
    .reverse()

const saveMessage = (userId, role, content) =>
  db
    .prepare("INSERT INTO coach_messages (user_id, role, content, created_at) VALUES (?, ?, ?, datetime('now'))")
    .run(userId, role, content)

function saveCollab(userId) {
  const s = collaborationScore(loadHistory(userId, 40))
  if (!s) return null

  const snap = db
    .prepare('SELECT id FROM profile_snapshots WHERE user_id = ? ORDER BY taken_at DESC, id DESC LIMIT 1')
    .get(userId)

  const today = new Date().toISOString().slice(0, 10)

  const row = db
    .prepare('SELECT id FROM collaboration_scores WHERE user_id = ? AND taken_at = ?')
    .get(userId, today)

  const v = [
    s.total,
    s.clarification,
    s.critical_verification,
    s.iteration,
    s.autonomy,
    s.responsible_use,
    s.formula_version
  ]

  if (row) {
    db.prepare(
      'UPDATE collaboration_scores SET total=?, clarification=?, critical_verification=?, iteration=?, autonomy=?, responsible_use=?, formula_version=? WHERE id=?'
    ).run(...v, row.id)
  } else {
    db.prepare(
      'INSERT INTO collaboration_scores (user_id, snapshot_id, taken_at, total, clarification, critical_verification, iteration, autonomy, responsible_use, formula_version) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(userId, snap?.id ?? null, today, ...v)
  }

  return s
}

async function buildContext(userId) {
  const rows = db
    .prepare('SELECT * FROM profile_snapshots WHERE user_id = ? ORDER BY taken_at DESC, id DESC LIMIT 2')
    .all(userId)

  if (!rows.length) return null

  const [latest, prev] = rows

  const line = (k) => {
    const d = prev ? ` (previous: ${prev[k]}%)` : ''
    return `${k} ${latest[k]}% (likely range ${latest[k + '_low']}-${latest[k + '_high']}, from ${latest[k + '_n']} questions)${d}`
  }

  const c = db
    .prepare('SELECT * FROM collaboration_scores WHERE user_id = ? ORDER BY taken_at DESC, id DESC LIMIT 1')
    .get(userId)

  const collab = c
    ? ` AI collaboration score: ${c.total}/100 (clarification ${c.clarification}, verification ${c.critical_verification}, iteration ${c.iteration}, autonomy ${c.autonomy}, responsible use ${c.responsible_use}). If asked, give one tip on the weakest part.`
    : ''

  return (
    `The user's latest results, taken ${latest.taken_at}: ` +
    ['logical', 'numerical', 'spatial', 'verbal'].map(line).join('; ') +
    '. Use only these numbers and mention the range when discussing a score.' +
    collab
  )
}


/* -------------------------------- Routes ------------------------------- */

app.post('/api/chat', async (req, res) => {
  const text = String(req.body?.message ?? '').trim().slice(0, 2000)
  if (!text) return res.status(400).json({ error: 'No message provided.' })

  try {
    saveMessage(req.userId, 'user', text)
    const messages = loadHistory(req.userId, 20).map(({ role, content }) => ({ role, content }))
    const context = await buildContext(req.userId)

    const fullMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(context ? [{ role: 'system', content: context }] : []),
      ...messages,
    ]

    const upstream = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(LLM_API_KEY ? { Authorization: `Bearer ${LLM_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    })

    if (!upstream.ok) {
      console.error('AI provider error', upstream.status, await upstream.text())
      return res.status(502).json({
        error:
          upstream.status === 429
            ? 'The free AI limit was reached. Please wait a minute and try again.'
            : 'The AI service returned an error.',
      })
    }

    const data = await upstream.json()
    const reply = data.choices?.[0]?.message?.content
    if (!reply) return res.status(502).json({ error: 'Empty reply from the AI.' })

    saveMessage(req.userId, 'assistant', reply)
    res.json({ reply, collaboration: saveCollab(req.userId) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not reach the AI service.' })
  }
})

app.get('/api/chat/history', (req, res) => {
  res.json({ messages: loadHistory(req.userId, 50) })
})

app.get('/api/history', (req, res) => {
  const rows = db
.prepare('SELECT * FROM profile_snapshots WHERE user_id = ? ORDER BY taken_at, id')    .all(req.userId)
  const sessions = rows.map((r) => ({
    id: r.id,
    date: r.taken_at,
    scores: { logical: r.visual, numerical: r.numerical, spatial: r.spatial, verbal: r.verbal, speed: null },
    ranges: {
      visual: [r.visual_low, r.visual_high],
      numerical: [r.numerical_low, r.numerical_high],
      spatial: [r.spatial_low, r.spatial_high],
      verbal: [r.verbal_low, r.verbal_high],
    },
  }))
  res.json({ sessions })
})

app.get('/api/collaboration', (req, res) => {
  const rows = db
.prepare('SELECT * FROM profile_snapshots WHERE user_id = ? ORDER BY taken_at, id')    .all(req.userId)
  res.json({ scores: rows })
})

app.use('/api', assessment)
app.use('/images', express.static(IMAGE_DIR))

app.listen(PORT, () => console.log(`chat-server running on http://localhost:${PORT}`))