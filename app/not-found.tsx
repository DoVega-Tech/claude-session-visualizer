import Link from 'next/link'
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-medium">Session not found</h2>
        <p className="text-sm text-muted-foreground">
          The session file no longer exists in ~/.claude/projects.
        </p>
        <Link href="/" className="text-sm underline">Back to dashboard</Link>
      </div>
    </div>
  )
}
