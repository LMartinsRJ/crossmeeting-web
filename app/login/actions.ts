'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

function callbackUrl(next?: string) {
  const base = `${SITE_URL}/auth/callback`
  return next ? `${base}?next=${encodeURIComponent(next)}` : base
}

export async function loginWithGoogle(next?: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl(next),
      scopes: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })
  if (error) redirect('/login?error=auth')
  redirect(data.url)
}

export async function loginWithMicrosoft(next?: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'email Calendars.Read offline_access',
      redirectTo: callbackUrl(next),
    },
  })
  if (error) redirect('/login?error=auth')
  redirect(data.url)
}
