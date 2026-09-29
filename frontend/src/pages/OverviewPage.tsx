import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext.tsx'
import { Banner, Field, PageHeader } from '../components/ui.tsx'
import { fetchCaseMarks } from '../lib/api.ts'
import { downloadPdf } from '../lib/files.ts'
import { messageFrom, todayInputValue } from '../lib/format.ts'
import { SEX_OPTIONS, sexLabel, STATUS_OPTIONS } from '../lib/labels.ts'
import {
  filterStudents,
  formatPercent,
  gradeShares,
  gradeSort,
  indexCases,
  schoolYearOf,
  sectionShares,
  statusShares,
  type CaseFilter,
  type SexFilter,
  type Share,
} from '../lib/overview.ts'
import { useOffice } from '../office/OfficeContext.tsx'
import { renderOverviewReport } from '../pdf/overview.tsx'
import type { GuidanceStatus } from '../lib/types.ts'

const GRADE_COLORS = ['#3b6fd8', '#2ec5d6', '#d946ef', '#2dd4bf', '#f5c542', '#1f6b45', '#e07a3d', '#7c6cf0']

const STATUS_COLORS: Record<GuidanceStatus, string> = {
  routine: '#1f6b45',
  monitoring: '#e0a106',
  critical: '#d4533b',
  referred: '#3b6fd8',
  closed: '#8a8178',
}

const CASE_FILTERS: { value: CaseFilter; label: string }[] = [
  { value: 'all', label: 'All records' },
  { value: 'case', label: 'Has a case' },
  { value: 'sanction', label: 'Has a sanction' },
  { value: 'none', label: 'No case history' },
]

export function OverviewPage() {
  const { profile } = useAuth()
  const { students, school, loading, error } = useOffice()
  const [marks, setMarks] = useState<Array<{ student_id: string; category: 'case' | 'sanction' }>>([])
  const [markError, setMarkError] = useState<string | null>(null)
  const [year, setYear] = useState('all')
  const [yearTouched, setYearTouched] = useState(false)
  const [grade, setGrade] = useState('all')
  const [sex, setSex] = useState<SexFilter>('all')
  const [section, setSection] = useState('all')
  const [caseHistory, setCaseHistory] = useState<CaseFilter>('all')
  const [reportError, setReportError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    fetchCaseMarks()
      .then((rows) => {
        if (active) setMarks(rows)
      })
      .catch((caught) => {
        if (active) setMarkError(messageFrom(caught))
      })
    return () => {
      active = false
    }
  }, [students])

  const caseIndex = useMemo(() => indexCases(marks), [marks])
  const years = useMemo(
    () => [...new Set(students.map((student) => schoolYearOf(student.created_at)))].sort().reverse(),
    [students],
  )

  useEffect(() => {
    if (yearTouched || years.length === 0 || year !== 'all') return
    setYear(years[0])
  }, [year, yearTouched, years])

  const gradeOptions = useMemo(() => {
    const pool = filterStudents(students, caseIndex, {
      year,
      grade: 'all',
      sex,
      section: 'all',
      caseHistory,
    })
    return [...new Set(pool.map((student) => student.grade_level))].sort(gradeSort)
  }, [caseHistory, caseIndex, sex, students, year])

  const sectionOptions = useMemo(() => {
    const pool = filterStudents(students, caseIndex, {
      year,
      grade,
      sex,
      section: 'all',
      caseHistory,
    })
    return [...new Set(pool.map((student) => student.section))].sort((a, b) => a.localeCompare(b))
  }, [caseHistory, caseIndex, grade, sex, students, year])

  useEffect(() => {
    if (grade !== 'all' && !gradeOptions.includes(grade)) setGrade('all')
  }, [grade, gradeOptions])

  useEffect(() => {
    if (section !== 'all' && !sectionOptions.includes(section)) setSection('all')
  }, [section, sectionOptions])

  const filtered = useMemo(
    () => filterStudents(students, caseIndex, { year, grade, sex, section, caseHistory }),
    [caseHistory, caseIndex, grade, section, sex, students, year],
  )

  const statuses = useMemo(() => statusShares(filtered, STATUS_OPTIONS), [filtered])
  const grades = useMemo(() => gradeShares(filtered), [filtered])
  const sections = useMemo(
    () => (grade === 'all' ? [] : sectionShares(filtered)),
    [filtered, grade],
  )
  const withCase = filtered.filter((student) => caseIndex.cases.has(student.id)).length
  const withSanction = filtered.filter((student) => caseIndex.sanctions.has(student.id)).length
  const withHistory = filtered.filter((student) => (
    caseIndex.cases.has(student.id) || caseIndex.sanctions.has(student.id)
  )).length

  const chart = grade === 'all'
    ? colorShares(grades, (index) => GRADE_COLORS[index % GRADE_COLORS.length])
    : statuses.map((row) => ({ ...row, color: STATUS_COLORS[row.key as GuidanceStatus] }))
  const focusLabel = grade === 'all' ? 'By grade' : `Grade ${grade}`

  async function downloadReport() {
    if (!profile) return
    setBusy(true)
    setReportError(null)
    try {
      const blob = await renderOverviewReport({
        schoolName: school.school_name,
        officeName: school.office_name,
        preparedBy: profile.full_name,
        issuedAt: new Date(),
        year: year === 'all' ? 'All years' : year,
        grade: grade === 'all' ? 'All grades' : `Grade ${grade}`,
        sex: sex === 'all' ? 'All' : sexLabel(sex),
        section: section === 'all' ? 'All sections' : section,
        caseHistory: CASE_FILTERS.find((item) => item.value === caseHistory)?.label ?? 'All records',
        studentCount: filtered.length,
        withCase,
        withSanction,
        statuses,
        grades,
        sections,
      })
      downloadPdf(blob, `guidance-dashboard-${todayInputValue()}.pdf`)
    } catch (caught) {
      setReportError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        // lede="Counts and status shares for the students on record. School year follows the date the record was added, from June through May."
        actions={
          <button type="button" className="btn btn-primary" disabled={busy || loading} onClick={() => void downloadReport()}>
            {busy ? 'Preparing…' : 'Download report'}
          </button>
        }
      />
      {error ? <Banner tone="error">{error}</Banner> : null}
      {markError ? <Banner tone="error">{markError}</Banner> : null}
      {reportError ? <Banner tone="error">{reportError}</Banner> : null}
      {loading ? <p className="muted">Loading records…</p> : (
        <>
          <div className="overview-top">
            <div className="overview-selects">
              <Field label="School year">
                <select
                  value={year}
                  onChange={(event) => {
                    setYearTouched(true)
                    setYear(event.target.value)
                  }}
                >
                  <option value="all">All years</option>
                  {years.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Grade">
                <select value={grade} onChange={(event) => setGrade(event.target.value)}>
                  <option value="all">All grades</option>
                  {gradeOptions.map((item) => <option key={item} value={item}>Grade {item}</option>)}
                </select>
              </Field>
            </div>
            <StatCard label="Student count" value={String(filtered.length)} icon="students" />
            <StatCard label="With a case history" value={String(withHistory)} icon="cases" />
          </div>
          <section className="status-strip" aria-label="Status percentages">
            {statuses.map((item) => (
              <article key={item.key} className={`status-chip status-chip-${item.key}`}>
                <span className="status-swatch" style={{ background: STATUS_COLORS[item.key as GuidanceStatus] }} />
                <p>{item.label}</p>
                <strong>{formatPercent(item.percent)}</strong>
                <span className="status-count"> ({item.count})</span>
              </article>
            ))}
          </section>
          <section className="chart-card">
            <div className="chart-head">
              <h2>{focusLabel}</h2>
              <div className="overview-filters">
                <Field label="Gender">
                  <select value={sex} onChange={(event) => setSex(event.target.value as SexFilter)}>
                    <option value="all">All</option>
                    {SEX_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Section">
                  <select value={section} onChange={(event) => setSection(event.target.value)}>
                    <option value="all">All sections</option>
                    {sectionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Case history">
                  <select value={caseHistory} onChange={(event) => setCaseHistory(event.target.value as CaseFilter)}>
                    {CASE_FILTERS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <p className="muted chart-count">{filtered.length} students</p>
            </div>
            {filtered.length === 0 ? <p className="muted">No students match these filters.</p> : (
              <ShareChart slices={chart} />
            )}
            {sections.length > 1 ? (
              <>
                <h3>Sections in grade {grade}</h3>
                <ShareBars slices={colorShares(sections, (index) => GRADE_COLORS[index % GRADE_COLORS.length])} />
              </>
            ) : null}
          </section>
        </>
      )}
    </div>
  )
}

function colorShares(rows: Share[], colorAt: (index: number) => string): Array<Share & { color: string }> {
  return rows.map((row, index) => ({ ...row, color: colorAt(index) }))
}

function ShareChart({ slices }: { slices: Array<Share & { color: string }> }) {
  const largest = slices.reduce((best, slice) => (slice.count > best.count ? slice : best), slices[0])
  return (
    <div className="chart-layout">
      <div className="donut-wrap">
        <div className="donut" style={{ background: conic(slices) }}>
          <div className="donut-hole">
            <strong>{formatPercent(largest?.percent ?? 0)}</strong>
            <span>{(largest?.label ?? 'None').split(' / ')[0]}</span>
          </div>
        </div>
      </div>
      <ShareBars slices={slices} />
    </div>
  )
}

function ShareBars({ slices }: { slices: Array<Share & { color: string }> }) {
  return (
    <div className="bar-list">
      {slices.map((slice) => (
        <div key={slice.key} className="bar-row">
          <span className="bar-swatch" style={{ background: slice.color }} />
          <span className="bar-label">{slice.label}</span>
          <div className="bar-track" aria-hidden="true">
            <div className="bar-fill" style={{ width: `${Math.max(slice.percent, slice.count > 0 ? 2 : 0)}%`, background: slice.color }}>
              {slice.percent >= 14 ? formatPercent(slice.percent) : ''}
            </div>
          </div>
          <span className="bar-pct">{slice.percent < 14 ? formatPercent(slice.percent) : ''}</span>
          <span className="bar-count">{slice.count}</span>
        </div>
      ))}
    </div>
  )
}

function conic(slices: Array<Share & { color: string }>): string {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0)
  if (total === 0) return 'conic-gradient(#eceae6 0 100%)'
  let cursor = 0
  const stops = slices.filter((slice) => slice.count > 0).map((slice) => {
    const start = cursor
    cursor += (slice.count / total) * 100
    return `${slice.color} ${start}% ${cursor}%`
  })
  return `conic-gradient(${stops.join(', ')})`
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: 'students' | 'cases' }) {
  return (
    <article className="stat-card">
      <span className="stat-icon" aria-hidden="true">
        {icon === 'students' ? <PeopleIcon /> : <FolderIcon />}
      </span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </article>
  )
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="9" cy="8" r="2.2" />
      <circle cx="16" cy="9" r="1.8" />
      <path d="M4.8 17.5c.6-2.4 2.4-3.6 4.2-3.6s3.6 1.2 4.2 3.6" />
      <path d="M13.2 14.2c1.5-.3 3 .4 3.8 2.3" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 8.5h6l1.5-2H20v11H4v-9z" />
      <path d="M8 13.5h8" />
    </svg>
  )
}
