'use client'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

const sizes = {
  sm: {
    track: 'w-8 h-4',
    thumb: 'w-3 h-3',
    on: 'translate-x-4',
    off: 'translate-x-0.5',
  },
  md: {
    track: 'w-11 h-6',
    thumb: 'w-5 h-5',
    on: 'translate-x-5',
    off: 'translate-x-0.5',
  },
}

export function Toggle({ checked, onChange, disabled = false, size = 'md' }: ToggleProps) {
  const { track, thumb, on, off } = sizes[size]

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        track,
        checked ? 'bg-indigo-600' : 'bg-zinc-700',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block bg-white rounded-full shadow transition-transform',
          thumb,
          checked ? on : off,
        ].join(' ')}
      />
    </button>
  )
}
