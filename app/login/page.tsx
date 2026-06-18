import { loginWithGoogle, loginWithMicrosoft } from './actions'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0E1117]">
      <div className="w-full max-w-sm px-6">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <svg width="22" height="24" viewBox="0 0 22 24" fill="none">
            <rect x="0"  y="12" width="4"  height="12" rx="2" fill="#6C8EFF"/>
            <rect x="5"  y="5"  width="4"  height="19" rx="2" fill="#6C8EFF"/>
            <rect x="10" y="0"  width="4"  height="24" rx="2" fill="#6C8EFF"/>
            <rect x="15" y="7"  width="4"  height="17" rx="2" fill="#6C8EFF"/>
            <rect x="20" y="14" width="2"  height="10" rx="1" fill="#6C8EFF" opacity="0.6"/>
          </svg>
          <span className="text-[18px] font-bold tracking-wide">
            <span className="text-[#6C8EFF]">CROSS</span>MEETING
          </span>
        </div>

        <h1 className="text-2xl font-semibold text-center mb-2">Entrar</h1>
        <p className="text-sm text-neutral-500 text-center mb-8">
          Acesse seu dashboard Chief of Staff
        </p>

        <div className="space-y-3">
          <form action={loginWithGoogle}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-sm font-medium text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuar com Google
            </button>
          </form>

          <form action={loginWithMicrosoft}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-sm font-medium text-white"
            >
              <svg width="18" height="18" viewBox="0 0 23 23">
                <rect x="0"  y="0"  width="11" height="11" fill="#F25022"/>
                <rect x="12" y="0"  width="11" height="11" fill="#7FBA00"/>
                <rect x="0"  y="12" width="11" height="11" fill="#00A4EF"/>
                <rect x="12" y="12" width="11" height="11" fill="#FFB900"/>
              </svg>
              Continuar com Microsoft
            </button>
          </form>
        </div>

        <p className="text-xs text-neutral-700 text-center mt-8">
          Ao entrar, você concorda com os termos de uso do Crossmeeting.
        </p>
      </div>
    </div>
  )
}
