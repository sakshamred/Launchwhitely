import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Flag, ArrowRight, Check, Zap, Lock, Users } from 'lucide-react'
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
    <div className="min-h-full flex-1 bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <header className="border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 bg-indigo-600 rounded-lg">
              <Flag className="h-4 w-4 text-white" />
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

      {/* Hero */}
      <main className="max-w-3xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs text-indigo-300 mb-8">
          <Zap className="h-3 w-3" />
          Open source &middot; self-hostable
        </div>

        <h1 className="text-5xl font-semibold tracking-tight text-zinc-50 mb-6 leading-tight">
          Ship features safely with{' '}
          <span className="text-indigo-400">feature flags</span>
        </h1>

        <p className="text-lg text-zinc-400 mb-10 max-w-xl mx-auto">
          Percentage rollouts, user targeting, environments, and audit logs. A LaunchDarkly
          alternative you can run on your own infrastructure.
        </p>

        <div className="flex items-center justify-center gap-3">
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
      </main>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid sm:grid-cols-3 gap-4">
          <Feature
            icon={Zap}
            title="Instant rollouts"
            description="Toggle flags for any environment in milliseconds. Local SDK evaluation."
          />
          <Feature
            icon={Users}
            title="Targeted releases"
            description="Percentage rollouts, user segments, and per-environment configuration."
          />
          <Feature
            icon={Lock}
            title="Audit & governance"
            description="Every change logged. Role-based access for owners, admins, and developers."
          />
        </div>
      </section>

      <footer className="border-t border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-6 text-xs text-zinc-500 flex items-center justify-between">
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
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-center w-9 h-9 bg-indigo-500/10 rounded-lg mb-3">
        <Icon className="h-4 w-4 text-indigo-400" />
      </div>
      <h3 className="font-medium text-zinc-100 text-sm mb-1">{title}</h3>
      <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
    </div>
  )
}
