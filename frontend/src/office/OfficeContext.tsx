import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchAlerts, fetchSchool, fetchStudents } from '../lib/api.ts'
import { supabase } from '../lib/supabase.ts'
import type { AlertRow, SchoolSettings, Student } from '../lib/types.ts'

const DEFAULT_SCHOOL: SchoolSettings = {
  school_name: 'School Guidance Office',
  office_name: 'Guidance and Counseling Office',
}

interface OfficeValue {
  students: Student[]
  alerts: AlertRow[]
  openAlerts: AlertRow[]
  school: SchoolSettings
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const OfficeContext = createContext<OfficeValue | null>(null)

export function OfficeProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<Student[]>([])
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [school, setSchool] = useState<SchoolSettings>(DEFAULT_SCHOOL)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [nextStudents, nextAlerts, nextSchool] = await Promise.all([
        fetchStudents(),
        fetchAlerts(),
        fetchSchool(),
      ])
      setStudents(nextStudents)
      setAlerts(nextAlerts)
      if (nextSchool) setSchool(nextSchool)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!supabase) return
    // A dropped socket should not hide a critical alert, so focus reloads too.
    const client = supabase
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    const channel = client
      .channel('guidance-office')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        void refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        void refresh()
      })
      .subscribe()
    return () => {
      window.removeEventListener('focus', onFocus)
      void client.removeChannel(channel)
    }
  }, [refresh])

  const value = useMemo<OfficeValue>(() => ({
    students,
    alerts,
    openAlerts: alerts.filter((alert) => alert.acknowledged_at == null),
    school,
    loading,
    error,
    refresh,
  }), [alerts, error, loading, refresh, school, students])

  return <OfficeContext.Provider value={value}>{children}</OfficeContext.Provider>
}

export function useOffice(): OfficeValue {
  const value = useContext(OfficeContext)
  if (!value) throw new Error('useOffice must be used inside OfficeProvider')
  return value
}
