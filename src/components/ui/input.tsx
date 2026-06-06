import type { InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-zinc-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          'bg-zinc-800 border text-zinc-100 rounded-lg px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
          'placeholder:text-zinc-500 transition-colors',
          error ? 'border-red-500' : 'border-zinc-700 hover:border-zinc-600',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!error && hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}
