import { useState } from 'react'
import { supabase } from '../lib/supabase'

function isValidVancouverPostalCode(value: string): boolean {
  const normalized = value.replace(/\s/g, '').toUpperCase()
  return /^V[0-9][A-Z][0-9][A-Z][0-9]$/.test(normalized)
}

export function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const resetForm = () => {
    setError(null)
    setSuccess(null)
    setEmail('')
    setPassword('')
    setFullName('')
    setPostalCode('')
  }

  const handleToggleMode = () => {
    setMode((m) => (m === 'login' ? 'signup' : 'login'))
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      } else {
        if (!fullName.trim()) {
          throw new Error('Full name is required.')
        }
        if (!postalCode.trim()) {
          throw new Error('Vancouver postal code is required.')
        }
        if (!isValidVancouverPostalCode(postalCode)) {
          throw new Error(
            'Please enter a valid Vancouver postal code (e.g. V6B 1A1).'
          )
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim(), postal_code: postalCode.trim() },
          },
        })

        if (signUpError) throw signUpError
        if (!data.user) throw new Error('Sign up failed.')

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: data.user.id,
              full_name: fullName.trim(),
              postal_code: postalCode.trim(),
            },
            { onConflict: 'id' }
          )

        if (profileError) {
          console.warn('Profile upsert warning:', profileError)
        }

        setSuccess(
          'Account created! Check your email to confirm, or sign in if already confirmed.'
        )
      }
    } catch (err: unknown) {
      console.error('Auth error:', err)
      if (err instanceof Error) {
        if (err.message === 'Failed to fetch' || err.message === 'Load failed') {
          setError('Unable to connect to the server. Please check your internet connection and try again.')
        } else {
          setError(err.message)
        }
      } else if (err && typeof err === 'object') {
        const supaErr = err as Record<string, unknown>
        const msg = supaErr.message || supaErr.error_description || supaErr.msg
        const code = supaErr.code || supaErr.status
        console.error('Supabase error details:', { msg, code, full: supaErr })
        setError(msg ? String(msg) : `Error (code: ${code || 'unknown'}). Please try again.`)
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 pb-[env(safe-area-inset-bottom)] pt-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold text-gray-900">
          ClearCart
        </h1>
        <p className="mt-1 text-center text-sm text-gray-600">
          Grocery price advocacy
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  autoComplete="name"
                />
              </div>
              <div>
                <label
                  htmlFor="postalCode"
                  className="block text-sm font-medium text-gray-700"
                >
                  Vancouver Postal Code
                </label>
                <input
                  id="postalCode"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="V6B 1A1"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  autoComplete="postal-code"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              autoComplete="email"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-emerald-600" role="status">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleToggleMode}
          className="mt-6 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {mode === 'login'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  )
}
