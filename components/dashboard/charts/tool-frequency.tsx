'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { toolFrequency } from '@/lib/sessions/aggregator'
import type { SessionMeta } from '@/lib/sessions/types'
import { ChartCard } from './chart-card'

export function ToolFrequency({ sessions }: { sessions: SessionMeta[] }) {
  const data = toolFrequency(sessions)
  return (
    <ChartCard title="Tool calls" subtitle="Top 10 tools">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 12 }}>
          <XAxis type="number" stroke="hsl(0 0% 60%)" fontSize={11} />
          <YAxis type="category" dataKey="name" width={80}
                 stroke="hsl(0 0% 60%)" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: 'hsl(0 0% 7%)',
              border: '1px solid hsl(0 0% 14%)',
              borderRadius: 8, fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill="hsl(264 80% 65%)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
