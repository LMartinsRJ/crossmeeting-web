'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

interface InviteInfo {
  email: string
  role: string
  orgName: string
  orgPlan: string
  expiresAt: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gerente',
  member: 'Membro',
}

function AcceptInviteInner() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token')

  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setError('Token não encontrado na URL.'); setLoading(false); return }

    fetch(`/api/org/invites/accept?token=${token}`)
      .then(async r => {
        const d = await r.json()
        if (!r.ok) setError(d.error ?? 'Convite inválido')
        else setInfo(d)
      })
      .catch(() => setError('Erro ao verificar convite'))
      .finally(() => setLoading(false))
  }, [token])

  async function accept() {
    if (!token) return
    setAccepting(true)
    const res = await fetch('/api/org/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const d = await res.json()
    if (!res.ok) {
      if (res.status === 401) {
        // Not logged in — redirect to login with return URL
        router.push(`/login?next=${encodeURIComponent(`/accept-invite?token=${token}`)}`)
        return
      }
      setError(d.error ?? 'Erro ao aceitar convite')
      setAccepting(false)
      return
    }
    setDone(true)
    setTimeout(() => router.push('/org'), 2000)
  }

  return (
    <div className="min-h-screen bg-[#0E1117] flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-10">
          <svg width="18" height="20" viewBox="0 0 18 20" fill="none">
            <rect x="0"  y="10" width="3" height="10" rx="1.5" fill="#6C8EFF"/>
            <rect x="4"  y="4"  width="3" height="16" rx="1.5" fill="#6C8EFF"/>
            <rect x="8"  y="0"  width="3" height="20" rx="1.5" fill="#6C8EFF"/>
            <rect x="12" y="6"  width="3" height="14" rx="1.5" fill="#6C8EFF"/>
            <rect x="16" y="12" width="2" height="8"  rx="1"   fill="#6C8EFF" opacity="0.6"/>
          </svg>
          <span className="text-[13px] font-bold tracking-[0.02em] text-white">
            CROSS<span className="text-[#6C8EFF]">MEETING</span>
          </span>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8">

          {loading && (
            <div className="text-center text-neutral-500 text-sm py-4">Verificando convite…</div>
          )}

          {!loading && error && (
            <div className="text-center space-y-4">
              <div className="text-4xl">⚠️</div>
              <h1 className="text-white font-semibold">Convite inválido</h1>
              <p className="text-neutral-500 text-sm">{error}</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-sm text-[#6C8EFF] hover:underline"
              >
                Ir para o Dashboard
              </button>
            </div>
          )}

          {!loading && done && (
            <div className="text-center space-y-3">
              <div className="text-4xl">✅</div>
              <h1 className="text-white font-semibold">Bem-vindo à organização!</h1>
              <p className="text-neutral-500 text-sm">Redirecionando para o Dashboard Executivo…</p>
            </div>
          )}

          {!loading && !error && !done && info && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-3">🏢</div>
                <h1 className="text-white font-semibold text-lg mb-1">Convite para {info.orgName}</h1>
                <p className="text-neutral-500 text-sm">
                  Você foi convidado como{' '}
                  <span className="text-neutral-300 font-medium">{ROLE_LABELS[info.role] ?? info.role}</span>
                </p>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Organização</span>
                  <span className="text-neutral-200">{info.orgName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Plano</span>
                  <span className="text-[10px] bg-[#6C8EFF]/20 text-[#6C8EFF] font-semibold px-2 py-0.5 rounded-full uppercase">{info.orgPlan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">E-mail convidado</span>
                  <span className="text-neutral-200">{info.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Válido até</span>
                  <span className="text-neutral-400">{new Date(info.expiresAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              <button
                onClick={accept}
                disabled={accepting}
                className="w-full py-3 bg-[#6C8EFF] hover:bg-[#5a7ef0] disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
              >
                {accepting ? 'Aceitando…' : 'Aceitar convite'}
              </button>

              <p className="text-center text-xs text-neutral-600">
                Ao aceitar, você entra para a organização e terá acesso ao Dashboard Executivo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center">
        <div className="text-neutral-600 text-sm">Carregando…</div>
      </div>
    }>
      <AcceptInviteInner />
    </Suspense>
  )
}
