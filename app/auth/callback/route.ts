import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.session) {
      const { session, user } = data
      if (session.provider_token && user?.email) {
        try {
          const provider = user.app_metadata?.provider ?? 'google'
          const isGoogle = provider === 'google'
          const isMicrosoft = provider === 'azure'

          if (isGoogle || isMicrosoft) {
            // profiles_update_own policy: UPDATE WHERE email = auth.email()
            await supabase.from('profiles').update({
              [isGoogle ? 'google_calendar_token' : 'microsoft_calendar_token']: session.provider_token,
              ...(session.provider_refresh_token ? {
                [isGoogle ? 'google_calendar_refresh' : 'microsoft_calendar_token']: session.provider_refresh_token,
              } : {}),
              calendar_provider: isGoogle ? 'google' : 'microsoft',
              calendar_token_updated_at: new Date().toISOString(),
            }).eq('email', user.email)
          }
        } catch { /* não bloqueia o login se falhar */ }
      }
      const safePath = next.startsWith('/') && !next.startsWith('//') ? next : '/'
      return NextResponse.redirect(`${origin}${safePath}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
