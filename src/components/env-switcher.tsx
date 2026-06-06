'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

export interface EnvSwitcherEnvironment {
  id: string
  name: string
  slug: string
  color: string
}

export interface EnvSwitcherProps {
  environments: EnvSwitcherEnvironment[]
  /** Default env id from server (first env). Client overrides with URL param. */
  current: string
  projectId: string
}

export function EnvSwitcher({ environments, current, projectId: _projectId }: EnvSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const envId = searchParams.get('env') ?? current
  const currentEnv = environments.find((e) => e.id === envId) ?? environments[0]

  if (!currentEnv) return null

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('env', e.target.value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="relative inline-flex items-center">
      {/* Color swatch */}
      <span
        className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none flex-shrink-0"
        style={{ backgroundColor: currentEnv.color }}
      />
      <select
        value={currentEnv.id}
        onChange={handleChange}
        className="appearance-none bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg pl-7 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:border-zinc-600 transition-colors"
      >
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
    </div>
  )
}
