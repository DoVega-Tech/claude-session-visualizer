'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { avgSessionLength } from '@/lib/sessions/aggregator'
import type { SessionMeta } from '@/lib/sessions/types'
import { ChartCard } from './chart-card'

export function AvgSessionLength({ sessions }: { sessions: SessionMeta[] }) {
  const data = avgSessionLength(sessions)
  return (
    <ChartCard title="Avg session length" subtitle="Messages per session">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
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
          <Line type="monotone" dataKey="avgMessages"
                stroke="hsl(264 95% 70%)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
