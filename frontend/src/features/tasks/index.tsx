import { useEffect, useRef, useState } from 'react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

const USER_ID = 'demo-user' // TODO: replace with your auth user id

async function api(path: string, body?: unknown) {
  const res = await fetch(
    `/api${path}`,
    body === undefined
      ? undefined
      : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
  )
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json()
}

type Question = {
  id: number
  position: number
  total: number
  prompt: string
  image: string | null
  options: string[]
  tMaxMs: number
  remainingMs: number
}

export function Tasks() {
  const [sid, setSid] = useState<number | null>(null)
  const [q, setQ] = useState<Question | null>(null)
  const [left, setLeft] = useState(0)
  const [coach, setCoach] = useState<{ message: string } | null>(null)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const deadline = useRef(0)
  const busy = useRef(false)

  async function start() {
    try {
      setError(null)
      const s = await api('/sessions', { userId: USER_ID })
      if (s.error || s.sessionId == null)
        throw new Error(s.error ?? 'No session returned')
      setSid(s.sessionId)
      setResult(null)
      await load(s.sessionId)
    } catch (e) {
      setError(String(e))
    }
  }

  async function load(id: number) {
    const next = await api(`/sessions/${id}/next`)
    if (next.done) return showResult(id)
    deadline.current = performance.now() + next.remainingMs
    busy.current = false
    setQ(next)
  }

  async function showResult(id: number) {
    setQ(null)
    setResult(await api(`/sessions/${id}/result`))
  }

  async function submit(optionIndex: number | null) {
    if (busy.current || !q || sid == null) return
    busy.current = true
    const questionId = q.id
    setQ(null) // stops the timer
    try {
      const res = await api(`/sessions/${sid}/answer`, {
        questionId,
        optionIndex,
      })
      if (res.done) return showResult(sid)
      if (res.coach) setCoach(res.coach)
      else load(sid)
    } catch (e) {
      setError(String(e))
    }
  }

  // display-only countdown; the server enforces the real deadline
  useEffect(() => {
    if (!q) return
    const t = setInterval(() => {
      const l = deadline.current - performance.now()
      setLeft(Math.max(0, l))
      if (l <= 0) {
        clearInterval(t)
        submit(null)
      }
    }, 100)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const started = useRef(false)
  useEffect(() => {
    if (started.current) return // React StrictMode runs effects twice in dev
    started.current = true
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function coachReply(choice: string) {
    try {
      await api(`/sessions/${sid}/coach-reply`, { choice })
      setCoach(null)
      if (sid != null) load(sid)
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <h2 className='text-2xl font-bold tracking-tight'>Assessment</h2>

        {/* start screen */}
        {!q && !coach && !result && (
          <div className='space-y-2'>
            {error ? (
              <>
                <p className='text-red-500'>{error}</p>
                <button className='rounded border px-3 py-2' onClick={start}>
                  Try again
                </button>
              </>
            ) : (
              <p className='text-muted-foreground'>Loading test…</p>
            )}
          </div>
        )}

        {/* coach intervention */}
        {coach && (
          <div className='max-w-xl rounded border p-4'>
            <p className='mb-4'>{coach.message}</p>
            <div className='flex gap-2'>
              {[
                ["I'm focused", 'focused'],
                ["I'm distracted", 'distracted'],
                ["I'm rushing", 'rushing'],
              ].map(([label, value]) => (
                <button
                  key={value}
                  className='rounded border px-3 py-2'
                  onClick={() => coachReply(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* question */}
        {q && (
          <div className='max-w-2xl space-y-4'>
            <div className='text-muted-foreground text-sm'>
              Question {q.position} / {q.total}
            </div>
            <div className='bg-muted h-2 w-full rounded'>
              <div
                className={`h-2 rounded ${left < 10000 ? 'bg-red-500' : 'bg-primary'}`}
                style={{ width: `${(left / q.tMaxMs) * 100}%` }}
              />
            </div>
            <p className='whitespace-pre-line font-medium'>{q.prompt}</p>
            {q.image && (
              <img src={`/images/${q.image}`} alt='' className='max-h-72' />
            )}
            <div className='grid gap-2'>
              {q.options.map((o, i) => (
                <button
                  key={i}
                  className='rounded border p-3 text-left hover:bg-accent'
                  onClick={() => submit(i)}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* result */}
        {result && (
          <div className='max-w-xl space-y-2'>
            {result.reliability === 'low' ? (
              <p>
                Inconclusive. Many answers were implausibly fast, so this result
                doesn&apos;t reflect your ability. Please retake when you can
                focus.
              </p>
            ) : (
              <>
                <p className='text-xl font-bold'>
                  Global score: {Math.round(result.globalScore)}
                </p>
                <p>Reliability: {result.reliability}</p>
                <p>Accuracy: {Math.round(result.adjusted.accuracy)}</p>
                <p>Speed: {Math.round(result.adjusted.speed)}</p>
              </>
            )}
            <button className='rounded border px-3 py-2' onClick={start}>
              Retake
            </button>
          </div>
        )}
      </Main>
    </>
  )
}