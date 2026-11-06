import { createFileRoute } from '@tanstack/react-router'
import { HowItWorks } from '@/features/how-it-works'

export const Route = createFileRoute('/_authenticated/help-center/how-it-works-content')({
  component: HowItWorks,
})