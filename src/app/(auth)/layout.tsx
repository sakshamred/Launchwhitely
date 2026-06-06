import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen bg-zinc-950 flex items-center justify-center p-6 overflow-hidden">
      {/* Ambient layers */}
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-glow" />
      <div className="relative w-full max-w-sm animate-rise">{children}</div>
    </main>
  )
}