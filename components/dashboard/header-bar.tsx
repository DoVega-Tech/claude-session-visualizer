'use client'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RefreshCw } from 'lucide-react'
import { refreshSessions } from '@/app/actions'
import type { DateRange } from './dashboard-client'

interface Props {
  range: DateRange
  onRangeChange: (r: DateRange) => void
  projects: Array<{ id: string; label: string }>
  selected: string[]
  onSelectedChange: (s: string[]) => void
}

export function HeaderBar({ range, onRangeChange, projects, selected, onSelectedChange }: Props) {
  const toggle = (id: string) =>
    onSelectedChange(selected.includes(id) ? selected.filter(p => p !== id) : [...selected, id])

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-[1400px] px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-md bg-accent" />
          <h1 className="text-sm font-medium tracking-tight">Claude Session Visualizer</h1>
        </div>

        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => onRangeChange(v as DateRange)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1 cursor-pointer"
            >
              Projects {selected.length > 0 && `(${selected.length})`}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Filter by project</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {projects.map(p => (
                <DropdownMenuCheckboxItem
                  key={p.id}
                  checked={selected.includes(p.id)}
                  onCheckedChange={() => toggle(p.id)}
                >
                  {p.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <form action={refreshSessions}>
            <Button type="submit" variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
