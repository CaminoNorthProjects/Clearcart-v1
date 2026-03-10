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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 pb-[env(safe-area-inset-bottom)] pt-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-center text-4xl font-semibold tracking-tight text-midnight-navy">
          ClearCart
        </h1>
        <p className="mt-2 text-center text-sm text-midnight-navy/60">
          Grocery price advocacy for Vancouver
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-medium text-midnight-navy"
                >
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="mt-1 w-full rounded-lg border border-midnight-navy/20 bg-white px-4 py-3 text-midnight-navy placeholder-midnight-navy/40 focus:border-sunset-red focus:outline-none focus:ring-2 focus:ring-sunset-red/20"
                  autoComplete="name"
                />
              </div>
              <div>
                <label
                  htmlFor="postalCode"
                  className="block text-sm font-medium text-midnight-navy"
                >
                  Vancouver Postal Code
                </label>
                <input
                  id="postalCode"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
                  placeholder="V6B 1A1"
                  maxLength={7}
                  className="mt-1 w-full rounded-lg border border-midnight-navy/20 bg-white px-4 py-3 text-midnight-navy placeholder-midnight-navy/40 focus:border-sunset-red focus:outline-none focus:ring-2 focus:ring-sunset-red/20"
                  autoComplete="postal-code"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-midnight-navy"
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
              className="mt-1 w-full rounded-lg border border-midnight-navy/20 bg-white px-4 py-3 text-midnight-navy placeholder-midnight-navy/40 focus:border-sunset-red focus:outline-none focus:ring-2 focus:ring-sunset-red/20"
              autoComplete="email"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-midnight-navy"
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
              className="mt-1 w-full rounded-lg border border-midnight-navy/20 bg-white px-4 py-3 text-midnight-navy placeholder-midnight-navy/40 focus:border-sunset-red focus:outline-none focus:ring-2 focus:ring-sunset-red/20"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <p className="text-sm text-sunset-red" role="alert">
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
            className="w-full rounded-lg bg-sunset-red px-4 py-3 font-display font-semibold text-lg tracking-wide text-white transition-colors hover:bg-sunset-red/90 focus:outline-none focus:ring-2 focus:ring-sunset-red focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleToggleMode}
          className="mt-4 w-full rounded-lg border border-midnight-navy/20 bg-white px-4 py-3 text-sm font-medium text-midnight-navy transition-colors hover:bg-midnight-navy/5"
        >
          {mode === 'login'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Log in'}
        </button>

        <p className="mt-8 text-center text-xs text-midnight-navy/40">
          <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}
