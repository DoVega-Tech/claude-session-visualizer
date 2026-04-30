'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { sessionsPerDay } from '@/lib/sessions/aggregator'
import type { SessionMeta } from '@/lib/sessions/types'
import { ChartCard } from './chart-card'

const CHART_COLORS = [
  'hsl(264 80% 65%)', 'hsl(190 80% 55%)', 'hsl(150 60% 55%)',
  'hsl(30 85% 60%)', 'hsl(340 75% 65%)',
]

export function SessionsPerDay({ sessions }: { sessions: SessionMeta[] }) {
  const data = sessionsPerDay(sessions)
  const projectIds = [...new Set(sessions.map(s => s.projectId))]

  return (
    <ChartCard title="Sessions per day" subtitle="Stacked by project">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" vertical={false} />
          <XAxis dataKey="date" stroke="hsl(0 0% 60%)" fontSize={11} />
          <YAxis stroke="hsl(0 0% 60%)" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: 'hsl(0 0% 7%)',
              border: '1px solid hsl(0 0% 14%)',
              borderRadius: 8, fontSize: 12,
            }}
          />
          {projectIds.map((pid, i) => (
            <Bar key={pid} dataKey={pid} stackId="a"
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              radius={i === projectIds.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
