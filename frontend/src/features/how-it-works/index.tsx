// /frontend/src/features/how-it-works/index.tsx
import { useState } from 'react'
import {
    BadgeCheck,
    BookOpen,
    Box,
    Calculator,
    Compass,
    Info,
    MessageCircle,
    Puzzle,
    Repeat,
    ShieldCheck,
    Sparkles,
    Target,
    Timer,
    TrendingUp,
    type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'

/* -------------------------------------------------------------------------- */
/*  Content                                                                   */
/* -------------------------------------------------------------------------- */

// Must mirror the constants in the scoring module (SCORING_VERSION 'v2').
const GLOBAL_WEIGHTS = { accuracy: 0.7, speed: 0.3 }

const COLLAB_WEIGHTS = {
    clarification: 0.2,
    critical_verification: 0.25,
    iteration: 0.2,
    autonomy: 0.2,
    responsible_use: 0.15,
} as const

type CollabKey = keyof typeof COLLAB_WEIGHTS

const STEPS: { title: string; icon: LucideIcon; text: string }[] = [
    {
        title: 'Assess',
        icon: Target,
        text: 'You answer timed questions across four reasoning dimensions. Harder questions count for more.',
    },
    {
        title: 'Understand',
        icon: TrendingUp,
        text: 'Your answers and response times become a percentage profile, one score per dimension plus a speed score.',
    },
    {
        title: 'Coach',
        icon: Sparkles,
        text: 'You get feedback that explains which answers moved your score and what to focus on next.',
    },
    {
        title: 'Improve',
        icon: Compass,
        text: 'New exercises adapt to your weakest dimensions, and your learning path tracks measurable progress.',
    },
]

const DIMENSIONS: { title: string; icon: LucideIcon; text: string }[] = [
    {
        title: 'Logical reasoning',
        icon: Puzzle,
        text: 'Spotting patterns, following rules and drawing valid conclusions from a set of statements.',
    },
    {
        title: 'Numerical reasoning',
        icon: Calculator,
        text: 'Working with figures, ratios and tables to reach the right quantity quickly.',
    },
    {
        title: 'Verbal reasoning',
        icon: BookOpen,
        text: 'Understanding written arguments, finding what a text supports and what it does not.',
    },
    {
        title: 'Spatial reasoning',
        icon: Box,
        text: 'Picturing shapes, rotations and layouts in your head and comparing them.',
    },
]

const COLLAB: {
    key: CollabKey
    label: string
    icon: LucideIcon
    text: string
}[] = [
        {
            key: 'clarification',
            label: 'Clarification',
            icon: MessageCircle,
            text: 'You state your goal clearly and ask follow-up questions when the AI’s answer is vague.',
        },
        {
            key: 'critical_verification',
            label: 'Critical verification',
            icon: BadgeCheck,
            text: 'You check the AI’s answers against your own reasoning instead of accepting them as they are.',
        },
        {
            key: 'iteration',
            label: 'Iteration',
            icon: Repeat,
            text: 'You refine your requests and build on earlier answers to get closer to a good result.',
        },
        {
            key: 'autonomy',
            label: 'Autonomy',
            icon: Compass,
            text: 'You try the problem yourself first and use the AI as support, not as a replacement.',
        },
        {
            key: 'responsible_use',
            label: 'Responsible use',
            icon: ShieldCheck,
            text: 'You use AI help where it is allowed and stay honest about what came from you.',
        },
    ]

/* -------------------------------------------------------------------------- */
/*  Small building blocks                                                     */
/* -------------------------------------------------------------------------- */

function FormulaBlock({ children }: { children: React.ReactNode }) {
    return (
        <pre className='bg-muted overflow-x-auto rounded-md border p-3 font-mono text-sm leading-relaxed'>
            {children}
        </pre>
    )
}

function Var({ name, children }: { name: string; children: React.ReactNode }) {
    return (
        <li className='flex gap-2 text-sm'>
            <code className='bg-muted h-fit rounded px-1.5 py-0.5 font-mono text-xs'>
                {name}
            </code>
            <span className='text-muted-foreground'>{children}</span>
        </li>
    )
}

function SliderRow({
    id,
    label,
    value,
    onChange,
    hint,
}: {
    id: string
    label: string
    value: number
    onChange: (v: number) => void
    hint?: string
}) {
    return (
        <div className='space-y-1.5'>
            <div className='flex items-baseline justify-between gap-2'>
                <label htmlFor={id} className='text-sm font-medium'>
                    {label}
                    {hint && (
                        <span className='text-muted-foreground ms-2 text-xs font-normal'>
                            {hint}
                        </span>
                    )}
                </label>
                <span className='text-sm tabular-nums'>{value}</span>
            </div>
            <input
                id={id}
                type='range'
                min={0}
                max={100}
                step={1}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className='accent-primary w-full'
            />
        </div>
    )
}

/* -------------------------------------------------------------------------- */
/*  Tabs                                                                      */
/* -------------------------------------------------------------------------- */

function OverviewTab() {
    return (
        <div className='space-y-4'>
            <Card>
                <CardHeader>
                    <CardTitle>Four steps, repeated</CardTitle>
                    <CardDescription>
                        Each round of questions feeds the next one, so the platform gets
                        more precise about you over time.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ol className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
                        {STEPS.map(({ title, icon: Icon, text }, i) => (
                            <li key={title} className='flex flex-col gap-2'>
                                <div className='flex items-center gap-2'>
                                    <span className='bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full text-xs font-semibold'>
                                        {i + 1}
                                    </span>
                                    <Icon className='text-muted-foreground size-4' aria-hidden />
                                    <h3 className='font-semibold'>{title}</h3>
                                </div>
                                <p className='text-muted-foreground text-sm'>{text}</p>
                            </li>
                        ))}
                    </ol>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>What you are assessed on</CardTitle>
                    <CardDescription>
                        Four reasoning dimensions, each scored from 0 to 100%.
                    </CardDescription>
                </CardHeader>
                <CardContent className='grid gap-4 sm:grid-cols-2'>
                    {DIMENSIONS.map(({ title, icon: Icon, text }) => (
                        <div key={title} className='flex gap-3'>
                            <div className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-md'>
                                <Icon className='size-4' aria-hidden />
                            </div>
                            <div>
                                <h3 className='font-semibold'>{title}</h3>
                                <p className='text-muted-foreground text-sm'>{text}</p>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardContent className='flex gap-3 pt-6'>
                    <Info className='text-muted-foreground mt-0.5 size-4 shrink-0' />
                    <p className='text-muted-foreground text-sm'>
                        This is a learning tool, not a clinical test. Your scores describe
                        how you performed on these tasks today. They do not diagnose
                        anything or measure intelligence, and they can change as you
                        practice.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}

function ScoringTab() {
    const [accuracy, setAccuracy] = useState(80)
    const [speed, setSpeed] = useState(40)
    const global =
        GLOBAL_WEIGHTS.accuracy * accuracy + GLOBAL_WEIGHTS.speed * speed

    return (
        <div className='space-y-4'>
            <Card>
                <CardHeader>
                    <CardTitle>Category score</CardTitle>
                    <CardDescription>
                        How many questions you got right in one dimension, with harder
                        questions counting more.
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    <FormulaBlock>
                        Category Score = (Σ(correct × W) / Σ(W)) × 100
                    </FormulaBlock>
                    <ul className='space-y-1.5'>
                        <Var name='correct'>1 if you answered correctly, otherwise 0.</Var>
                        <Var name='W'>The weight of the question.</Var>
                    </ul>
                    <p className='text-muted-foreground text-sm'>
                        Example: three questions weighted 1, 2 and 3. You get the first and
                        the last right, so (1 + 3) / 6 × 100 = 66.7%.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Speed score</CardTitle>
                    <CardDescription>
                        Rewards correct answers given well before the deadline.
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    <FormulaBlock>
                        {`Speed Ratio = (T_max − T_user) / T_max
Speed Score = (Σ(W × Speed Ratio) / Σ(W)) × 100`}
                    </FormulaBlock>
                    <ul className='space-y-1.5'>
                        <Var name='T_max'>The time allowed for the question.</Var>
                        <Var name='T_user'>The time you took to answer.</Var>
                        <Var name='Speed Ratio'>
                            0 if you missed the deadline or answered incorrectly.
                        </Var>
                    </ul>
                    <p className='text-muted-foreground text-sm'>
                        Example: with 60 seconds allowed, a correct answer after 45 seconds
                        has a Speed Ratio of (60 − 45) / 60 = 0.25. A wrong answer always
                        scores 0, however fast it was.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Accuracy and global score</CardTitle>
                    <CardDescription>
                        Accuracy averages your four dimensions. The global score blends
                        accuracy and speed.
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    <FormulaBlock>
                        {`Accuracy Score = (Logical + Numerical + Verbal + Spatial) / 4
Global Score   = (0.7 × Accuracy Score) + (0.3 × Speed Score)`}
                    </FormulaBlock>

                    <div className='bg-muted/40 space-y-4 rounded-md border p-4'>
                        <div className='flex items-center gap-2'>
                            <Timer className='text-muted-foreground size-4' aria-hidden />
                            <h3 className='text-sm font-semibold'>Try it</h3>
                        </div>
                        <div className='grid gap-4 sm:grid-cols-2'>
                            <SliderRow
                                id='try-accuracy'
                                label='Accuracy Score'
                                value={accuracy}
                                onChange={setAccuracy}
                            />
                            <SliderRow
                                id='try-speed'
                                label='Speed Score'
                                value={speed}
                                onChange={setSpeed}
                            />
                        </div>
                        <p className='text-sm' aria-live='polite'>
                            Global Score = 0.7 × {accuracy} + 0.3 × {speed} ={' '}
                            <strong className='tabular-nums'>{global.toFixed(1)}%</strong>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function CollaborationTab() {
    const [scores, setScores] = useState<Record<CollabKey, number>>({
        clarification: 70,
        critical_verification: 60,
        iteration: 75,
        autonomy: 65,
        responsible_use: 90,
    })

    const total = COLLAB.reduce(
        (sum, { key }) => sum + COLLAB_WEIGHTS[key] * scores[key],
        0
    )

    return (
        <div className='space-y-4'>
            <Card>
                <CardHeader>
                    <CardTitle>AI collaboration score</CardTitle>
                    <CardDescription>
                        Measures how well you work with an AI assistant, not only how well
                        you solve problems alone.
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    <FormulaBlock>
                        {`AI Collaboration Score =
  0.20 × Clarification
+ 0.25 × Critical verification
+ 0.20 × Iteration
+ 0.20 × Autonomy
+ 0.15 × Responsible use`}
                    </FormulaBlock>
                    <div className='grid gap-4 sm:grid-cols-2'>
                        {COLLAB.map(({ key, label }) => (
                            <SliderRow
                                key={key}
                                id={`try-${key}`}
                                label={label}
                                value={scores[key]}
                                onChange={(value) =>
                                    setScores((current) => ({
                                        ...current,
                                        [key]: value,
                                    }))
                                }
                            />
                        ))}
                    </div>
                    <p className='text-sm' aria-live='polite'>
                        AI Collaboration Score ={' '}
                        <strong className='tabular-nums'>{total.toFixed(1)}%</strong>
                    </p>
                    <p className='text-muted-foreground text-sm'>
                        Each component is scored from 0 to 100, and the weights add up to
                        100%. Critical verification carries the most weight because checking
                        AI output is the habit that protects you from its mistakes.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>The five components</CardTitle>
                </CardHeader>
                <CardContent className='space-y-5'>
                    {COLLAB.map(({ key, label, icon: Icon, text }) => {
                        const pct = Math.round(COLLAB_WEIGHTS[key] * 100)
                        return (
                            <div key={key} className='space-y-2'>
                                <div className='flex items-center justify-between gap-2'>
                                    <div className='flex items-center gap-2'>
                                        <Icon
                                            className='text-muted-foreground size-4'
                                            aria-hidden
                                        />
                                        <h3 className='font-semibold'>{label}</h3>
                                    </div>
                                    <span className='text-sm font-medium tabular-nums'>
                                        {pct}%
                                    </span>
                                </div>
                                <div
                                    className='bg-muted h-2 overflow-hidden rounded-full'
                                    role='img'
                                    aria-label={`${label} weighs ${pct}% of the score`}
                                >
                                    <div
                                        className={cn('bg-primary h-full rounded-full')}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <p className='text-muted-foreground text-sm'>{text}</p>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>
        </div>
    )
}

export function HowItWorks() {
  return (
    <div className='space-y-6'>
      <OverviewTab />
      <ScoringTab />
      <CollaborationTab />
    </div>
  )
}