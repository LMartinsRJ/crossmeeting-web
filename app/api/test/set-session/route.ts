import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Only active in non-production environments
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { email, password } = await request.json()

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Ensure test user exists
  const { data: existingUsers } = await admin.auth.admin.listUsers()
  const exists = existingUsers?.users?.some(u => u.email === email)

  if (!exists) {
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 500 })
    }
  }

  // Sign in to get session tokens
  const { data, error } = await admin.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    return NextResponse.json({ error: error?.message ?? 'no session' }, { status: 401 })
  }

  // Ensure profile row exists (admin.createUser bypasses the signup trigger)
  const profileUpsert = await admin
    .from('profiles')
    .upsert({ id: data.user.id, email }, { onConflict: 'id', ignoreDuplicates: true })
  if (profileUpsert.error) {
    return NextResponse.json({ error: `profile upsert: ${profileUpsert.error.message}` }, { status: 500 })
  }

  // Reset import rate limit so test runs don't exhaust the 10/hour quota
  await admin
    .from('import_rate_limits')
    .upsert(
      { user_id: data.user.id, count: 0, reset_at: new Date(Date.now() + 3_600_000).toISOString() },
      { onConflict: 'user_id' }
    )

  // Set cookies via @supabase/ssr so middleware recognizes the session
  const response = NextResponse.json({ ok: true })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  await supabase.auth.setSession(data.session)

  return response
}
