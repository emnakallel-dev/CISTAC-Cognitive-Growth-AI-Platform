const has = (t, words) => words.some((w) => t.includes(w))
const SPECIFIC = ['visual','numerical','spatial','verbal','score','range','goal','because','so that','pourquoi','objectif']
const VERIFY = ['why','how do you know','are you sure','source','evidence','show me the numbers','is that right','double-check','pourquoi','es-tu sûr','preuve']
const REFINE = ['also','instead','more','another','shorter','simpler','harder','easier','what about','can you make','aussi','plutôt','plus simple']
const OWN = ['i think','i tried','my answer','my plan','i got','i would','my guess','i noticed','je pense',"j'ai essayé"]
const DELEGATE = ['just give me','do it for me','tell me what to do','give me the answer','fais-le pour moi']
const UNSAFE = ['diagnose','do i have','adhd','dyslexia','answer to question','answers to the test','diagnostic']
const PII = /[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s().-]{8,}\d/
const cap = (x) => Math.max(0, Math.min(100, Math.round(x)))

export function collaborationScore(messages) {
  const user = messages.filter((m) => m.role === 'user').map((m) => m.content.toLowerCase())
  const ai = messages.filter((m) => m.role === 'assistant').length
  const n = user.length
  if (n < 3) return null // not enough evidence yet
  const count = (arr, f) => arr.filter(f).length

  const clarification = cap((100 * count(user, (t) => t.split(/\s+/).length >= 8 && has(t, SPECIFIC)) / n) / 0.6)
  const critical_verification = cap((100 * count(user, (t) => has(t, VERIFY)) / Math.max(1, ai)) / 0.33)
  const iteration = cap((100 * count(user.slice(1), (t) => has(t, REFINE)) / Math.max(1, n - 1)) / 0.5)
  const autonomy = cap((100 * count(user, (t) => has(t, OWN)) / n) / 0.3 - 25 * count(user, (t) => has(t, DELEGATE)))
  const responsible_use = cap(100 - 30 * count(user, (t) => has(t, UNSAFE) || PII.test(t)))

  const total = Math.round(0.2 * clarification + 0.25 * critical_verification + 0.2 * iteration + 0.2 * autonomy + 0.15 * responsible_use)
  return { total, clarification, critical_verification, iteration, autonomy, responsible_use, formula_version: 'v1' }
}