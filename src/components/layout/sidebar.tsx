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
  ChevronLeft,
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
  const id = match?.[1] ?? null
  // `/projects/new` is not a real project id
  return id === 'new' ? null : id
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()
  const projectId = extractProjectId(pathname)

  return (
    <aside className="w-64 h-full bg-zinc-950 border-r border-zinc-800/80 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-zinc-800/80">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-[0_0_14px_-2px_rgba(99,102,241,0.6)]">
          <Flag className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold text-zinc-50 text-[15px] tracking-tight">
          Launchwhitly
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {projectId ? (
          <>
            <Link
              href="/projects"
              className="group flex items-center gap-2 px-2.5 py-2 mb-4 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              All projects
            </Link>

            <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-600">
              Project
            </p>

            <div className="space-y-0.5">
              {projectNavItems.map(({ segment, label, icon: Icon }) => {
                const href = `/projects/${projectId}${segment}`
                const isActive =
                  segment === ''
                    ? pathname === href || pathname === href + '/'
                    : pathname.startsWith(href)

                return <NavLink key={segment} href={href} label={label} Icon={Icon} active={isActive} />
              })}
            </div>
          </>
        ) : (
          <>
            <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-600">
              Workspace
            </p>
            <NavLink
              href="/projects"
              label="Projects"
              Icon={Flag}
              active={pathname.startsWith('/projects')}
            />
          </>
        )}
      </nav>

      {/* User / Sign-out */}
      <div className="border-t border-zinc-800/80 p-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          {userEmail && (
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 text-xs font-semibold uppercase flex-shrink-0">
              {userEmail.charAt(0)}
            </div>
          )}
          <p className="flex-1 text-zinc-400 text-xs truncate">{userEmail}</p>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}

function NavLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string
  label: string
  Icon: typeof Flag
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={[
        'group relative flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors',
        active
          ? 'bg-zinc-900 text-zinc-50'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60',
      ].join(' ')}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-indigo-500" />
      )}
      <Icon
        className={[
          'h-4 w-4 flex-shrink-0 transition-colors',
          active ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-300',
        ].join(' ')}
      />
      {label}
    </Link>
  )
}
