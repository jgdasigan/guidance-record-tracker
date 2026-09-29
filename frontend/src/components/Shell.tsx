import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.tsx'
import { roleLabel } from '../lib/labels.ts'
import { useOffice } from '../office/OfficeContext.tsx'

export function Shell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const { openAlerts } = useOffice()

  return (
    <div className="shell">
      <nav className="nav">
        <div className="brand">
          <strong>Napindan Integrated High School</strong>
          <span>Guidance Student Records</span>
        </div>
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/students">Students</NavLink>
        <NavLink to="/alerts">
          Alerts
          {openAlerts.length > 0 ? <span className="badge">{openAlerts.length}</span> : null}
        </NavLink>
        {/* <NavLink to="/letterhead">Letterhead</NavLink> */}
        <div className="nav-spacer" />
        {profile ? (
          <p className="who">
            <strong>{profile.full_name}</strong>
            <span>{roleLabel(profile.role)}</span>
          </p>
        ) : null}
        <button type="button" className="nav-signout" onClick={() => void signOut()}>
          Sign out
        </button>
      </nav>
      <main className="main">{children}</main>
    </div>
  )
}
