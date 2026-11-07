import {
  LayoutDashboard,
  Monitor,
  ListTodo,
  HelpCircle,
  Bell,
  Package,
  Palette,
  Settings,
  Wrench,
  UserCog,
  MessagesSquare,
  Command,
} from 'lucide-react'
import { type SidebarData } from '../types'




export const sidebarData: SidebarData = {
  user: { name: 'Demo user', email: 'demo@brainpal.app', avatar: '' },
teams: [{ name: 'BrainPal', logo: Command, plan: 'Cognitive growth' }],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Brain Twin', 
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Take the test', 
          url: '/tasks',
          icon: ListTodo,
        },
        {
          title: 'Improve', 
          url: '/apps',
          icon: Package,
        },
        {
          title: 'Coach',
          url: '/chats',
          badge: '3',
          icon: MessagesSquare,
        },
        
        
      ],
    },
    {
      title: 'Pages',
      items: [
        
        
      ],
    },
    {
      title: 'Other',
      items: [
        {
          title: 'Settings',
          icon: Settings,
          items: [
            {
              title: 'Profile',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: 'Account',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: 'Appearance',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: 'Display',
              url: '/settings/display',
              icon: Monitor,
            },
          ],
        },
        {
          title: 'How it works',
          url: '/help-center/how-it-works-content',
          icon: HelpCircle,
        },
      ],
    },
  ],
}

