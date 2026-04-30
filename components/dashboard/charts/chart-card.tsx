import { Card } from '@/components/ui/card'

export function ChartCard({
  title, subtitle, children, className = '',
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={`p-6 bg-card ${className}`}>
      <div className="mb-6">
        <h3 className="text-sm font-medium">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="h-[260px] w-full">{children}</div>
    </Card>
  )
}
