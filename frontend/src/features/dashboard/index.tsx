// /frontend/src/features/dashboard/index.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

/* -------------------------------------------------------------------------- */
/*  CONFIG – the only things you should need to touch to plug in the backend   */
/* -------------------------------------------------------------------------- */

// GET /api/history feeds everything on this page.
const HISTORY_URL = '/api/history'

// TODO: set to the real assessment route once it exists.
// (Plain location change so it never conflicts with typed router routes.)
const START_ASSESSMENT_PATH = '/assessment'

// Set to true if the backend returns scores between 0 and 1 instead of 0 and 100.
const SCORES_ARE_FRACTIONS = false

// Used when the backend does not send goals. TODO: replace with GET goals endpoint if one is added.
const DEFAULT_GOAL = 80

// Flip to true to preview the page with sample data while the API is not ready.
const USE_MOCK_DATA = false

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

const DIMENSIONS = [
  { key: 'logical', label: 'Logical reasoning', color: '#6366f1' },
  { key: 'numerical', label: 'Numerical reasoning', color: '#f59e0b' },
  { key: 'spatial', label: 'Spatial reasoning', color: '#10b981' },
  { key: 'verbal', label: 'Verbal reasoning', color: '#ec4899' },
  { key: 'speed', label: 'Processing speed', color: '#06b6d4' },
] as const

type DimensionKey = (typeof DIMENSIONS)[number]['key']
type Scores = Record<DimensionKey, number | null>

interface SessionRecord {
  id: string
  date: string // ISO string
  globalScore: number | null
  scores: Scores
}

interface BrainTwinData {
  sessions: SessionRecord[] // sorted oldest -> newest
  goals: Partial<Record<DimensionKey | 'global', number>>
}

const EMPTY_DATA: BrainTwinData = { sessions: [], goals: {} }
const GLOBAL_COLOR = '#94a3b8'

/* -------------------------------------------------------------------------- */
/*  API layer (placeholders)                                                   */
/* -------------------------------------------------------------------------- */

function toPct(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (Number.isNaN(n)) return null
  const pct = SCORES_ARE_FRACTIONS ? n * 100 : n
  return Math.round(pct * 10) / 10
}

/**
 * Maps whatever /api/history returns to the shape this page uses.
 * TODO: adjust the field names below once the backend contract is confirmed.
 * Accepts either `[...sessions]` or `{ sessions: [...], goals: {...} }`.
 */
function normalizeHistory(raw: any): BrainTwinData {
  const list: any[] = Array.isArray(raw) ? raw : (raw?.sessions ?? [])

  const sessions: SessionRecord[] = list
    .map((s, index) => {
      const src = s?.scores ?? s?.dimensions ?? s ?? {}
      const scores: Scores = {
        logical: toPct(src.logical ?? src.logical_reasoning),
        numerical: toPct(src.numerical ?? src.numerical_reasoning),
        spatial: toPct(src.spatial ?? src.spatial_reasoning),
        verbal: toPct(src.verbal ?? src.verbal_reasoning),
        // Processing speed is not part of the question score formula.
        // TODO: backend must compute it (e.g. median T_user / T_max on correct answers).
        speed: toPct(
          src.speed ?? src.processing_speed ?? src.processingSpeed
        ),
      }

      let globalScore = toPct(
        s?.global_score ?? s?.globalScore ?? s?.global ?? src.global
      )
      if (globalScore === null) {
        const present = Object.values(scores).filter(
          (v): v is number => v !== null
        )
        globalScore = present.length
          ? Math.round(
              (present.reduce((a, b) => a + b, 0) / present.length) * 10
            ) / 10
          : null
      }

      return {
        id: String(s?.id ?? s?.session_id ?? index),
        date: String(s?.date ?? s?.finished_at ?? s?.created_at ?? ''),
        globalScore,
        scores,
      }
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const goals: BrainTwinData['goals'] = {}
  if (raw && !Array.isArray(raw) && raw.goals) {
    for (const [k, v] of Object.entries(raw.goals)) {
      const pct = toPct(v)
      if (pct !== null) goals[k as DimensionKey | 'global'] = pct
    }
  }

  return { sessions, goals }
}

async function fetchHistory(signal?: AbortSignal): Promise<BrainTwinData> {
  if (USE_MOCK_DATA) return buildMockData()

  const res = await fetch(HISTORY_URL, {
    signal,
    credentials: 'include', // TODO: swap for an Authorization header if the API uses tokens
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Could not load your history (${res.status}).`)
  return normalizeHistory(await res.json())
}

function useBrainTwin() {
  const [data, setData] = useState<BrainTwinData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchHistory(controller.signal)
      .then(setData)
      .catch((e: unknown) => {
        if ((e as Error)?.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Something went wrong.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  return { data, loading, error }
}

function buildMockData(): BrainTwinData {
  const base = [52, 48, 55, 50, 40]
  const sessions = Array.from({ length: 8 }, (_, i) => {
    const scores = {} as Scores
    DIMENSIONS.forEach((d, j) => {
      const wobble = ((i * 7 + j * 5) % 6) - 2
      scores[d.key] = Math.min(98, (base[j] ?? 50) + i * 3.5 + wobble)
    })
    const vals = Object.values(scores) as number[]
    return {
      id: String(i + 1),
      date: new Date(Date.now() - (8 - i) * 6 * 86400000).toISOString(),
      globalScore: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
      scores,
    }
  })
  return { sessions, goals: { global: 75 } }
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const fmt = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${Math.round(v)}%`

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const fmtDateLong = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
}

function delta(
  current: number | null | undefined,
  previous: number | null | undefined
) {
  if (current == null || previous == null) return null
  return Math.round((current - previous) * 10) / 10
}

function DeltaLabel({ value }: { value: number | null }) {
  if (value === null) return null
  const sign = value > 0 ? '+' : ''
  const tone =
    value > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : value < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground'
  return (
    <span className={`text-xs font-medium ${tone}`}>
      {sign}
      {value} pts
    </span>
  )
}

// Red (low) to green (high), readable in light and dark themes.
const heatColor = (score: number | null) =>
  score === null
    ? 'transparent'
    : `hsl(${Math.max(0, Math.min(100, score)) * 1.2}, 60%, 38%)`

/* -------------------------------------------------------------------------- */
/*  Small UI pieces                                                            */
/* -------------------------------------------------------------------------- */

function StartAssessmentButton({ label = 'Start assessment' }: { label?: string }) {
  // TODO: replace with router navigation once the assessment route is final.
  return (
    <Button onClick={() => window.location.assign(START_ASSESSMENT_PATH)}>
      {label}
    </Button>
  )
}

function ScoreCard({
  title,
  description,
  value,
  change,
  color,
  loading,
}: {
  title: string
  description: string
  value: number | null
  change: number | null
  color: string
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='flex items-center gap-2 text-sm font-medium'>
          <span
            className='inline-block h-2.5 w-2.5 rounded-full'
            style={{ backgroundColor: color }}
          />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='text-3xl font-bold'>{loading ? '…' : fmt(value)}</div>
        <div className='mt-1 h-4'>
          <DeltaLabel value={change} />
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyProfile() {
  return (
    <Card>
      <CardContent className='flex flex-col items-center gap-4 py-12 text-center'>
        <p className='text-muted-foreground max-w-md'>
          Your profile will appear here after your first assessment.
        </p>
        <StartAssessmentButton />
      </CardContent>
    </Card>
  )
}

function Heatmap({ sessions }: { sessions: SessionRecord[] }) {
  const rows = sessions.slice(-10)
  const columns = [
    ...DIMENSIONS.map((d) => ({ key: d.key as string, label: d.label })),
    { key: 'global', label: 'Global' },
  ]
  const cols = `7rem repeat(${columns.length}, minmax(4.5rem, 1fr))`

  return (
    <div className='overflow-x-auto'>
      <div className='grid min-w-[36rem] gap-1' style={{ gridTemplateColumns: cols }}>
        <div />
        {columns.map((c) => (
          <div
            key={c.key}
            className='text-muted-foreground px-1 pb-1 text-center text-xs'
          >
            {c.label}
          </div>
        ))}
        {rows.map((s) => (
          <HeatRow key={s.id} session={s} columns={columns} />
        ))}
      </div>
    </div>
  )
}

function HeatRow({
  session,
  columns,
}: {
  session: SessionRecord
  columns: { key: string; label: string }[]
}) {
  return (
    <>
      <div className='text-muted-foreground flex items-center text-xs'>
        {fmtDate(session.date)}
      </div>
      {columns.map((c) => {
        const v =
          c.key === 'global'
            ? session.globalScore
            : session.scores[c.key as DimensionKey]
        return (
          <div
            key={c.key}
            className='flex h-9 items-center justify-center rounded text-xs font-medium text-white'
            style={{ backgroundColor: heatColor(v) }}
            title={`${c.label}: ${fmt(v)}`}
          >
            {fmt(v)}
          </div>
        )
      })}
    </>
  )
}

function GoalRow({
  label,
  color,
  current,
  target,
}: {
  label: string
  color: string
  current: number | null
  target: number
}) {
  const reached = current !== null && current >= target
  const width = Math.max(0, Math.min(100, current ?? 0))
  return (
    <div className='space-y-1.5'>
      <div className='flex items-center justify-between text-sm'>
        <span className='font-medium'>{label}</span>
        <span className='text-muted-foreground'>
          {fmt(current)} of {target}%{reached ? ' · goal reached' : ''}
        </span>
      </div>
      <div className='bg-muted relative h-2 rounded-full'>
        <div
          className='h-2 rounded-full'
          style={{ width: `${width}%`, backgroundColor: color }}
        />
        <div
          className='bg-foreground absolute top-[-3px] h-3.5 w-0.5 rounded'
          style={{ left: `${Math.min(100, target)}%` }}
          title={`Goal: ${target}%`}
        />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export function Dashboard() {
  const { data, loading, error } = useBrainTwin()
  const { sessions, goals } = data

  const first = sessions[0]
  const latest = sessions[sessions.length - 1]
  const previous = sessions.length > 1 ? sessions[sessions.length - 2] : undefined
  const hasSessions = sessions.length > 0

  const radarData = useMemo(
    () =>
      DIMENSIONS.map((d) => ({
        dimension: d.label.replace(' reasoning', ''),
        Now: latest?.scores[d.key] ?? 0,
        'First session': first?.scores[d.key] ?? 0,
      })),
    [first, latest]
  )

  const curveData = useMemo(
    () =>
      sessions.map((s) => ({
        date: fmtDate(s.date),
        Global: s.globalScore,
        ...Object.fromEntries(
          DIMENSIONS.map((d) => [d.label, s.scores[d.key]])
        ),
      })),
    [sessions]
  )

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <Search />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <h1 className='text-2xl font-bold tracking-tight'>Brain Twin</h1>
          <div className='flex items-center space-x-2'>
            <StartAssessmentButton />
          </div>
        </div>

        {error && (
          <p className='text-destructive mb-2 text-sm' role='alert'>
            {error}
          </p>
        )}

        <Tabs
          orientation='vertical'
          defaultValue='overview'
          className='space-y-4'
        >
          <div className='w-full overflow-x-auto pb-2'>
            <TabsList>
              <TabsTrigger value='overview'>Where you stand</TabsTrigger>
              <TabsTrigger value='progress'>Progress</TabsTrigger>
              <TabsTrigger value='sessions'>Sessions</TabsTrigger>
            </TabsList>
          </div>

          {/* ---------------------------- Overview ---------------------------- */}
          <TabsContent value='overview' className='space-y-4'>
            {!loading && !hasSessions ? (
              <EmptyProfile />
            ) : (
              <>
                <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                  <ScoreCard
                    title='Overall score'
                    description={
                      latest
                        ? `Based on your session of ${fmtDateLong(latest.date)}`
                        : 'Average of all dimensions'
                    }
                    value={latest?.globalScore ?? null}
                    change={delta(latest?.globalScore, previous?.globalScore)}
                    color={GLOBAL_COLOR}
                    loading={loading}
                  />
                  {DIMENSIONS.map((d) => (
                    <ScoreCard
                      key={d.key}
                      title={d.label}
                      description='Your latest result'
                      value={latest?.scores[d.key] ?? null}
                      change={delta(
                        latest?.scores[d.key],
                        previous?.scores[d.key]
                      )}
                      color={d.color}
                      loading={loading}
                    />
                  ))}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Your profile</CardTitle>
                    <CardDescription>
                      Latest session compared with your first one
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='h-80'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey='dimension' fontSize={12} />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} />
                        <Radar
                          name='First session'
                          dataKey='First session'
                          stroke={GLOBAL_COLOR}
                          fill={GLOBAL_COLOR}
                          fillOpacity={0.15}
                        />
                        <Radar
                          name='Now'
                          dataKey='Now'
                          stroke='#6366f1'
                          fill='#6366f1'
                          fillOpacity={0.35}
                        />
                        <Legend />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ---------------------------- Progress ---------------------------- */}
          <TabsContent value='progress' className='space-y-4'>
            {!loading && !hasSessions ? (
              <EmptyProfile />
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Score evolution</CardTitle>
                    <CardDescription>
                      Overall score and each dimension, session by session
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='h-80'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <LineChart data={curveData}>
                        <CartesianGrid strokeDasharray='3 3' opacity={0.3} />
                        <XAxis dataKey='date' fontSize={12} />
                        <YAxis domain={[0, 100]} fontSize={12} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type='monotone'
                          dataKey='Global'
                          stroke={GLOBAL_COLOR}
                          strokeWidth={3}
                          dot
                          connectNulls
                        />
                        {DIMENSIONS.map((d) => (
                          <Line
                            key={d.key}
                            type='monotone'
                            dataKey={d.label}
                            stroke={d.color}
                            strokeWidth={1.5}
                            dot={false}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div className='grid gap-4 lg:grid-cols-2'>
                  <Card>
                    <CardHeader>
                      <CardTitle>Heatmap</CardTitle>
                      <CardDescription>
                        Your last sessions. Greener means stronger.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Heatmap sessions={sessions} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Goals</CardTitle>
                      <CardDescription>
                        Where you are against your targets
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      <GoalRow
                        label='Overall score'
                        color={GLOBAL_COLOR}
                        current={latest?.globalScore ?? null}
                        target={goals.global ?? DEFAULT_GOAL}
                      />
                      {DIMENSIONS.map((d) => (
                        <GoalRow
                          key={d.key}
                          label={d.label}
                          color={d.color}
                          current={latest?.scores[d.key] ?? null}
                          target={goals[d.key] ?? DEFAULT_GOAL}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>How your profile changed</CardTitle>
                    <CardDescription>
                      {sessions.length > 1 && first
                        ? `Since your first session on ${fmtDateLong(first.date)}`
                        : 'Compares your first and latest sessions'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sessions.length < 2 ? (
                      <p className='text-muted-foreground text-sm'>
                        Complete another session to see how your profile changes.
                      </p>
                    ) : (
                      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                        {[
                          {
                            key: 'global',
                            label: 'Overall score',
                            from: first?.globalScore ?? null,
                            to: latest?.globalScore ?? null,
                          },
                          ...DIMENSIONS.map((d) => ({
                            key: d.key as string,
                            label: d.label,
                            from: first?.scores[d.key] ?? null,
                            to: latest?.scores[d.key] ?? null,
                          })),
                        ].map((row) => (
                          <div
                            key={row.key}
                            className='flex items-center justify-between rounded-md border p-3'
                          >
                            <div>
                              <div className='text-sm font-medium'>{row.label}</div>
                              <div className='text-muted-foreground text-xs'>
                                {fmt(row.from)} to {fmt(row.to)}
                              </div>
                            </div>
                            <DeltaLabel value={delta(row.to, row.from)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ---------------------------- Sessions ---------------------------- */}
          <TabsContent value='sessions' className='space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle>Past sessions</CardTitle>
                <CardDescription>Most recent first</CardDescription>
              </CardHeader>
              <CardContent>
                {!loading && !hasSessions ? (
                  <div className='flex flex-col items-center gap-4 py-8 text-center'>
                    <p className='text-muted-foreground'>
                      No sessions yet. Each session you complete will show up here.
                    </p>
                    <StartAssessmentButton />
                  </div>
                ) : (
                  <ul className='space-y-3'>
                    {[...sessions].reverse().map((s, i, arr) => {
                      // arr is newest -> oldest, so the next item is the previous session
                      const prev = arr[i + 1]
                      return (
                        <li
                          key={s.id}
                          className='flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between'
                        >
                          <div>
                            <div className='text-sm font-medium'>
                              {fmtDateLong(s.date)}
                            </div>
                            <div className='text-muted-foreground flex flex-wrap gap-x-3 text-xs'>
                              {DIMENSIONS.map((d) => (
                                <span key={d.key}>
                                  {d.label.replace(' reasoning', '')}:{' '}
                                  {fmt(s.scores[d.key])}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className='flex items-center gap-3'>
                            <DeltaLabel
                              value={delta(s.globalScore, prev?.globalScore)}
                            />
                            <span className='text-xl font-bold'>
                              {fmt(s.globalScore)}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}

/* Keep the template's nav as it was (this constant already exists in the original file). */
  
  
 

