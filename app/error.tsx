'use client'
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-xl font-medium">Something went wrong</h2>
        <p className="text-sm text-muted-foreground font-mono">{error.message}</p>
        <button
          onClick={reset}
          className="text-sm px-4 py-2 rounded bg-accent text-accent-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
