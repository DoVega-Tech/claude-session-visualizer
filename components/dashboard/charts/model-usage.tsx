'use client'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { modelUsageOverTime } from '@/lib/sessions/aggregator'
import type { SessionMeta } from '@/lib/sessions/types'
import { ChartCard } from './chart-card'

const CHART_COLORS = [
  'hsl(264 80% 65%)', 'hsl(190 80% 55%)', 'hsl(150 60% 55%)',
  'hsl(30 85% 60%)', 'hsl(340 75% 65%)',
]

export function ModelUsage({ sessions }: { sessions: SessionMeta[] }) {
  const data = modelUsageOverTime(sessions)
  const models = [...new Set(sessions.map(s => s.model))]

  return (
    <ChartCard title="Model usage" subtitle="Sessions per model over time">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
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
          {models.map((m, i) => (
            <Area key={m} type="monotone" dataKey={m} stackId="1"
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={0.4}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
