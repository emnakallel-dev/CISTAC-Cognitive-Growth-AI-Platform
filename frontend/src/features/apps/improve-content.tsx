// Content for the "Improve" page: exercises per skill + a 4-week roadmap built from the scores.
// Paste it into your Improve page file (or import it) and render:
//   <ImproveContent scores={scores} startHref='/take-the-test' />
// Only Tailwind classes, no extra imports besides React's useState.

import { useState } from 'react'

export type SkillKey = 'logical' | 'numerical' | 'spatial' | 'verbal'
export type Scores = Partial<Record<SkillKey, number | null>>

const SKILLS: { key: SkillKey; label: string }[] = [
  { key: 'logical', label: 'Logical reasoning' },
  { key: 'numerical', label: 'Numerical reasoning' },
  { key: 'spatial', label: 'Spatial reasoning' },
  { key: 'verbal', label: 'Verbal reasoning' },
]

type Exercise = { id: string; title: string; minutes: number; kind: 'Accuracy' | 'Speed' }

const EXERCISES: Record<SkillKey, Exercise[]> = {
  logical: [
    { id: 'lo1', title: 'Solve 5 "odd one out" and pattern puzzles, no timer', minutes: 10, kind: 'Accuracy' },
    { id: 'lo2', title: 'Work through 3 if-then and "all / some" reasoning questions, writing each step', minutes: 10, kind: 'Accuracy' },
    { id: 'lo3', title: 'Timed round: 5 pattern puzzles in 5 minutes', minutes: 5, kind: 'Speed' },
    { id: 'lo4', title: 'Explain one solved puzzle out loud as if teaching a friend', minutes: 5, kind: 'Accuracy' },
  ],
  numerical: [
    { id: 'nu1', title: 'Number sequences: find the rule for 6 series, no timer', minutes: 10, kind: 'Accuracy' },
    { id: 'nu2', title: 'Percentages and fractions: 5 word problems, check each result', minutes: 10, kind: 'Accuracy' },
    { id: 'nu3', title: 'Timed mental arithmetic: 20 operations in 3 minutes', minutes: 5, kind: 'Speed' },
    { id: 'nu4', title: 'Rebuild one hard sequence from its differences', minutes: 5, kind: 'Accuracy' },
  ],
  spatial: [
    { id: 'sp1', title: 'Mental rotation: 5 shapes, imagine the turn before answering', minutes: 10, kind: 'Accuracy' },
    { id: 'sp2', title: 'Cube and paper-folding puzzles: count faces, edges and holes', minutes: 10, kind: 'Accuracy' },
    { id: 'sp3', title: 'Timed round: 6 rotation questions in 5 minutes', minutes: 5, kind: 'Speed' },
    { id: 'sp4', title: 'Sketch a simple object from two different sides', minutes: 5, kind: 'Accuracy' },
  ],
  verbal: [
    { id: 've1', title: 'Synonyms and opposites: 10 words, then use 3 in sentences', minutes: 10, kind: 'Accuracy' },
    { id: 've2', title: 'Analogies: 5 "A is to B as C is to ?" questions, name the relationship', minutes: 10, kind: 'Accuracy' },
    { id: 've3', title: 'Timed round: 8 vocabulary questions in 4 minutes', minutes: 5, kind: 'Speed' },
    { id: 've4', title: 'Read a short article and summarise it in two sentences', minutes: 5, kind: 'Accuracy' },
  ],
}

// Example scores, only used when no real scores are passed in.
const DEMO_SCORES: Scores = { logical: 68, numerical: 62, spatial: 61, verbal: 69 }

export function levelOf(score: number) {
  if (score >= 85) return 'Excelling'
  if (score >= 70) return 'Strong'
  if (score >= 50) return 'Developing'
  return 'Building'
}

// Helper for /api/history: the database column "visual" holds logical reasoning.
export function scoresFromHistory(rows: Array<Record<string, unknown>>): Scores {
  const last = rows[rows.length - 1]
  if (!last) return {}
  const num = (v: unknown) => (typeof v === 'number' ? v : null)
  return {
    logical: num(last.visual),
    numerical: num(last.numerical),
    spatial: num(last.spatial),
    verbal: num(last.verbal),
  }
}

export function ImproveContent({
  scores,
  startHref,
}: {
  scores?: Scores
  startHref?: string
}) {
  const usingDemo = !scores || Object.values(scores).every((v) => v == null)
  const data = usingDemo ? DEMO_SCORES : scores
  const [done, setDone] = useState<Record<string, boolean>>({})

  const ranked = SKILLS.filter((s) => typeof data[s.key] === 'number')
    .map((s) => ({ ...s, score: data[s.key] as number }))
    .sort((a, b) => a.score - b.score)

  if (ranked.length === 0) {
    return (
      <p className='text-muted-foreground'>
        Complete a test to get your exercises and roadmap.
      </p>
    )
  }

  const focus = ranked[0]
  const second = ranked[1]
  const others = ranked.slice(2)
  const goal = Math.min(100, Math.round(focus.score + 5))
  // Below 60% a skill shows accuracy exercises only; timed practice unlocks at 60%.
  const exercisesFor = (key: SkillKey, score: number) =>
    score < 60 ? EXERCISES[key].filter((e) => e.kind === 'Accuracy') : EXERCISES[key]
  const shown = ranked.flatMap((s) => exercisesFor(s.key, s.score))
  const total = shown.length
  const doneCount = shown.filter((e) => done[e.id]).length

  const weeks = [
    {
      title: 'Week 1: build the base',
      text: `Practise ${focus.label} three times (10 minutes each), without a timer. Aim to be right before you aim to be fast.`,
    },
    {
      title: 'Week 2: add speed',
      text: `Repeat ${focus.label} with a timer. ${second ? `Start ${second.label} twice (10 minutes each).` : ''}`,
    },
    {
      title: 'Week 3: step up',
      text: `Try harder questions in ${focus.label}. ${second ? `Keep ${second.label} going.` : ''} ${
        others.length ? `One light session each for ${others.map((o) => o.label).join(' and ')}.` : ''
      }`,
    },
    {
      title: 'Week 4: check your progress',
      text: 'Retake the test and compare it with today. Then choose your next focus.',
    },
  ]

  return (
    <div className='mx-auto max-w-4xl space-y-6'>
      {usingDemo && (
        <p className='rounded-lg border border-dashed p-3 text-xs text-muted-foreground'>
          Example scores are shown because no test result was found yet.
        </p>
      )}

      <section className='space-y-2 rounded-xl border bg-card p-5'>
        <p className='text-sm text-muted-foreground'>Your focus for the next weeks</p>
        <h2 className='text-xl font-semibold'>
          {focus.label} ({focus.score}%)
        </h2>
        <p className='text-sm'>
          <strong>Why:</strong> it is your lowest score right now
          {second ? `, ${focus.score - second.score === 0 ? 'level with' : 'below'} ${second.label} (${second.score}%)` : ''}.
          Raising your weakest skill is the quickest way to lift your overall score.
        </p>
        <p className='text-sm'>
          <strong>Suggested goal:</strong> from {focus.score}% to about {goal}% by week 4. This is a target to
          aim for, not a promise, because scores are estimates and vary from one session to the next.
        </p>
        {startHref && (
          <a
            href={startHref}
            className='inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground'
          >
            Take the test
          </a>
        )}
      </section>

      <section className='space-y-3'>
        <div className='flex items-baseline justify-between'>
          <h2 className='text-lg font-semibold'>Exercises</h2>
          <span className='text-sm text-muted-foreground'>
            {doneCount} of {total} done
          </span>
        </div>
        <div className='grid gap-4 md:grid-cols-2'>
          {ranked.map((s) => {
            const exercises = exercisesFor(s.key, s.score)
            return (
              <div key={s.key} className={`space-y-3 rounded-xl border bg-card p-5 ${s.key === focus.key ? 'ring-2 ring-primary' : ''}`}>
                <div className='flex items-center justify-between'>
                  <h3 className='font-semibold'>{s.label}</h3>
                  <span className='text-xs text-muted-foreground'>
                    {s.score}% · {levelOf(s.score)}
                    {s.key === focus.key ? ' · Focus' : ''}
                  </span>
                </div>
                <div className='h-2 rounded bg-muted'>
                  <div className='h-2 rounded bg-primary' style={{ width: `${s.score}%` }} />
                </div>
                <ul className='space-y-2'>
                  {exercises.map((e) => (
                    <li key={e.id}>
                      <label className='flex cursor-pointer items-start gap-2 text-sm'>
                        <input
                          type='checkbox'
                          className='mt-1'
                          checked={!!done[e.id]}
                          onChange={(ev) => setDone((d) => ({ ...d, [e.id]: ev.target.checked }))}
                        />
                        <span className={done[e.id] ? 'text-muted-foreground line-through' : ''}>
                          {e.title}{' '}
                          <span className='text-xs text-muted-foreground'>
                            ({e.minutes} min, {e.kind})
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
        <p className='text-xs text-muted-foreground'>
          Each question score is 70% accuracy and 30% speed, so the plan builds accuracy first and adds timed
          practice once a skill reaches 60%.
        </p>
      </section>

      <section className='space-y-3'>
        <h2 className='text-lg font-semibold'>Your 4-week roadmap</h2>
        <ol className='space-y-3'>
          {weeks.map((w, i) => (
            <li key={w.title} className='flex gap-3 rounded-xl border bg-card p-4'>
              <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground'>
                {i + 1}
              </span>
              <div className='space-y-1'>
                <h3 className='font-medium'>{w.title}</h3>
                <p className='text-sm text-muted-foreground'>{w.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className='text-xs text-muted-foreground'>
          Processing speed is not measured yet, so it is not part of this plan. These are practice suggestions,
          not a diagnosis.
        </p>
      </section>
    </div>
  )
}
