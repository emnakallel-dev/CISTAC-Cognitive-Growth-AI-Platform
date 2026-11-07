import { useClerk, useUser } from '@clerk/react'
import { HAS_CLERK } from '@/lib/clerk-config'

export type CurrentUser = {
  name: string
  email: string
  avatar: string
  signedIn: boolean
}

const DEMO: CurrentUser = {
  name: 'Demo user',
  email: 'demo@brainpal.app',
  avatar: '',
  signedIn: false,
}

function useClerkCurrentUser(): CurrentUser {
  const { isSignedIn, user } = useUser()
  if (!isSignedIn || !user) return DEMO
  const email = user.primaryEmailAddress?.emailAddress ?? ''
  return {
    name: user.fullName || user.username || email || 'You',
    email,
    avatar: user.imageUrl,
    signedIn: true,
  }
}

function useDemoUser(): CurrentUser {
  return DEMO
}

// HAS_CLERK is fixed when the app loads, so the same hook is used on every render.
export const useCurrentUser = HAS_CLERK ? useClerkCurrentUser : useDemoUser

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  )
}

function useClerkSignOut() {
  const { signOut } = useClerk()
  return () => {
    void signOut({ redirectUrl: '/clerk/sign-in' })
  }
}

function useNoSignOut() {
  return () => {}
}

// Signs the Clerk user out. Does nothing when Clerk is not configured.
export const useSignOut = HAS_CLERK ? useClerkSignOut : useNoSignOut