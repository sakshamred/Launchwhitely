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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function extractProjectId(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/)
  const segment = match?.[1]
  return segment && UUID_RE.test(segment) ? segment : null
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()
  const projectId = extractProjectId(pathname)

  return (
    <aside className="w-60 h-full bg-black border-r border-zinc-800/60 flex flex-col flex-shrink-0">
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-zinc-800/60 flex-shrink-0">
        <div className="flex items-center justify-center w-7 h-7 bg-zinc-100 rounded-md flex-shrink-0">
          <Flag className="h-3.5 w-3.5 text-zinc-900" />
        </div>
        <span className="font-semibold text-zinc-100 text-sm tracking-tight">Launchwhitly</span>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {projectId ? (
          <>
            <Link
              href="/projects"
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors mb-2"
            >
              <FolderKanban className="h-3 w-3" />
              All Projects
            </Link>
            <div className="h-px bg-zinc-800/60 mx-3 my-1.5" />
            {projectNavItems.map(({ segment, label, icon: Icon }) => {
              const href = `/projects/${projectId}${segment}`
              const isActive =
                segment === ''
                  ? pathname === href || pathname === href + '/'
                  : pathname.startsWith(href)

              return (
                <Link
                  key={segment}
                  href={href}
                  className={[
                    'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-zinc-800/60 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40',
                  ].join(' ')}
                >
                  <Icon className="h-[14px] w-[14px] flex-shrink-0" />
                  {label}
                </Link>
              )
            })}
          </>
        ) : (
          <Link
            href="/projects"
            className={[
              'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors',
              pathname.startsWith('/projects')
                ? 'bg-zinc-800/60 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40',
            ].join(' ')}
          >
            <FolderKanban className="h-[14px] w-[14px] flex-shrink-0" />
            Projects
          </Link>
        )}
      </nav>

      <div className="border-t border-zinc-800/60 px-2 py-2 space-y-0.5">
        {userEmail && (
          <p className="text-zinc-600 text-[11px] truncate px-3 py-1">{userEmail}</p>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40 transition-colors"
          >
            <LogOut className="h-[14px] w-[14px] flex-shrink-0" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}