import { useState, type FormEvent } from 'react'
import { messageFrom } from '../lib/format.ts'
import { useAuth } from '../auth/AuthContext.tsx'
import { Banner, Field } from '../components/ui.tsx'

export function SetupScreen() {
  return (
    <div className="gate">
      <section className="gate-card">
        <p className="eyebrow">Guidance Records</p>
        <h1>Connect this build to Supabase</h1>
        <p>
          Copy <code>frontend/.env.example</code> to <code>frontend/.env</code>,
          set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>,
          then run <code>npm run build</code> in the frontend folder and refresh.
        </p>
      </section>
    </div>
  )
}

export function SignIn() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gate">
      <section className="gate-card">
        <p className="eyebrow">Guidance Records</p>
        <h1>Sign in</h1>
        {/* <p>Counselors and administrators only. Student notes stay on this side of the login.</p> */}
        <form onSubmit={(event) => void onSubmit(event)}>
          <Field label="Email">
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  )
}
