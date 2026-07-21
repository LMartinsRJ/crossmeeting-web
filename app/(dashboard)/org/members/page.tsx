'use client'

import { useEffect, useState, useRef } from 'react'

interface Member {
  userId: string
  name: string
  email: string
  role: string
}

interface Invite {
  id: string
  email: string
  role: string
  expires_at: string
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gerente',
  member: 'Membro',
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Invite form
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const linkRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const [dashRes, invRes, profileRes] = await Promise.all([
      fetch('/api/org/dashboard'),
      fetch('/api/org/members/invite'),
      fetch('/api/org/profile'),
    ])

    if (dashRes.ok) {
      const d = await dashRes.json()
      setMembers(d.members?.map((m: { userId: string; name: string; role: string }) => ({
        userId: m.userId,
        name: m.name,
        email: '',
        role: m.role,
      })) ?? [])
    }

    if (invRes.ok) {
      const d = await invRes.json()
      setInvites(d.invites ?? [])
    }

    if (profileRes.ok) {
      const d = await profileRes.json()
      setIsAdmin(d.orgRole === 'admin')
    } else {
      // Fallback: try to detect admin from dashboard
      if (dashRes.ok) {
        const d = await dashRes.clone().json().catch(() => null)
        // Just check if invite endpoint returned 200 (only admins can list)
        setIsAdmin(invRes.ok)
      }
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteError(null)
    setInviteLink(null)

    const res = await fetch('/api/org/members/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), role }),
    })
    const d = await res.json()

    if (!res.ok) {
      setInviteError(d.error ?? 'Erro ao criar convite')
    } else {
      setInviteLink(d.link)
      setEmail('')
      load()
    }
    setInviting(false)
  }

  async function revokeInvite(id: string) {
    await fetch(`/api/org/members/invite?id=${id}`, { method: 'DELETE' })
    load()
  }

  async function removeMember(userId: string) {
    if (!confirm('Remover este membro da organização?')) return
    await fetch(`/api/org/members/${userId}`, { method: 'DELETE' })
    load()
  }

  async function changeRole(userId: string, newRole: string) {
    await fetch(`/api/org/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    load()
  }

  function copyLink() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    linkRef.current?.select()
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="text-neutral-600 text-sm">Carregando…</div>
    </div>
  )

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">👥</span>
          <h1 className="text-xl font-semibold text-white">Membros & Áreas</h1>
        </div>
        <p className="text-sm text-neutral-500">{members.length} membro{members.length !== 1 ? 's' : ''} na organização</p>
      </div>

      {/* Invite form (admin only) */}
      {isAdmin && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Convidar membro</h2>
          <form onSubmit={handleInvite} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-neutral-500 mb-1.5 block">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#6C8EFF]/50"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Função</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6C8EFF]/50"
              >
                <option value="member">Membro</option>
                <option value="manager">Gerente</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="px-4 py-2 bg-[#6C8EFF] hover:bg-[#5a7ef0] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {inviting ? 'Gerando…' : 'Gerar link'}
            </button>
          </form>

          {inviteError && (
            <p className="mt-3 text-sm text-red-400">{inviteError}</p>
          )}

          {inviteLink && (
            <div className="mt-4 p-3 bg-green-500/[0.06] border border-green-500/20 rounded-lg">
              <p className="text-xs text-green-400 mb-2 font-medium">Link gerado — copie e envie para o convidado:</p>
              <div className="flex gap-2">
                <input
                  ref={linkRef}
                  readOnly
                  value={inviteLink}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-neutral-300 font-mono focus:outline-none"
                />
                <button
                  onClick={copyLink}
                  className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 text-xs rounded-lg transition-colors"
                >
                  Copiar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members list */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <h2 className="text-sm font-semibold text-white">Membros ativos</h2>
        </div>
        {members.length === 0 ? (
          <div className="px-5 py-8 text-center text-neutral-600 text-sm">Nenhum membro.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['Nome', 'Função', isAdmin ? 'Ações' : ''].filter(Boolean).map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs text-neutral-600 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.userId} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-neutral-200 font-medium">{m.name}</td>
                  <td className="px-5 py-3">
                    {isAdmin ? (
                      <select
                        value={m.role}
                        onChange={e => changeRole(m.userId, e.target.value)}
                        className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-neutral-300 focus:outline-none"
                      >
                        <option value="member">Membro</option>
                        <option value="manager">Gerente</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className="text-[10px] bg-white/[0.06] text-neutral-500 px-2 py-0.5 rounded-full">
                        {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3">
                      <button
                        onClick={() => removeMember(m.userId)}
                        className="text-xs text-neutral-600 hover:text-red-400 transition-colors"
                      >
                        Remover
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending invites */}
      {isAdmin && invites.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <h2 className="text-sm font-semibold text-white">Convites pendentes</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['E-mail', 'Função', 'Expira em', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs text-neutral-600 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invites.map(inv => (
                <tr key={inv.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-neutral-300">{inv.email}</td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] bg-white/[0.06] text-neutral-500 px-2 py-0.5 rounded-full">
                      {ROLE_LABELS[inv.role] ?? inv.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-neutral-500 text-xs">
                    {new Date(inv.expires_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => revokeInvite(inv.id)}
                      className="text-xs text-neutral-600 hover:text-red-400 transition-colors"
                    >
                      Revogar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
