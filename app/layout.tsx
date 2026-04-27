import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const sans = Geist({ subsets: ['latin'], variable: '--font-sans' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Claude Session Visualizer',
  description: 'Timeline and analytics for your Claude Code sessions',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' className={`dark ${sans.variable} ${mono.variable}`}>
      <body className='font-sans min-h-full flex flex-col antialiased'>
        {children}
      </body>
    </html>
  )
}
