'use client'

import { useState, useEffect } from 'react'

interface Recipe {
  id: string
  label: string
  prompt: string
}

const BUILTIN_RECIPES: Recipe[] = [
  {
    id: 'prepare-meeting',
    label: '📋 Preparar reunião',
    prompt: 'Com base nas minhas últimas reuniões com essas pessoas ou sobre esse assunto, me ajude a preparar a próxima reunião. Quais pontos importantes, pendências e contextos eu devo lembrar?',
  },
  {
    id: 'recap-action-items',
    label: '✅ Recap de pendências',
    prompt: 'Liste todas as pendências (action items) abertas das minhas últimas reuniões, agrupadas por reunião.',
  },
  {
    id: 'shorten-summary',
    label: '✂️ Encurtar último resumo',
    prompt: 'Resuma a última reunião em até 3 frases, focando apenas no que foi decidido.',
  },
  {
    id: 'weekly-recap',
    label: '🗓️ Recap da semana',
    prompt: 'Faça um resumo geral de todas as reuniões que tive nos últimos 7 dias, destacando os principais temas e decisões.',
  },
]

const STORAGE_KEY = 'crossmeeting-custom-recipes'

function getCustomRecipes(): Recipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveCustomRecipes(recipes: Recipe[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes))
}

export default function RecipesClient() {
  const [custom, setCustom] = useState<Recipe[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newPrompt, setNewPrompt] = useState('')

  useEffect(() => { setCustom(getCustomRecipes()) }, [])

  function copy(recipe: Recipe) {
    navigator.clipboard.writeText(recipe.prompt)
    setCopied(recipe.id)
    setTimeout(() => setCopied(null), 1500)
  }

  function addRecipe() {
    if (!newLabel.trim() || !newPrompt.trim()) return
    const r: Recipe = { id: `custom-${Date.now()}`, label: newLabel.trim(), prompt: newPrompt.trim() }
    const updated = [...custom, r]
    setCustom(updated)
    saveCustomRecipes(updated)
    setNewLabel(''); setNewPrompt(''); setShowForm(false)
  }

  function remove(id: string) {
    const updated = custom.filter(r => r.id !== id)
    setCustom(updated)
    saveCustomRecipes(updated)
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Recipes</h1>
          <p className="text-sm text-neutral-500 mt-1">Prompts reutilizáveis para o chat de IA — clique para copiar.</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <span>+</span> Novo recipe
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-3">
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Nome do recipe (ex: 🎯 Próximos passos)"
            className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-blue-500"
          />
          <textarea
            value={newPrompt}
            onChange={e => setNewPrompt(e.target.value)}
            placeholder="Prompt que será copiado ao clicar..."
            rows={4}
            className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-blue-500 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm text-neutral-400 hover:text-white transition-colors">Cancelar</button>
            <button onClick={addRecipe} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">Salvar</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <p className="text-xs text-neutral-600 uppercase tracking-widest">Padrão</p>
        <div className="grid gap-3">
          {BUILTIN_RECIPES.map(r => (
            <RecipeCard key={r.id} recipe={r} copied={copied === r.id} onCopy={() => copy(r)} />
          ))}
        </div>

        {custom.length > 0 && (
          <>
            <p className="text-xs text-neutral-600 uppercase tracking-widest pt-2">Personalizados</p>
            <div className="grid gap-3">
              {custom.map(r => (
                <RecipeCard key={r.id} recipe={r} copied={copied === r.id} onCopy={() => copy(r)} onDelete={() => remove(r.id)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function RecipeCard({ recipe, copied, onCopy, onDelete }: {
  recipe: Recipe
  copied: boolean
  onCopy: () => void
  onDelete?: () => void
}) {
  return (
    <div className="group bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-4 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white mb-1">{recipe.label}</p>
          <p className="text-xs text-neutral-500 line-clamp-2">{recipe.prompt}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onDelete && (
            <button onClick={onDelete} className="px-2 py-1 rounded-lg text-xs text-neutral-600 hover:text-red-400 transition-colors">
              Remover
            </button>
          )}
          <button
            onClick={onCopy}
            className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] text-xs text-neutral-300 transition-colors"
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
    </div>
  )
}
