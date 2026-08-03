'use client'

import { createContext, useContext, useState, useTransition, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lang } from '@/lib/strings'

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  saving: boolean
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'pt',
  setLang: () => {},
  saving: false,
})

export function LanguageProvider({ children, initial }: { children: ReactNode; initial: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial)
  const [isPending, startTransition] = useTransition()

  function setLang(l: Lang) {
    setLangState(l)
    startTransition(async () => {
      const supabase = createClient()
      await supabase.from('profiles').update({ ui_language: l }).eq('id', (await supabase.auth.getUser()).data.user!.id)
    })
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, saving: isPending }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
