import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.tsx'
import { Banner, PageHeader } from '../components/ui.tsx'
import { acknowledgeAlert } from '../lib/api.ts'
import { formatTimestamp, messageFrom } from '../lib/format.ts'
import { useOffice } from '../office/OfficeContext.tsx'
import type { AlertRow } from '../lib/types.ts'

export function AlertsPage() {
  const { alerts, openAlerts } = useOffice()
  const acknowledged = alerts.filter((alert) => alert.acknowledged_at != null)

  return (
    <div className="page">
      <PageHeader
        title="Alerts"
        lede="These appear when a student's status changes to Critical / Intervention."
      />
      <section className="panel">
        <h2>Open</h2>
        {openAlerts.length === 0 ? <p className="muted">No open alerts.</p> : <AlertList alerts={openAlerts} />}
      </section>
      {acknowledged.length > 0 ? (
        <details className="panel">
          <summary>Acknowledged ({acknowledged.length})</summary>
          <AlertList alerts={acknowledged} />
        </details>
      ) : null}
    </div>
  )
}

export function AlertList({ alerts }: { alerts: AlertRow[] }) {
  const { profile } = useAuth()
  const { refresh } = useOffice()
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function acknowledge(alertId: string) {
    if (!profile) return
    setBusyId(alertId)
    setError(null)
    try {
      await acknowledgeAlert(alertId, profile.id)
      await refresh()
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="alert-list">
      {error ? <Banner tone="error">{error}</Banner> : null}
      {alerts.map((alert) => (
        <article key={alert.id} className="alert-row">
          <div>
            <strong>{alert.student_name}</strong>
            <p className="muted">
              {[alert.grade_level, alert.section].filter(Boolean).join(' · ')}
              {' · '}
              {formatTimestamp(alert.created_at)}
            </p>
            <p>{alert.message}</p>
          </div>
          <div className="row-actions">
            <Link className="btn btn-ghost" to={`/students/${alert.student_id}`}>Open record</Link>
            {alert.acknowledged_at == null ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busyId === alert.id}
                onClick={() => void acknowledge(alert.id)}
              >
                {busyId === alert.id ? 'Saving…' : 'Acknowledge'}
              </button>
            ) : (
              <span className="muted">Acknowledged {formatTimestamp(alert.acknowledged_at)}</span>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
