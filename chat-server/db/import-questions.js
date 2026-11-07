import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { db } from './db.js'

const CSV_PATH = fileURLToPath(new URL('./questions.csv', import.meta.url))
const IMAGE_DIR = fileURLToPath(new URL('../public/question-images/', import.meta.url))

const BIAS = {
    verbal: 'Language-dependent: English only; vocabulary reflects schooling and reading habits.',
    numerical: 'Assumes familiarity with Arabic numerals and school arithmetic.',
    logical: 'Abstract patterns can favour test-experienced users; cultural familiarity with puzzle formats varies.',
    spatial: 'Familiarity with 2D/3D diagrams varies; image tasks may disadvantage low-vision users without alt text.',
}

// ---------- parsing helpers ----------
const raw = readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '') // strip Excel BOM
// Pick whichever separator appears most in the header line: ; , or tab
const header = raw.split(/\r?\n/, 1)[0]
const delimiter = [';', '\t', ','].sort(
    (a, b) => header.split(b).length - header.split(a).length
)[0]

const rows = parse(raw, {
  columns: true,
  delimiter,
  skip_empty_lines: true,
  skip_records_with_empty_values: true,
  trim: true,
  relax_quotes: true,
})

function parseDimension(s) {
    const v = String(s).toLowerCase()
    return ['spatial', 'logical', 'numerical', 'verbal'].find((d) => v.includes(d)) ?? null
}

function parseDifficulty(s) {
    const words = { easy: 1, medium: 2, hard: 3 }
    const v = String(s).trim().toLowerCase()
    if (v in words) return words[v]
    const n = Number(v)
    return Number.isInteger(n) && n >= 1 && n <= 3 ? n : null
}

function parseOptions(s) {
    const v = String(s).trim()
    if (v.startsWith('[')) {
        try { return JSON.parse(v).map(String) } catch { /* fall through */ }
    }
    return v
        .split(/\r?\n|\|/)
        .map((o) => o.replace(/^\(?(?:[A-Ha-h]|\d{1,2})[).:]\s*/, '').trim()) // drop "A) " or "1: " prefixes
        .filter(Boolean)
}

// Store the answer as option TEXT (same convention as your seed), even if the CSV uses a letter.
function resolveAnswer(answer, options) {
    const a = String(answer).trim()
    const exact = options.find((o) => o.toLowerCase() === a.toLowerCase())
    if (exact) return exact
    if (/^[A-Ha-h]$/.test(a)) return options[a.toUpperCase().charCodeAt(0) - 65] ?? null
    if (/^\d{1,2}$/.test(a)) return options[Number(a) - 1] ?? null // "2" = second option
    return null
}

// ---------- validate everything first ----------
const clean = []
const errors = []
const seen = new Set()

const isOpen = (r) => /^open answer/i.test(String(r['Options'] ?? '').trim())
const skipped = rows.filter(isOpen)
const importable = rows.filter((r) => !isOpen(r))
if (skipped.length) console.warn(`Skipping ${skipped.length} open-answer rows`)

rows.forEach((r, i) => {
    const line = i + 2 // header is line 1
    const id = String(r['Question ID'] ?? '').trim()
    const dimension = parseDimension(r['Category'])
    const difficulty = parseDifficulty(r['Difficulty'])
    const options = parseOptions(r['Options'] ?? '')
    const correct = resolveAnswer(r['Correct Answer'] ?? '', options)
    const image = String(r['Image'] ?? '').trim() || null

    if (!id) errors.push(`line ${line}: missing Question ID`)
    else if (seen.has(id)) errors.push(`line ${line}: duplicate Question ID "${id}"`)
    seen.add(id)
    if (!dimension) errors.push(`line ${line} (${id}): unknown category "${r['Category']}"`)
    if (difficulty == null) errors.push(`line ${line} (${id}): bad difficulty "${r['Difficulty']}"`)
    if (!r['Question']) errors.push(`line ${line} (${id}): empty question`)
    if (options.length < 2) errors.push(`line ${line} (${id}): could not parse options "${r['Options']}"`)
    else if (!correct) errors.push(`line ${line} (${id}): correct answer "${r['Correct Answer']}" not among options`)
    if (image && !existsSync(path.join(IMAGE_DIR, image))) errors.push(`line ${line} (${id}): image not found "${image}"`)

    clean.push({
        id, dimension, difficulty, prompt: r['Question'], image, options, correct,
        points: Number(r['Points']) || 1,
        explanation: r['Explanation'] || null,
    })
})

if (errors.length) {
    console.error(`Import aborted: ${errors.length} problem(s)\n` + errors.map((e) => '  - ' + e).join('\n'))
    process.exit(1)
}

// ---------- upsert in one transaction ----------
const upsert = db.prepare(`
  INSERT INTO questions
    (external_id, dimension, difficulty, prompt, image, options_json, correct_answer, points, explanation, bias_notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(external_id) DO UPDATE SET
    dimension=excluded.dimension, difficulty=excluded.difficulty, prompt=excluded.prompt,
    image=excluded.image, options_json=excluded.options_json,
    correct_answer=excluded.correct_answer, points=excluded.points,
    explanation=excluded.explanation, bias_notes=excluded.bias_notes
`)

db.exec('BEGIN')
try {
    for (const q of clean) {
        upsert.run(q.id, q.dimension, q.difficulty, q.prompt, q.image, JSON.stringify(q.options),
            q.correct, q.points, q.explanation, BIAS[q.dimension])
    }
    db.exec('COMMIT')
} catch (e) {
    db.exec('ROLLBACK')
    throw e
}

console.log(`Imported ${clean.length} questions.`)
console.table(db.prepare(
    'SELECT dimension, COUNT(*) AS total, SUM(image IS NOT NULL) AS with_image, MIN(difficulty) AS min_d, MAX(difficulty) AS max_d FROM questions GROUP BY dimension'
).all())