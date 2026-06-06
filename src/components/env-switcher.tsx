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
      <span
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none flex-shrink-0"
        style={{ backgroundColor: currentEnv.color }}
      />
      <select
        value={currentEnv.id}
        onChange={handleChange}
        className="appearance-none bg-zinc-800/60 border border-zinc-800 text-zinc-300 rounded-md pl-5 pr-7 h-7 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-zinc-600 cursor-pointer hover:border-zinc-700 transition-colors"
      >
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500 pointer-events-none" />
    </div>
  )
}