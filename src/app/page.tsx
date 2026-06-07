import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Flag, ArrowRight, Zap, Users, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Launchwhitly — Open-source feature flags',
}

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/projects')

  return (
    <div className="app-shell min-h-[100dvh] flex flex-col text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-black/20 backdrop-blur-2xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 via-indigo-500 to-violet-600 shadow-[0_0_16px_-2px_rgba(99,102,241,0.7),inset_0_1px_0_rgba(255,255,255,0.25)]">
              <Flag className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-zinc-100 text-sm tracking-tight">Launchwhitly</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">
                Get started
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <div className="stagger flex flex-col items-center">
          <div
            style={{ ['--i' as string]: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-white/[0.05] backdrop-blur-md border border-white/10 rounded-full text-xs text-zinc-300 mb-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-400" />
            </span>
            Open source &middot; self-hostable
          </div>

          <h1
            style={{ ['--i' as string]: 1 }}
            className="text-5xl sm:text-6xl font-semibold tracking-tight text-zinc-50 mb-4 text-center leading-[1.05]"
          >
            Ship features safely
            <br />
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-sky-300 bg-clip-text text-transparent">
              with feature flags
            </span>
          </h1>

          <p
            style={{ ['--i' as string]: 2 }}
            className="text-base text-zinc-400 mb-10 max-w-lg text-center leading-relaxed"
          >
            Percentage rollouts, user targeting, environments, and audit logs.
            A LaunchDarkly alternative you can run yourself.
          </p>

          <div style={{ ['--i' as string]: 3 }} className="flex items-center gap-3">
            <Link href="/signup">
              <Button size="lg">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                I have an account
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <section className="max-w-5xl mx-auto px-6 pb-24 w-full">
        <div className="stagger grid sm:grid-cols-3 gap-4">
          <Feature
            index={0}
            icon={Zap}
            title="Instant rollouts"
            description="Toggle flags for any environment in milliseconds. Local SDK evaluation."
          />
          <Feature
            index={1}
            icon={Users}
            title="Targeted releases"
            description="Percentage rollouts, user segments, and per-environment configuration."
          />
          <Feature
            index={2}
            icon={Lock}
            title="Audit & governance"
            description="Every change logged. Role-based access for teams of any size."
          />
        </div>
      </section>

      <footer className="border-t border-white/[0.06] bg-black/20 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between text-xs text-zinc-600">
          <span>Launchwhitly</span>
          <span>Built with Next.js &amp; Supabase</span>
        </div>
      </footer>
    </div>
  )
}

function Feature({
  icon: Icon,
  title,
  description,
  index,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  index: number
}) {
  return (
    <div style={{ ['--i' as string]: index }} className="glass glass-hover rounded-2xl p-6">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400/25 to-violet-600/10 border border-white/10 mb-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
        <Icon className="h-4 w-4 text-indigo-300" />
      </div>
      <h3 className="font-medium text-zinc-100 text-sm mb-1">{title}</h3>
      <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
    </div>
  )
}