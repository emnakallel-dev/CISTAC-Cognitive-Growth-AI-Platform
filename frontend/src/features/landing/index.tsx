import { Link } from '@tanstack/react-router'
import {
  ClipboardList,
  LineChart,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const steps = [
  { icon: ClipboardList, title: 'Assess', text: 'Short tasks explore different thinking skills.' },
  { icon: LineChart, title: 'Understand', text: 'See your profile as percentages, with the uncertainty shown.' },
  { icon: MessageCircle, title: 'Coach', text: 'Personal, plain-language feedback that explains itself.' },
  { icon: TrendingUp, title: 'Improve', text: 'Exercises that adapt as you grow.' },
]

function RadarIllustration() {
  return (
    <svg viewBox='0 0 300 300' className='h-full w-full'>
      <g className='stroke-border' fill='none' strokeWidth='1.5'>
        <polygon points='150,50 245,119 209,231 91,231 55,119' />
        <polygon points='150,84 213,130 189,203 111,203 87,130' />
        <polygon points='150,117 181,140 169,177 131,177 119,140' />
        <line x1='150' y1='150' x2='150' y2='50' />
        <line x1='150' y1='150' x2='245' y2='119' />
        <line x1='150' y1='150' x2='209' y2='231' />
        <line x1='150' y1='150' x2='91' y2='231' />
        <line x1='150' y1='150' x2='55' y2='119' />
      </g>
      <polygon
        points='150,70 207,131 203,223 121,190 83,128'
        className='fill-primary/25 stroke-primary'
        strokeWidth='2.5'
        strokeLinejoin='round'
      />
      {[[150, 70], [207, 131], [203, 223], [121, 190], [83, 128]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r='5' className='fill-primary' />
      ))}
    </svg>
  )
}

export function Landing() {
  return (
    <div className='relative min-h-svh overflow-hidden bg-background'>
      <div className='pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl' />
      <div className='pointer-events-none absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl' />

      <header className='relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5'>
        <span className='text-lg font-semibold'>BrainPal</span>
        <div className='flex gap-2'>
          <Button asChild variant='ghost'>
            <Link to='/sign-in'>Sign in</Link>
          </Button>
          <Button asChild>
            <Link to='/sign-up'>Sign up</Link>
          </Button>
        </div>
      </header>

      <main className='relative mx-auto max-w-6xl px-6'>
        <section className='grid items-center gap-10 py-12 md:grid-cols-2 md:py-20'>
          <div className='space-y-6'>
            <span className='inline-block rounded-full border bg-background/60 px-3 py-1 text-sm text-muted-foreground'>
              Not a test. Not a diagnosis.
            </span>
            <h1 className='text-4xl font-bold tracking-tight md:text-5xl'>
              Grow your thinking skills, one step at a time
            </h1>
            <p className='max-w-lg text-lg text-muted-foreground'>
              A personal coach that learns how you work and adapts to you,
              instead of giving you a one-time score.
            </p>
            <div className='flex gap-3'>
              <Button size='lg' asChild>
                <Link to='/sign-up'>Get started</Link>
              </Button>
              <Button size='lg' variant='outline' asChild>
                <Link to='/sign-in'>I already have an account</Link>
              </Button>
            </div>
          </div>
          <div className='mx-auto aspect-square w-full max-w-md rounded-3xl border bg-card/60 p-6 shadow-lg backdrop-blur'>
            <RadarIllustration />
          </div>
        </section>

        <section className='grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-4'>
          {steps.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className='rounded-2xl border bg-card/60 p-5 backdrop-blur'>
              <div className='mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                <Icon className='h-5 w-5' />
              </div>
              <h3 className='font-semibold'>
                {i + 1}. {title}
              </h3>
              <p className='mt-1 text-sm text-muted-foreground'>{text}</p>
            </div>
          ))}
        </section>

        <section className='mb-16 flex items-start gap-3 rounded-2xl border bg-muted/40 p-5'>
          <ShieldCheck className='mt-0.5 h-5 w-5 shrink-0 text-primary' />
          <p className='text-sm text-muted-foreground'>
            Your data is yours: you choose what to share, camera and voice are
            optional, and you can delete everything at any time. Results are
            estimates and always show their uncertainty.
          </p>
        </section>
      </main>
    </div>
  )
}