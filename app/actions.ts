'use server'
import { revalidatePath } from 'next/cache'
import { clearSessionCache } from '@/lib/sessions/load'

export async function refreshSessions() {
  clearSessionCache()
  revalidatePath('/')
}
