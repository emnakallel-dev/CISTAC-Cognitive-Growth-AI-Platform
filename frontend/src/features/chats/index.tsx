import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { CoachChat } from './coach-chat'

export function Chats() {
  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main fixed>
        <h1 className='mb-3 text-2xl font-bold tracking-tight'>Coach</h1>
        <div className='min-h-0 flex-1'>
          <CoachChat />
        </div>
      </Main>
    </>
  )
}