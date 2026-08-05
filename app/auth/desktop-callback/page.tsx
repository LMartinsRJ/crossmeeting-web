'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function DesktopCallback() {
  const params = useSearchParams()
  const [status, setStatus] = useState<'redirecting' | 'done' | 'error'>('redirecting')

  useEffect(() => {
    const code = params.get('code')
    if (!code) {
      setStatus('error')
      return
    }
    const encodedCode = encodeURIComponent(code)
    // Android Chrome bloqueia custom schemes (crossmeeting://) em redirecionamentos web.
    // O formato intent:// é suportado pelo Chrome Android e abre o app diretamente.
    const isAndroid = /Android/i.test(navigator.userAgent)
    if (isAndroid) {
      window.location.href = `intent://login-callback?code=${encodedCode}#Intent;scheme=crossmeeting;package=ai.crossmeeting.app;end`
    } else {
      window.location.href = `crossmeeting://login-callback?code=${encodedCode}`
    }
    setTimeout(() => setStatus('done'), 1000)
  }, [params])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#13161D',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: 'white',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 24px' }}>
        <div style={{ marginBottom: 24 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#6C8EFF" fillOpacity="0.15" />
            {status === 'error' ? (
              <path d="M16 16l16 16M32 16L16 32" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" />
            ) : (
              <path d="M14 25l8 8 12-14" stroke="#6C8EFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </div>

        {status === 'error' ? (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px', color: '#f87171' }}>
              Erro na autenticação
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
              Nenhum código encontrado. Tente novamente no app.
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>
              Autenticação concluída!
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 16px' }}>
              Pode fechar esta aba e voltar para o Crossmeeting.
            </p>
            <button
              onClick={() => window.close()}
              style={{
                background: '#6C8EFF',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Fechar esta aba
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function DesktopCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#13161D', color: 'white', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#6b7280' }}>Processando autenticação...</p>
      </div>
    }>
      <DesktopCallback />
    </Suspense>
  )
}
