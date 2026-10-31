import 'dotenv/config'
import express from 'express'

import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const db = new DatabaseSync(fileURLToPath(new URL('./db/demo.db', import.meta.url)))
const USER_ID = 'demo-user' // LATER: take from the verified Clerk token

const { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL } = process.env
const PORT = process.env.PORT || 8787

if (!LLM_BASE_URL || !LLM_MODEL) {
  console.error('Missing LLM_BASE_URL or LLM_MODEL in chat-server/.env')
  process.exit(1)
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
  return `The user's latest results, taken ${latest.taken_at}: ` +
    ['visual', 'numerical', 'spatial', 'verbal'].map(line).join('; ') +
    '. Use only these numbers and mention the range when discussing a score.'
}

app.post('/api/chat', async (req, res) => {
  const incoming = req.body?.messages
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' })
  }

  // Never trust the client: keep valid roles only and trim length.
  const messages = incoming
    .slice(-20)
    .filter(
      (m) =>
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))

  // LATER: verify the Clerk token here and get the userId from it
  //        (never take the user id from the request body).
  // const userId = ...
  const context = await buildContext(USER_ID)

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

    // LATER: save the user message and this reply to the database here.
    res.json({ reply })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not reach the AI service.' })
  }
})

app.get('/api/history', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM profile_snapshots WHERE user_id = ? ORDER BY taken_at, id')
    .all(USER_ID)
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
    .prepare('SELECT * FROM collaboration_scores WHERE user_id = ? ORDER BY taken_at, id')
    .all(USER_ID)
  res.json({ scores: rows })
})

app.listen(PORT, () => console.log(`chat-server running on http://localhost:${PORT}`))