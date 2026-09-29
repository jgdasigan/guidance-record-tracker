import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.tsx'
import { Banner, Field, PageHeader, StatusPill } from '../components/ui.tsx'
import { createStudent, createStudents, deleteStudent } from '../lib/api.ts'
import { isClassRecordFile, parseClassRecord, planRosterImport, type ClassRoster } from '../lib/classRecord.ts'
import {
  composeFullName,
  messageFrom,
  NAME_PATTERN_SOURCE,
  optionalLetters,
  parseAge,
  requiredLetters,
  requiredSex,
  requiredText,
  sanitizeLetters,
} from '../lib/format.ts'
import { SEX_OPTIONS, sexLabel, STATUS_OPTIONS, STATUS_RANK } from '../lib/labels.ts'
import { useOffice } from '../office/OfficeContext.tsx'
import type { GuidanceStatus, Student, StudentSex } from '../lib/types.ts'
import { AlertList } from './AlertsPage.tsx'

const DELETE_CONFIRMATION = 'confirm'

export function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { students, loading, error, refresh, openAlerts } = useOffice()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<GuidanceStatus | 'all'>('all')
  const [grade, setGrade] = useState('all')
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState<Student | null>(null)
  const isAdmin = profile?.role === 'admin'

  const grades = useMemo(
    () => [...new Set(students.map((student) => student.grade_level))].sort((a, b) => a.localeCompare(b)),
    [students],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return students
      .filter((student) => {
        const matchesQuery = needle === ''
          || student.full_name.toLowerCase().includes(needle)
          || student.section.toLowerCase().includes(needle)
        const matchesStatus = status === 'all' || student.status === status
        const matchesGrade = grade === 'all' || student.grade_level === grade
        return matchesQuery && matchesStatus && matchesGrade
      })
      .sort((a, b) => {
        const urgency = STATUS_RANK[a.status] - STATUS_RANK[b.status]
        if (urgency !== 0) return urgency
        return a.full_name.localeCompare(b.full_name)
      })
  }, [grade, query, status, students])

  return (
    <div className="page">
      <PageHeader
        title="Students"
        lede="Search by name or section, or narrow by status and grade."
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => void refresh()}>
              Refresh
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setImporting(true)}>
              Batch add students
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              Add student
            </button>
          </>
        }
      />
      {error ? <Banner tone="error">{error}</Banner> : null}
      {openAlerts.length > 0 ? (
        <section className="panel panel-alert">
          <h2>Needs attention</h2>
          <AlertList alerts={openAlerts} />
        </section>
      ) : null}
      <div className="filters">
        <Field label="Search">
          <input
            type="search"
            value={query}
            placeholder="Name or section"
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as GuidanceStatus | 'all')}
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Grade">
          <select value={grade} onChange={(event) => setGrade(event.target.value)}>
            <option value="all">All grades</option>
            {grades.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </Field>
      </div>
      {loading ? <p className="muted">Loading students…</p> : null}
      {!loading && filtered.length === 0 ? (
        <p className="muted">
          {students.length === 0
            ? 'No students yet. Add a record when a counselor opens a case.'
            : 'No students match these filters.'}
        </p>
      ) : null}
      {filtered.length > 0 ? (
        <div className={`roster${isAdmin ? ' roster-admin' : ''}`}>
          <div className="roster-head" aria-hidden="true">
            <span>Student</span>
            <span>Grade</span>
            <span>Section</span>
            <span>Sex</span>
            <span>Age</span>
            <span>Status</span>
            {isAdmin ? <span>Delete</span> : null}
          </div>
          {filtered.map((student) => (
            <div
              key={student.id}
              className="roster-row"
              onClick={() => navigate(`/students/${student.id}`)}
            >
              <Link
                className="roster-name"
                to={`/students/${student.id}`}
                onClick={(event) => event.stopPropagation()}
              >
                {student.full_name}
              </Link>
              <span>{student.grade_level}</span>
              <span>{student.section}</span>
              <span>{student.sex ? sexLabel(student.sex) : '—'}</span>
              <span>{student.age ?? '—'}</span>
              <StatusPill status={student.status} />
              {isAdmin ? (
                <button
                  type="button"
                  className="btn btn-danger roster-delete"
                  onClick={(event) => {
                    event.stopPropagation()
                    setDeleting(student)
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {adding ? (
        <AddStudentDialog
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false)
            void refresh()
          }}
        />
      ) : null}
      {importing ? (
        <ImportClassListDialog
          students={students}
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false)
            void refresh()
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteStudentDialog
          student={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            void refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function AddStudentDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const { profile } = useAuth()
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [section, setSection] = useState('')
  const [sex, setSex] = useState<StudentSex | ''>('')
  const [age, setAge] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [relationship, setRelationship] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!profile) return
    setBusy(true)
    setError(null)
    try {
      const validFirst = requiredLetters(firstName, 'First name')
      const validLast = requiredLetters(lastName, 'Last name')
      const validMiddle = optionalLetters(middleName, 'Middle name') ?? ''
      await createStudent({
        full_name: composeFullName(validFirst, validMiddle, validLast),
        grade_level: requiredText(gradeLevel, 'Grade'),
        section: requiredText(section, 'Section'),
        sex: requiredSex(sex),
        age: parseAge(age),
        emergency_contact_name: requiredLetters(contactName, 'Emergency contact'),
        emergency_contact_phone: requiredText(contactPhone, 'Contact number'),
        emergency_contact_relationship: relationship.trim() || null,
      }, profile.id)
      onCreated()
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-back" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-labelledby="add-student-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="add-student-title">Add student</h2>
        <form onSubmit={(event) => void onSubmit(event)}>
          <div className="split">
            <Field label="Last name">
              <input
                value={lastName}
                onChange={(event) => setLastName(sanitizeLetters(event.target.value))}
                placeholder="Dela Cruz"
                pattern={NAME_PATTERN_SOURCE}
                title="Last name can only contain letters."
                required
              />
            </Field>
            <Field label="First name">
              <input
                value={firstName}
                onChange={(event) => setFirstName(sanitizeLetters(event.target.value))}
                placeholder="Juan"
                pattern={NAME_PATTERN_SOURCE}
                title="First name can only contain letters."
                required
              />
            </Field>
            <Field label="Middle initial or name">
              <input
                value={middleName}
                onChange={(event) => setMiddleName(sanitizeLetters(event.target.value))}
                placeholder="D. or Dela"
                pattern={NAME_PATTERN_SOURCE}
                title="Middle initial or name can only contain letters."
              />
            </Field>
          </div>
          <div className="split">
            <Field label="Grade">
              <input value={gradeLevel} onChange={(event) => setGradeLevel(event.target.value)} placeholder="7" required />
            </Field>
            <Field label="Section">
              <input value={section} onChange={(event) => setSection(event.target.value)} placeholder="Rizal" required />
            </Field>
            <Field label="Sex">
              <select value={sex} onChange={(event) => setSex(event.target.value as StudentSex | '')} required>
                <option value="">Select</option>
                {SEX_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Age">
              <input
                value={age}
                onChange={(event) => setAge(event.target.value)}
                placeholder="15"
                inputMode="numeric"
                required
              />
            </Field>
          </div>
          <Field label="Emergency contact">
            <input
              value={contactName}
              onChange={(event) => setContactName(sanitizeLetters(event.target.value))}
              placeholder="Maria Santos"
              pattern={NAME_PATTERN_SOURCE}
              title="Emergency contact can only contain letters."
              required
            />
          </Field>
          <div className="split">
            <Field label="Contact number">
              <input
                type="tel"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                placeholder="09171234567"
                required
                minLength={11}
                maxLength={11}
                pattern="[0-9]{11}"
                inputMode="numeric"
              />
            </Field>
            <Field label="Relationship">
              <input value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="Mother" />
            </Field>
          </div>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ImportClassListDialog({
  students,
  onClose,
  onImported,
}: {
  students: Student[]
  onClose: () => void
  onImported: () => void
}) {
  const { profile } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileLabel, setFileLabel] = useState<string | null>(null)
  const [roster, setRoster] = useState<ClassRoster | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const plan = roster ? planRosterImport(roster, students) : null

  async function readFile(file: File | undefined) {
    if (!file || busy) return
    setError(null)
    setRoster(null)
    if (!isClassRecordFile(file.name)) {
      setFileLabel(null)
      setError('Only CSV or Excel files are accepted (.csv, .xlsx, .xls, or .xlsm).')
      return
    }
    setFileLabel(file.name)
    try {
      setRoster(parseClassRecord(await file.arrayBuffer(), file.name))
    } catch (caught) {
      setError(messageFrom(caught))
    }
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    void readFile(file)
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!busy) setDragging(true)
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    setDragging(false)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    const dropped = event.dataTransfer.files
    if (dropped.length > 1) {
      setRoster(null)
      setFileLabel(null)
      setError('Drop one CSV or Excel file.')
      return
    }
    void readFile(dropped[0])
  }

  async function onImport() {
    if (!profile || !plan || plan.toAdd.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await createStudents(
        plan.toAdd.map((learner) => ({
          full_name: learner.name,
          grade_level: plan.gradeLevel,
          section: plan.section,
          sex: learner.sex,
          age: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          emergency_contact_relationship: null,
        })),
        profile.id,
      )
      onImported()
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-back" role="presentation" onMouseDown={() => { if (!busy) onClose() }}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-labelledby="import-class-title"
        onMouseDown={(event) => event.stopPropagation()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
      >
        <h2 id="import-class-title">Batch add students</h2>
        <div
          className={`drop-zone${dragging ? ' drop-zone-active' : ''}`}
          role="button"
          tabIndex={0}
          aria-disabled={busy}
          onClick={() => { if (!busy) fileRef.current?.click() }}
          onKeyDown={(event) => {
            if (busy) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              fileRef.current?.click()
            }
          }}
          onDragEnter={onDragOver}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <strong>{fileLabel ?? 'Drop a CSV or Excel file here'}</strong>
          <span className="muted">or choose a file · .csv, .xlsx, .xls, .xlsm</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={onFile}
        />
        {plan ? (
          <>
            <p>
              Grade {plan.gradeLevel} · Section {plan.section}. {plan.toAdd.length} will be added.
            </p>
            {plan.alreadyRecorded > 0 ? (
              <p className="muted">{plan.alreadyRecorded} already on this class roster were skipped.</p>
            ) : null}
            {plan.repeatedInFile > 0 ? (
              <p className="muted">{plan.repeatedInFile} repeated names in the file were skipped.</p>
            ) : null}
            {plan.toAdd.length > 0 ? (
              <ol className="import-list">
                {plan.toAdd.map((learner) => (
                  <li key={`${learner.sex}-${learner.name}`}>
                    {learner.name}
                    <span className="muted"> · {sexLabel(learner.sex)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">Everyone in this file is already on the roster for this grade and section.</p>
            )}
            <p className="muted">
              Age and emergency contact are not in this file. Add those later on each student record.
            </p>
          </>
        ) : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !plan || plan.toAdd.length === 0}
            onClick={() => void onImport()}
          >
            {busy ? 'Adding…' : plan ? `Add ${plan.toAdd.length} students` : 'Add students'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteStudentDialog({
  student,
  onClose,
  onDeleted,
}: {
  student: Student
  onClose: () => void
  onDeleted: () => void
}) {
  const [phrase, setPhrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const confirmed = phrase.trim() === DELETE_CONFIRMATION

  async function onDelete(event: FormEvent) {
    event.preventDefault()
    if (!confirmed) {
      setError('Type confirm to delete this student.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await deleteStudent(student.id)
      onDeleted()
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-back" role="presentation" onMouseDown={() => { if (!busy) onClose() }}>
      <div
        className="modal"
        role="dialog"
        aria-labelledby="delete-student-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="delete-student-title">Delete {student.full_name}</h2>
        <p className="muted">
          This removes the student and the cases, sessions, and files on their record. It cannot be undone.
        </p>
        <form onSubmit={(event) => void onDelete(event)}>
          <Field label="Type confirm to delete">
            <input
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              autoComplete="off"
              autoFocus
            />
          </Field>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={busy || !confirmed}>
              {busy ? 'Deleting…' : 'Delete student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
