'use client'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { tokensPerDay } from '@/lib/sessions/aggregator'
import type { SessionMeta } from '@/lib/sessions/types'
import { ChartCard } from './chart-card'

export function TokensPerDay({ sessions }: { sessions: SessionMeta[] }) {
  const data = tokensPerDay(sessions)
  return (
    <ChartCard title="Tokens per day" subtitle="Input / output / cache">
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
          <Area type="monotone" dataKey="cacheRead"   stackId="1" stroke="hsl(150 60% 55%)" fill="hsl(150 60% 55%)" fillOpacity={0.4} />
          <Area type="monotone" dataKey="cacheCreate" stackId="1" stroke="hsl(30 85% 60%)" fill="hsl(30 85% 60%)" fillOpacity={0.4} />
          <Area type="monotone" dataKey="input"       stackId="1" stroke="hsl(190 80% 55%)" fill="hsl(190 80% 55%)" fillOpacity={0.5} />
          <Area type="monotone" dataKey="output"      stackId="1" stroke="hsl(264 80% 65%)" fill="hsl(264 80% 65%)" fillOpacity={0.6} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
