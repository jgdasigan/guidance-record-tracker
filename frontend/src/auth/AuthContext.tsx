import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchProfile } from '../lib/api.ts'
import { supabase, supabaseConfigured } from '../lib/supabase.ts'
import type { Profile } from '../lib/types.ts'

interface AuthValue {
  configured: boolean
  loading: boolean
  profile: Profile | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)

  useEffect(() => {
    if (!supabase) return
    let active = true

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      try {
        if (data.session) {
          setProfile(await fetchProfile(data.session.user.id))
        }
      } finally {
        if (active) setLoading(false)
      }
    })

    // Awaiting inside this callback deadlocks the Supabase auth lock, so the
    // profile load is deferred until the callback has returned.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setProfile(null)
        return
      }
      window.setTimeout(() => {
        void fetchProfile(session.user.id).then((next) => {
          if (active) setProfile(next)
        })
      }, 0)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(() => ({
    configured: supabaseConfigured,
    loading,
    profile,
    async signIn(email: string, password: string) {
      if (!supabase) throw new Error('Supabase is not configured in this build.')
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw new Error(error.message)
      const next = await fetchProfile(data.user.id)
      if (!next) {
        await supabase.auth.signOut()
        throw new Error(
          'This email is not on the staff list. An administrator has to invite it before you can open records.',
        )
      }
      setProfile(next)
    },
    async signOut() {
      if (!supabase) return
      await supabase.auth.signOut()
      setProfile(null)
    },
  }), [loading, profile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
