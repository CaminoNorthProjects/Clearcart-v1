import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useProfilePrefs } from '../contexts/ProfileContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Ingredient {
  id?: string
  name: string
  quantity: string
  unit: string
  category: 'produce' | 'meat_seafood' | 'dairy' | 'pantry' | 'other'
}

interface Recipe {
  id: string
  title: string
  health_score: number | null
  image_url: string | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  source_url: string | null
  created_at: string
}

const CATEGORY_LABELS: Record<Ingredient['category'], string> = {
  produce: 'Produce',
  meat_seafood: 'Meat & Seafood',
  dairy: 'Dairy',
  pantry: 'Pantry',
  other: 'Other',
}

const MAX_FREE_RECIPES = 5

// ---------------------------------------------------------------------------
// Main Recipes page
// ---------------------------------------------------------------------------

export function Recipes({ isVisible }: { isVisible: boolean }) {
  const { user } = useAuth()
  const { prefs } = useProfilePrefs()
  const { showToast } = useToast()

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)

  const fetchRecipes = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, health_score, image_url, prep_time_minutes, cook_time_minutes, source_url, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (!error && data) setRecipes(data as Recipe[])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (isVisible && user) fetchRecipes()
  }, [isVisible, user, fetchRecipes])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recipe?')) return
    const { error } = await supabase.from('recipes').delete().eq('id', id)
    if (!error) {
      setRecipes((prev) => prev.filter((r) => r.id !== id))
      if (selectedRecipe?.id === id) setSelectedRecipe(null)
      showToast('Recipe deleted')
    }
  }

  const isAtFreeLimit = !prefs?.is_premium && recipes.length >= MAX_FREE_RECIPES

  return (
    <div className="flex flex-col px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-semibold text-midnight-navy">Recipes</h2>
          <p className="mt-1 text-sm text-midnight-navy/60">
            {prefs?.is_premium
              ? 'Unlimited recipe saves'
              : `${recipes.length} / ${MAX_FREE_RECIPES} free recipes`}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-8 text-center text-midnight-navy/50">Loading...</p>
      ) : recipes.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <p className="font-display text-lg text-midnight-navy/50">No recipes yet.</p>
          <p className="mt-1 text-sm text-midnight-navy/40">
            Import a recipe from any URL to get started.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {recipes.map((recipe) => (
            <li
              key={recipe.id}
              className="cursor-pointer rounded-xl border border-midnight-navy/10 bg-white overflow-hidden hover:shadow-sm transition-shadow"
              onClick={() => setSelectedRecipe(recipe)}
            >
              <div className="flex items-start gap-3 p-4">
                {recipe.image_url ? (
                  <img
                    src={recipe.image_url}
                    alt={recipe.title}
                    className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-cream flex items-center justify-center text-2xl">
                    🍽
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-display text-lg font-semibold text-midnight-navy truncate">
                    {recipe.title}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-midnight-navy/50">
                    {recipe.health_score != null && (
                      <span className={`font-semibold ${
                        recipe.health_score >= 7 ? 'text-emerald-600' :
                        recipe.health_score >= 4 ? 'text-amber-500' : 'text-sunset-red'
                      }`}>
                        Health {recipe.health_score}/10
                      </span>
                    )}
                    {recipe.prep_time_minutes != null && (
                      <span>Prep {recipe.prep_time_minutes}m</span>
                    )}
                    {recipe.cook_time_minutes != null && (
                      <span>Cook {recipe.cook_time_minutes}m</span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => {
          if (isAtFreeLimit) {
            showToast('Upgrade to Premium to save unlimited recipes')
          } else {
            setShowImport(true)
          }
        }}
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-sunset-red text-2xl text-white shadow-lg hover:bg-sunset-red/90 transition-colors"
        title="Import recipe"
      >
        +
      </button>

      {/* Smart Import modal */}
      {showImport && (
        <SmartImportModal
          onClose={() => setShowImport(false)}
          onSaved={() => { setShowImport(false); fetchRecipes() }}
        />
      )}

      {/* Recipe detail sheet */}
      {selectedRecipe && (
        <RecipeDetailSheet
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Smart Import Modal
// ---------------------------------------------------------------------------

interface ParsedRecipe {
  title: string
  health_score: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  image_url: string | null
  ingredients: Ingredient[]
}

function SmartImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<'input' | 'parsing' | 'review' | 'saving' | 'error'>('input')
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null)
  const [error, setError] = useState<string | null>(null)

  const API_URL = import.meta.env.VITE_API_URL as string | undefined

  const handleParse = async () => {
    if (!url.trim()) return
    if (!API_URL) {
      setError('The recipe import service is not configured. Set VITE_API_URL.')
      setStatus('error')
      return
    }
    setStatus('parsing')
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/import-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      if (!res.ok) {
        const json = await res.json() as { error: string }
        throw new Error(json.error || 'Import failed.')
      }
      const data = await res.json() as ParsedRecipe
      setParsed(data)
      setStatus('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
      setStatus('error')
    }
  }

  const handleSave = async () => {
    if (!parsed || !user) return
    setStatus('saving')
    try {
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          user_id: user.id,
          title: parsed.title,
          health_score: parsed.health_score,
          image_url: parsed.image_url,
          prep_time_minutes: parsed.prep_time_minutes,
          cook_time_minutes: parsed.cook_time_minutes,
          source_url: url.trim(),
        })
        .select('id')
        .single()

      if (recipeError) throw recipeError

      if (parsed.ingredients.length > 0) {
        const { error: ingError } = await supabase.from('recipe_ingredients').insert(
          parsed.ingredients.map((ing) => ({
            recipe_id: recipeData.id,
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            category: ing.category,
          }))
        )
        if (ingError) console.warn('Ingredient insert warning:', ingError)
      }

      showToast(`"${parsed.title}" saved!`)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
      setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-midnight-navy/40" onClick={onClose}>
      <div
        className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-6 py-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-midnight-navy/20" />

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-2xl font-semibold text-midnight-navy">Smart Import</h3>
          <button onClick={onClose} className="text-midnight-navy/40 hover:text-midnight-navy">✕</button>
        </div>

        {(status === 'input' || status === 'error') && (
          <>
            <p className="text-sm text-midnight-navy/60 mb-3">
              Paste any recipe URL and we'll extract the ingredients automatically.
            </p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.example.com/lemon-herb-chicken"
              className="w-full rounded-xl border border-midnight-navy/20 px-4 py-3 text-midnight-navy placeholder-midnight-navy/40 focus:border-sunset-red focus:outline-none focus:ring-2 focus:ring-sunset-red/20"
            />
            {error && (
              <p className="mt-2 text-sm text-sunset-red">{error}</p>
            )}
            <button
              type="button"
              onClick={handleParse}
              disabled={!url.trim()}
              className="mt-4 w-full rounded-xl bg-sunset-red px-4 py-3 font-display font-semibold text-white hover:bg-sunset-red/90 disabled:opacity-50"
            >
              Import Recipe
            </button>
          </>
        )}

        {status === 'parsing' && (
          <div className="py-8 text-center">
            <p className="text-midnight-navy/60">Parsing recipe with AI...</p>
            <p className="mt-1 text-xs text-midnight-navy/40">This takes about 5 seconds.</p>
          </div>
        )}

        {status === 'review' && parsed && (
          <>
            <div className="rounded-xl border border-midnight-navy/10 bg-cream p-4 mb-4">
              <p className="font-display text-xl font-semibold text-midnight-navy">{parsed.title}</p>
              <div className="mt-1 flex gap-3 text-xs text-midnight-navy/50">
                {parsed.health_score != null && <span>Health {parsed.health_score}/10</span>}
                {parsed.prep_time_minutes != null && <span>Prep {parsed.prep_time_minutes}m</span>}
                {parsed.cook_time_minutes != null && <span>Cook {parsed.cook_time_minutes}m</span>}
              </div>
            </div>

            <h4 className="font-display text-lg font-semibold text-midnight-navy mb-2">
              Ingredients ({parsed.ingredients.length})
            </h4>
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
              const items = parsed.ingredients.filter((i) => i.category === cat)
              if (items.length === 0) return null
              return (
                <div key={cat} className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-midnight-navy/40 mb-1">{label}</p>
                  <ul className="space-y-1">
                    {items.map((ing, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-midnight-navy">
                        <span className="h-1.5 w-1.5 rounded-full bg-midnight-navy/30 flex-shrink-0" />
                        <span>{ing.quantity} {ing.unit} {ing.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}

            <button
              type="button"
              onClick={handleSave}
              className="mt-4 w-full rounded-xl bg-sunset-red px-4 py-3 font-display font-semibold text-white hover:bg-sunset-red/90"
            >
              Save Recipe
            </button>
            <button
              type="button"
              onClick={() => setStatus('input')}
              className="mt-2 w-full rounded-xl border border-midnight-navy/20 bg-white px-4 py-2.5 text-sm font-medium text-midnight-navy hover:bg-midnight-navy/5"
            >
              Try a Different URL
            </button>
          </>
        )}

        {status === 'saving' && (
          <div className="py-8 text-center">
            <p className="text-midnight-navy/60">Saving recipe...</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recipe Detail Sheet
// ---------------------------------------------------------------------------

function RecipeDetailSheet({
  recipe,
  onClose,
  onDelete,
}: {
  recipe: Recipe
  onClose: () => void
  onDelete: (id: string) => void
}) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])

  useEffect(() => {
    supabase
      .from('recipe_ingredients')
      .select('id, name, quantity, unit, category')
      .eq('recipe_id', recipe.id)
      .order('category')
      .then(({ data }) => setIngredients((data ?? []) as Ingredient[]))
  }, [recipe.id])

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-midnight-navy/40" onClick={onClose}>
      <div
        className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-6 py-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-midnight-navy/20" />

        <div className="flex items-start justify-between mb-2">
          <h3 className="font-display text-2xl font-semibold text-midnight-navy pr-4">
            {recipe.title}
          </h3>
          <button onClick={onClose} className="text-midnight-navy/40 hover:text-midnight-navy flex-shrink-0">
            ✕
          </button>
        </div>

        <div className="flex gap-3 text-xs text-midnight-navy/50 mb-4">
          {recipe.health_score != null && (
            <span className={`font-semibold ${
              recipe.health_score >= 7 ? 'text-emerald-600' :
              recipe.health_score >= 4 ? 'text-amber-500' : 'text-sunset-red'
            }`}>
              Health {recipe.health_score}/10
            </span>
          )}
          {recipe.prep_time_minutes != null && <span>Prep {recipe.prep_time_minutes}m</span>}
          {recipe.cook_time_minutes != null && <span>Cook {recipe.cook_time_minutes}m</span>}
        </div>

        {recipe.image_url && (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="w-full h-40 rounded-xl object-cover mb-4"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}

        {ingredients.length > 0 && (
          <>
            <h4 className="font-display text-lg font-semibold text-midnight-navy mb-2">Ingredients</h4>
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
              const items = ingredients.filter((i) => i.category === cat)
              if (items.length === 0) return null
              return (
                <div key={cat} className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-midnight-navy/40 mb-1">{label}</p>
                  <ul className="space-y-1">
                    {items.map((ing) => (
                      <li key={ing.id} className="flex items-center gap-2 text-sm text-midnight-navy">
                        <span className="h-1.5 w-1.5 rounded-full bg-midnight-navy/30 flex-shrink-0" />
                        <span>{ing.quantity} {ing.unit} {ing.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </>
        )}

        {recipe.source_url && (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block text-center text-xs text-midnight-navy/40 underline"
          >
            View original recipe
          </a>
        )}

        <button
          type="button"
          onClick={() => onDelete(recipe.id)}
          className="mt-4 w-full rounded-xl border border-sunset-red/30 bg-white px-4 py-2.5 text-sm font-medium text-sunset-red hover:bg-sunset-red/5"
        >
          Delete Recipe
        </button>
      </div>
    </div>
  )
}
