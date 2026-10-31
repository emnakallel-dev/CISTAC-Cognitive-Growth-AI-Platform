import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Msg = { role: 'user' | 'assistant'; content: string }
type Collab = {
  total: number
  clarification: number
  critical_verification: number
  iteration: number
  autonomy: number
  responsible_use: number
}

export function CoachChat() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [collab, setCollab] = useState<Collab | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/chat/history')
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => setError('Could not load the conversation.'))
    fetch('/api/collaboration')
      .then((r) => r.json())
      .then((d) => setCollab(d.scores?.at(-1) ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const content = text.trim()
    if (!content || busy) return
    setText('')
    setError(null)
    setBusy(true)
    setMessages((m) => [...m, { role: 'user', content }])
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.')
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }])
      if (data.collaboration) setCollab(data.collaboration)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>
      <div className='rounded-md border p-3 text-sm'>
        {collab ? (
          <>
            <div className='font-medium'>AI collaboration score: {collab.total}/100</div>
            <div className='text-muted-foreground'>
              Clarification {collab.clarification} · Verification {collab.critical_verification} · Iteration{' '}
              {collab.iteration} · Autonomy {collab.autonomy} · Responsible use {collab.responsible_use}
            </div>
          </>
        ) : (
          <span className='text-muted-foreground'>
            Send a few messages to see your AI collaboration score.
          </span>
        )}
      </div>

      <div className='flex-1 space-y-3 overflow-y-auto rounded-md border p-3'>
        {messages.length === 0 && (
          <p className='text-muted-foreground text-sm'>
            Ask your coach something, for example: How am I doing in spatial?
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && <p className='text-muted-foreground text-sm'>Your coach is thinking…</p>}
        <div ref={bottom} />
      </div>

      {error && <p className='text-destructive text-sm' role='alert'>{error}</p>}
      <div className='flex gap-2'>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder='Ask your coach…'
        />
        <Button onClick={send} disabled={busy}>Send</Button>
      </div>
    </div>
  )
}