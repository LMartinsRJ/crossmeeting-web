'use client'

import { useLanguage } from '@/components/LanguageContext'
import { t, type Lang } from '@/lib/strings'

export default function LanguagePicker() {
  const { lang, setLang, saving } = useLanguage()
  const s = t(lang).settings

  const options: { value: Lang; label: string }[] = [
    { value: 'pt', label: s.langPt },
    { value: 'en', label: s.langEn },
  ]

  return (
    <div>
      <label className="block text-sm font-medium text-white mb-1">{s.language}</label>
      <p className="text-xs text-neutral-500 mb-3">{s.languageHint}</p>
      <div className="flex gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => setLang(opt.value)}
            disabled={saving}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              lang === opt.value
                ? 'bg-[#6C8EFF]/20 border-[#6C8EFF]/50 text-white'
                : 'bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06]'
            }`}
          >
            {opt.label}
          </button>
        ))}
        {saving && <span className="self-center text-xs text-neutral-600">…</span>}
      </div>
    </div>
  )
}
