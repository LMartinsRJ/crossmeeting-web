import { createHash, createHmac } from 'crypto'
import { SupabaseClient } from '@supabase/supabase-js'

export type WebhookEvent = 'action_done' | 'briefing_ready'

export async function fireWebhooks(
  supabase: SupabaseClient,
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
) {
  const { data: endpoints } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret')
    .eq('user_id', userId)
    .eq('status', 'active')
    .contains('events', [event])

  if (!endpoints?.length) return

  const payload = { event, timestamp: new Date().toISOString(), data }
  const body = JSON.stringify(payload)

  await Promise.allSettled(
    endpoints.map(async (ep) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Crossmeeting-Webhooks/1.0',
      }
      if (ep.secret) {
        const sig = createHmac('sha256', ep.secret).update(body).digest('hex')
        headers['X-Crossmeeting-Signature'] = `sha256=${sig}`
      }

      try {
        const res = await fetch(ep.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(8000) })
        if (res.ok) {
          await supabase.from('webhook_endpoints').update({
            last_triggered_at: new Date().toISOString(),
            error_count: 0,
            last_error: null,
          }).eq('id', ep.id)
        } else {
          await supabase.from('webhook_endpoints').update({
            error_count: (ep as any).error_count + 1,
            last_error: `HTTP ${res.status}`,
            status: (ep as any).error_count >= 4 ? 'error' : 'active',
          }).eq('id', ep.id)
        }
      } catch (e: any) {
        await supabase.from('webhook_endpoints').update({
          error_count: (ep as any).error_count + 1,
          last_error: e.message,
        }).eq('id', ep.id)
      }
    })
  )
}
