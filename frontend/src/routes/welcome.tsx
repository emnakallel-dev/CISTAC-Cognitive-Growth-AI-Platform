import { createFileRoute } from '@tanstack/react-router'
import { Landing } from '@/features/landing'

export const Route = createFileRoute('/welcome')({
  component: Landing,
})