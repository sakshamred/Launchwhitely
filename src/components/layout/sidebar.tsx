'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Flag,
  ToggleLeft,
  Globe,
  Key,
  Users,
  ScrollText,
  Settings,
  LogOut,
  FolderKanban,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'

export interface SidebarProps {
  userEmail?: string
}

const projectNavItems = [
  { segment: '', label: 'Feature Flags', icon: ToggleLeft },
  { segment: '/environments', label: 'Environments', icon: Globe },
  { segment: '/api-keys', label: 'API Keys', icon: Key },
  { segment: '/members', label: 'Members', icon: Users },
  { segment: '/audit-logs', label: 'Audit Log', icon: ScrollText },
  { segment: '/settings', label: 'Settings', icon: Settings },
]

/** Extract projectId from a pathname like /projects/[id]/... */
function extractProjectId(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/)
  return match?.[1] ?? null
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()
  const projectId = extractProjectId(pathname)

  return (
    <aside className="w-64 h-full bg-zinc-900 border-r border-zinc-800 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-zinc-800">
        <div className="flex items-center justify-center w-8 h-8 bg-indigo-600 rounded-lg flex-shrink-0">
          <Flag className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold text-zinc-100 text-sm tracking-tight">Launchwhitly</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {projectId ? (
          <>
            {/* Back to all projects */}
            <Link
              href="/projects"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors mb-3"
            >
              <FolderKanban className="h-3.5 w-3.5" />
              All Projects
            </Link>
            {projectNavItems.map(({ segment, label, icon: Icon }) => {
              const href = `/projects/${projectId}${segment}`
              // Active: exact match for root segment, prefix match for others
              const isActive =
                segment === ''
                  ? pathname === href || pathname === href + '/'
                  : pathname.startsWith(href)

              return (
                <Link
                  key={segment}
                  href={href}
                  className={[
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </Link>
              )
            })}
          </>
        ) : (
          <Link
            href="/projects"
            className={[
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname.startsWith('/projects')
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50',
            ].join(' ')}
          >
            <FolderKanban className="h-4 w-4 flex-shrink-0" />
            Projects
          </Link>
        )}
      </nav>

      {/* User / Sign-out */}
      <div className="border-t border-zinc-800 px-3 py-3 space-y-0.5">
        {userEmail && (
          <p className="text-zinc-500 text-xs truncate px-3 py-1">{userEmail}</p>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
