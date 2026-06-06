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
    <div className="min-h-[100dvh] flex flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/60">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 bg-zinc-100 rounded-md">
              <Flag className="h-3.5 w-3.5 text-zinc-900" />
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
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-800/40 border border-zinc-800 rounded-full text-xs text-zinc-400 mb-8">
          <Zap className="h-3 w-3" />
          Open source &middot; self-hostable
        </div>

        <h1 className="text-5xl font-semibold tracking-tight text-zinc-50 mb-4 text-center leading-tight">
          Ship features safely
          <br />
          <span className="text-zinc-400">with feature flags</span>
        </h1>

        <p className="text-base text-zinc-500 mb-10 max-w-lg text-center leading-relaxed">
          Percentage rollouts, user targeting, environments, and audit logs.
          A LaunchDarkly alternative you can run yourself.
        </p>

        <div className="flex items-center gap-3">
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

      <section className="max-w-5xl mx-auto px-6 pb-24 w-full">
        <div className="grid sm:grid-cols-3 gap-px bg-zinc-800/60 rounded-xl overflow-hidden">
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
            description="Every change logged. Role-based access for teams of any size."
          />
        </div>
      </section>

      <footer className="border-t border-zinc-800/60">
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
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="bg-zinc-950 p-6">
      <div className="flex items-center justify-center w-8 h-8 bg-zinc-800/60 rounded-lg mb-3">
        <Icon className="h-4 w-4 text-zinc-400" />
      </div>
      <h3 className="font-medium text-zinc-200 text-sm mb-1">{title}</h3>
      <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
    </div>
  )
}