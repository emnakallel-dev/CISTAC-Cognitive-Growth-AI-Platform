// Single place that knows whether Clerk is configured.
// Without VITE_CLERK_PUBLISHABLE_KEY the app keeps working in demo mode.
export const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
export const HAS_CLERK = Boolean(CLERK_KEY)