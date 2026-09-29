import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.tsx'
import { Banner, Field, FilePicker, OpenFileButton, PageHeader, SavedFiles, StatusPill, useEditWindow } from '../components/ui.tsx'
import {
  createCase,
  createPlan,
  createSession,
  deleteCallSlip,
  deleteCase,
  deletePlan,
  deleteSession,
  deleteStudentFile,
  deleteWaiver,
  fetchStudentDetail,
  updateCallSlip,
  updateCase,
  updateDocument,
  updatePlan,
  updatePlanStatus,
  updateSession,
  updateStudent,
  updateStudentStatus,
  updateWaiver,
  uploadStudentFile,
} from '../lib/api.ts'
import { ATTACHABLE_ACCEPT, ATTACHABLE_EXTENSIONS } from '../lib/files.ts'
import {
  composeFullName,
  dateTimeLocalValue,
  formatDateOnly,
  formatTimestamp,
  messageFrom,
  NAME_PATTERN_SOURCE,
  optionalLetters,
  optionalText,
  parseOptionalAge,
  recorded,
  requiredLetters,
  requiredSex,
  requiredText,
  sanitizeLetters,
  splitFullName,
  todayInputValue,
} from '../lib/format.ts'
import {
  CASE_CATEGORIES,
  DOCUMENT_TYPES,
  optionLabel,
  PLAN_STATUSES,
  SESSION_TYPES,
  SEX_OPTIONS,
  sexLabel,
  statusHint,
  statusLabel,
  STATUS_OPTIONS,
} from '../lib/labels.ts'
import { useOffice } from '../office/OfficeContext.tsx'
import type {
  ActionPlan,
  CallSlip,
  CaseCategory,
  CaseNote,
  DocumentType,
  GuidanceDocument,
  GuidanceStatus,
  PlanStatus,
  SessionLog,
  SessionType,
  Student,
  StudentDetail,
  StudentInput,
  StudentSex,
  WaiverRecord,
} from '../lib/types.ts'

export function StudentRecord() {
  const { studentId = '' } = useParams()
  const { profile } = useAuth()
  const { students, loading, refresh, openAlerts } = useOffice()
  const student = students.find((item) => item.id === studentId) ?? null
  const [detail, setDetail] = useState<StudentDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [statusOpen, setStatusOpen] = useState(false)

  const loadDetail = useCallback(async () => {
    try {
      setDetail(await fetchStudentDetail(studentId))
      setDetailError(null)
    } catch (caught) {
      setDetailError(messageFrom(caught))
    }
  }, [studentId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  if (loading) return <p className="muted">Loading student…</p>
  if (!student || !profile) {
    return (
      <div className="page">
        <p>This student is not in your records.</p>
        <Link to="/">Back to students</Link>
      </div>
    )
  }

  const studentAlert = openAlerts.find((alert) => alert.student_id === student.id)

  return (
    <div className="page">
      <p className="back"><Link to="/">All students</Link></p>
      <PageHeader
        title={student.full_name}
        lede={[
          `${student.grade_level} - ${student.section}`,
          student.sex ? sexLabel(student.sex) : null,
          student.age == null ? null : `Age ${student.age}`,
        ].filter(Boolean).join(' · ')}
        actions={
          <>
            <Link className="btn btn-primary" to={`/students/${student.id}/call-slip`}>Call slip</Link>
            <Link className="btn btn-ghost" to={`/students/${student.id}/waiver`}>Waiver</Link>
          </>
        }
      />
      {studentAlert ? (
        <Banner tone="warn">This student has an open critical alert from {formatTimestamp(studentAlert.created_at)}.</Banner>
      ) : null}
      <section className="panel">
        <div className="status-heading">
          <div className="status-title">
            <h2>Status</h2>
            <StatusPill status={student.status} large />
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setStatusOpen(true)}>
            Update status
          </button>
        </div>
        <p className="muted">{statusHint(student.status)}</p>
        {detail && detail.events.length > 0 ? (
          <ol className="timeline">
            {detail.events.map((event) => (
              <li key={event.id} className="timeline-item">
                <span className="timeline-rail" aria-hidden="true">
                  <span className="timeline-dot" />
                </span>
                <div className="timeline-content">
                  <p className="timeline-date">{formatTimestamp(event.created_at)}</p>
                  <p className="timeline-title">
                    {event.from_status
                      ? `${statusLabel(event.from_status)} to ${statusLabel(event.to_status)}`
                      : `Opened as ${statusLabel(event.to_status)}`}
                  </p>
                  {event.description ? <p className="timeline-note">{event.description}</p> : null}
                  {event.actor_name ? <p className="timeline-actor">Updated by {event.actor_name}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
      {statusOpen ? (
        <StatusDialog
          current={student.status}
          onClose={() => setStatusOpen(false)}
          onSave={async (next, description) => {
            await updateStudentStatus(student.id, next, description)
            await refresh()
            await loadDetail()
          }}
        />
      ) : null}

      <InfoSection student={student} onSaved={async () => { await refresh() }} />

      {detailError ? <Banner tone="error">{detailError}</Banner> : null}
      {detail ? (
        <>
          <CasesSection studentId={student.id} detail={detail} userId={profile.id} onChanged={loadDetail} />
          <PlansSection studentId={student.id} detail={detail} userId={profile.id} onChanged={loadDetail} />
          <SessionsSection studentId={student.id} detail={detail} userId={profile.id} onChanged={loadDetail} />
          <DocumentsSection student={student} detail={detail} userId={profile.id} onChanged={loadDetail} />
        </>
      ) : (
        <p className="muted">Loading the record…</p>
      )}
    </div>
  )
}

function StatusDialog({
  current,
  onClose,
  onSave,
}: {
  current: GuidanceStatus
  onClose: () => void
  onSave: (status: GuidanceStatus, description: string) => Promise<void>
}) {
  const [next, setNext] = useState<GuidanceStatus>(current)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const willAlert = next === 'critical' && current !== 'critical'

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (next === current) {
      setError('Choose a different status.')
      return
    }
    try {
      const note = requiredText(description, 'Description')
      setBusy(true)
      await onSave(next, note)
      onClose()
    } catch (caught) {
      setError(messageFrom(caught))
      setBusy(false)
    }
  }

  return (
    <div className="modal-back" role="presentation" onMouseDown={() => { if (!busy) onClose() }}>
      <div
        className="modal"
        role="dialog"
        aria-labelledby="status-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="status-dialog-title">Update status</h2>
        <form onSubmit={(event) => void onSubmit(event)}>
          <Field label="Status">
            <select value={next} onChange={(event) => setNext(event.target.value as GuidanceStatus)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <p className="muted">{statusHint(next)}</p>
          {willAlert ? (
            <p className="warn-copy">This notifies every counselor. The alert stays until someone acknowledges it.</p>
          ) : null}
          <Field label="Description">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              required
            />
          </Field>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InfoSection({
  student,
  onSaved,
}: {
  student: Student
  onSaved: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const initialName = splitFullName(student.full_name)
  const [lastName, setLastName] = useState(initialName.lastName)
  const [firstName, setFirstName] = useState(initialName.firstName)
  const [middleName, setMiddleName] = useState(initialName.middleName)
  const [gradeLevel, setGradeLevel] = useState(student.grade_level)
  const [section, setSection] = useState(student.section)
  const [sex, setSex] = useState<StudentSex | ''>(student.sex ?? '')
  const [age, setAge] = useState(student.age == null ? '' : String(student.age))
  const [contactName, setContactName] = useState(
    student.emergency_contact_name ?? ''
  )
  const [contactPhone, setContactPhone] = useState(
    student.emergency_contact_phone ?? ''
  )
  const [relationship, setRelationship] = useState(
    student.emergency_contact_relationship ?? ''
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const parsedName = splitFullName(student.full_name)
    setLastName(parsedName.lastName)
    setFirstName(parsedName.firstName)
    setMiddleName(parsedName.middleName)
    setGradeLevel(student.grade_level)
    setSection(student.section)
    setSex(student.sex ?? '')
    setAge(student.age == null ? '' : String(student.age))
    setContactName(student.emergency_contact_name ?? '')
    setContactPhone(student.emergency_contact_phone ?? '')
    setRelationship(student.emergency_contact_relationship ?? '')
  }, [student])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const input: StudentInput = {
        full_name: composeFullName(
          requiredLetters(firstName, 'First name'),
          optionalLetters(middleName, 'Middle name') ?? '',
          requiredLetters(lastName, 'Last name'),
        ),
        grade_level: requiredText(gradeLevel, 'Grade'),
        section: requiredText(section, 'Section'),
        sex: requiredSex(sex),
        age: parseOptionalAge(age),
        emergency_contact_name: optionalLetters(contactName, 'Emergency contact'),
        emergency_contact_phone: optionalText(contactPhone),
        emergency_contact_relationship: relationship.trim() || null,
      }

      await updateStudent(student.id, input)
      await onSaved()
      setEditing(false)
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <div className="section-head">
        <h2>Student information</h2>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setEditing((open) => !open)}
        >
          {editing ? 'Close' : 'Edit'}
        </button>
      </div>

      {editing ? (
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
              <input
                value={gradeLevel}
                onChange={(event) => setGradeLevel(event.target.value)}
                placeholder="e.g. Grade 8"
                required
              />
            </Field>

            <Field label="Section">
              <input
                value={section}
                onChange={(event) => setSection(event.target.value)}
                placeholder="e.g. MAKABAYAN"
                required
              />
            </Field>

            <Field label="Sex">
              <select
                value={sex}
                onChange={(event) =>
                  setSex(event.target.value as StudentSex | '')
                }
                required
              >
                <option value="">Select sex</option>

                {SEX_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Age">
              <input
                value={age}
                onChange={(event) =>
                  setAge(event.target.value.replace(/\D/g, '').slice(0, 2))
                }
                placeholder="e.g. 14"
                inputMode="numeric"
                pattern="[0-9]{1,2}"
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
            />
          </Field>

          <div className="split">
            <Field label="Contact number">
              <input
                type="tel"
                value={contactPhone}
                onChange={(event) =>
                  setContactPhone(
                    event.target.value.replace(/\D/g, '').slice(0, 11)
                  )
                }
                placeholder="e.g. 09171234567"
                required
                minLength={11}
                maxLength={11}
                pattern="[0-9]{11}"
                inputMode="numeric"
                title="Contact number must contain exactly 11 digits."
              />
            </Field>

            <Field label="Relationship">
              <input
                value={relationship}
                onChange={(event) => setRelationship(event.target.value)}
                placeholder="e.g. Mother"
              />
            </Field>
          </div>

          {error ? <Banner tone="error">{error}</Banner> : null}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Save information'}
          </button>
        </form>
      ) : (
        <dl className="info-grid">
          <dt>Name</dt>
          <dd>{student.full_name}</dd>
          <dt>Grade</dt>
          <dd>{student.grade_level}</dd>
          <dt>Section</dt>
          <dd>{student.section}</dd>
          <dt>Age</dt>
          <dd>{student.age}</dd>
          <dt>Sex</dt>
          <dd>{sexLabel(student.sex)}</dd>

          <dt>Emergency contact</dt>
          <dd>
            {student.emergency_contact_name
              ? `${student.emergency_contact_name}${
                  student.emergency_contact_relationship
                    ? ` (${student.emergency_contact_relationship})`
                    : ''
                }`
              : 'Not recorded'}
          </dd>

          <dt>Contact number</dt>
          <dd>{recorded(student.emergency_contact_phone)}</dd>

          <dt>Last updated</dt>
          <dd>{formatTimestamp(student.updated_at)}</dd>
        </dl>
      )}
    </section>
  )
}

function CasesSection({
  studentId,
  detail,
  userId,
  onChanged,
}: {
  studentId: string
  detail: StudentDetail
  userId: string
  onChanged: () => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<CaseCategory>('case')
  const [occurredOn, setOccurredOn] = useState('')
  const [narrative, setNarrative] = useState('')
  const [perpetrator, setPerpetrator] = useState('')
  const [victim, setVictim] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [studentsConference, setStudentsConference] = useState('')
  const [parentalConference, setParentalConference] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const caseTitle = requiredText(title, 'Title')
      const notes = category === 'case'
        ? {
          narrative: requiredText(narrative, 'Narrative'),
          perpetrator: optionalText(perpetrator),
          victim: optionalText(victim),
          additionalNotes: optionalText(additionalNotes),
          studentsConference: null,
          parentalConference: null,
        }
        : {
          narrative: null,
          perpetrator: null,
          victim: null,
          additionalNotes: null,
          studentsConference: optionalText(studentsConference),
          parentalConference: optionalText(parentalConference),
        }
      if (category === 'sanction' && !notes.studentsConference && !notes.parentalConference) {
        throw new Error('Add the students conference or the parental conference.')
      }
      const caseId = await createCase({
        studentId,
        title: caseTitle,
        category,
        occurredOn: occurredOn || null,
        recordedBy: userId,
        ...notes,
      })
      const fileNote = category === 'case'
        ? notes.narrative
        : [notes.studentsConference, notes.parentalConference].filter(Boolean).join('\n\n')
      for (const file of files) {
        await uploadStudentFile({
          studentId,
          file,
          extension: fileExtension(file.name),
          folder: 'case-files',
          docType: 'case_file',
          title: files.length === 1 ? caseTitle : `${caseTitle} — ${file.name}`,
          description: fileNote,
          caseHistoryId: caseId,
          createdBy: userId,
        })
      }
      setTitle('')
      setNarrative('')
      setPerpetrator('')
      setVictim('')
      setAdditionalNotes('')
      setStudentsConference('')
      setParentalConference('')
      setOccurredOn('')
      setFiles([])
      await onChanged()
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <h2>Case history</h2>
      {detail.cases.length === 0 ? <p className="muted">No cases yet.</p> : (
        <ul className="entries">
          {detail.cases.map((item) => (
            <CaseEntry
              key={item.id}
              item={item}
              studentId={studentId}
              userId={userId}
              documents={detail.documents.filter((document) => document.case_history_id === item.id)}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
      <details className="adder">
        <summary>Add to case history</summary>
        <form onSubmit={(event) => void onSubmit(event)}>
          <Field label="Title"><input value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
          <div className="split">
            <Field label="Category">
              <select value={category} onChange={(event) => setCategory(event.target.value as CaseCategory)}>
                {CASE_CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} />
            </Field>
          </div>
          {category === 'case' ? (
            <>
              <Field label="Narrative">
                <textarea value={narrative} onChange={(event) => setNarrative(event.target.value)} rows={4} required />
              </Field>
              <div className="split">
                <Field label="Perpetrator">
                  <input value={perpetrator} onChange={(event) => setPerpetrator(event.target.value)} />
                </Field>
                <Field label="Victim">
                  <input value={victim} onChange={(event) => setVictim(event.target.value)} />
                </Field>
              </div>
              <Field label="Additional notes">
                <textarea value={additionalNotes} onChange={(event) => setAdditionalNotes(event.target.value)} rows={3} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Students conference">
                <textarea value={studentsConference} onChange={(event) => setStudentsConference(event.target.value)} rows={4} />
              </Field>
              <Field label="Parental conference">
                <textarea value={parentalConference} onChange={(event) => setParentalConference(event.target.value)} rows={4} />
              </Field>
            </>
          )}
          <FilePicker
            label="Attach files (optional)"
            accept={ATTACHABLE_ACCEPT}
            extensions={ATTACHABLE_EXTENSIONS}
            files={files}
            disabled={busy}
            emptyLabel="Drop files here"
            hint="or choose files · PDF, Word, or image"
            onFiles={(next) => {
              setError(null)
              setFiles(next)
            }}
            onReject={setError}
          />
          {error ? <Banner tone="error">{error}</Banner> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </form>
      </details>
    </section>
  )
}

function CaseFields({ item }: { item: CaseNote }) {
  const rows = item.category === 'sanction'
    ? [
      ['Students conference', item.students_conference],
      ['Parental conference', item.parental_conference],
    ]
    : [
      ['Narrative', item.narrative],
      ['Perpetrator', item.perpetrator],
      ['Victim', item.victim],
      ['Additional notes', item.additional_notes],
    ]
  const filled = rows.filter((row): row is [string, string] => Boolean(row[1]))
  if (filled.length === 0) return null
  return (
    <dl className="info-grid case-fields">
      {filled.map(([label, value]) => (
        <Fragment key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

function PlansSection({
  studentId,
  detail,
  userId,
  onChanged,
}: {
  studentId: string
  detail: StudentDetail
  userId: string
  onChanged: () => Promise<void>
}) {
  const [goal, setGoal] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createPlan({
        studentId,
        goal: requiredText(goal, 'Goal'),
        targetDate: targetDate || null,
        createdBy: userId,
      })
      setGoal('')
      setTargetDate('')
      await onChanged()
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(planId: string, next: PlanStatus) {
    setError(null)
    try {
      await updatePlanStatus(planId, next)
      await onChanged()
    } catch (caught) {
      setError(messageFrom(caught))
    }
  }

  return (
    <section className="panel">
      <h2>Action plan</h2>
      {detail.plans.length === 0 ? <p className="muted">No goals yet.</p> : (
        <ul className="entries">
          {detail.plans.map((plan) => (
            <PlanEntry key={plan.id} plan={plan} onChanged={onChanged} onStatus={(next) => changeStatus(plan.id, next)} />
          ))}
        </ul>
      )}
      <details className="adder">
        <summary>Add a goal</summary>
        <form onSubmit={(event) => void onSubmit(event)}>
          <Field label="Goal">
            <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} required />
          </Field>
          <Field label="Target date">
            <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
          </Field>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save goal'}</button>
        </form>
      </details>
    </section>
  )
}

function SessionsSection({
  studentId,
  detail,
  userId,
  onChanged,
}: {
  studentId: string
  detail: StudentDetail
  userId: string
  onChanged: () => Promise<void>
}) {
  const [sessionDate, setSessionDate] = useState(todayInputValue())
  const [sessionType, setSessionType] = useState<SessionType>('routine')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createSession({
        studentId,
        sessionDate,
        sessionType,
        notes: requiredText(notes, 'Notes'),
        counselorId: userId,
      })
      setNotes('')
      setSessionDate(todayInputValue())
      await onChanged()
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <h2>Session logs</h2>
      {detail.sessions.length === 0 ? <p className="muted">No sessions yet.</p> : (
        <ul className="entries">
          {detail.sessions.map((session) => (
            <SessionEntry key={session.id} session={session} onChanged={onChanged} />
          ))}
        </ul>
      )}
      <details className="adder">
        <summary>Add a session</summary>
        <form onSubmit={(event) => void onSubmit(event)}>
          <div className="split">
            <Field label="Date">
              <input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} required />
            </Field>
            <Field label="Type">
              <select value={sessionType} onChange={(event) => setSessionType(event.target.value as SessionType)}>
                {SESSION_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} required />
          </Field>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save session'}</button>
        </form>
      </details>
    </section>
  )
}

function DocumentsSection({
  student,
  detail,
  userId,
  onChanged,
}: {
  student: Student
  detail: StudentDetail
  userId: string
  onChanged: () => Promise<void>
}) {
  const [docType, setDocType] = useState<DocumentType>('other')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (files.length === 0) {
      setError('Choose a file to upload.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const label = requiredText(title, 'Title')
      for (const file of files) {
        await uploadStudentFile({
          studentId: student.id,
          file,
          extension: fileExtension(file.name),
          folder: 'uploads',
          docType,
          title: files.length === 1 ? label : `${label} — ${file.name}`,
          description: description.trim() || null,
          caseHistoryId: null,
          createdBy: userId,
        })
      }
      setTitle('')
      setDescription('')
      setFiles([])
      await onChanged()
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <div className="section-head">
        <h2>Documents</h2>
        {/* <div className="page-actions">
          <Link className="btn btn-primary" to={`/students/${student.id}/call-slip`}>Create call slip</Link>
          <Link className="btn btn-ghost" to={`/students/${student.id}/waiver`}>Create waiver</Link>
        </div> */}
      </div>
      <h3>Call slips</h3>
      {detail.callSlips.length === 0 ? <p className="muted">No call slips yet.</p> : (
        <ul className="entries">
          {detail.callSlips.map((slip) => (
            <CallSlipEntry key={slip.id} slip={slip} onChanged={onChanged} />
          ))}
        </ul>
      )}
      <h3>Waivers</h3>
      {detail.waivers.length === 0 ? <p className="muted">No waivers yet.</p> : (
        <ul className="entries">
          {detail.waivers.map((waiver) => (
            <WaiverEntry key={waiver.id} waiver={waiver} onChanged={onChanged} />
          ))}
        </ul>
      )}
      <h3>Files</h3>
      {detail.documents.length === 0 ? <p className="muted">No files yet.</p> : (
        <ul className="entries">
          {detail.documents.map((document) => (
            <DocumentEntry key={document.id} document={document} onChanged={onChanged} />
          ))}
        </ul>
      )}
      <details className="adder">
        <summary>Upload a document</summary>
        <form onSubmit={(event) => void onSubmit(event)}>
          <Field label="Title"><input value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
          <Field label="Type">
            <select value={docType} onChange={(event) => setDocType(event.target.value as DocumentType)}>
              {DOCUMENT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </Field>
          <FilePicker
            label="Files"
            accept={ATTACHABLE_ACCEPT}
            extensions={ATTACHABLE_EXTENSIONS}
            files={files}
            disabled={busy}
            emptyLabel="Drop files here"
            hint="or choose files · PDF, Word, or image"
            onFiles={(next) => {
              setError(null)
              setFiles(next)
            }}
            onReject={setError}
          />
          {error ? <Banner tone="error">{error}</Banner> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
        </form>
      </details>
    </section>
  )
}

function EntryPair({ lead, detail }: { lead: string; detail: string }) {
  return (
    <div className="entry-pair">
      <strong>{lead}</strong>
      <span className="entry-divider" aria-hidden="true" />
      <span>{detail}</span>
    </div>
  )
}

function EntryTools({
  createdAt,
  busy,
  onEdit,
  onDelete,
}: {
  createdAt: string
  busy: boolean
  onEdit: () => void
  onDelete: () => Promise<void>
}) {
  const open = useEditWindow(createdAt)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!open) return null
  return (
    <div className="row-actions">
      <button type="button" className="btn btn-ghost btn-small" onClick={onEdit} disabled={busy}>Edit</button>
      {confirming ? (
        <>
          <button
            type="button"
            className="btn btn-danger btn-small"
            disabled={busy}
            onClick={() => {
              void onDelete().catch((caught) => {
                setError(messageFrom(caught))
                setConfirming(false)
              })
            }}
          >
            Confirm delete
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
        </>
      ) : (
        <button type="button" className="btn btn-danger btn-small" onClick={() => setConfirming(true)} disabled={busy}>Delete</button>
      )}
      {error ? <Banner tone="error">{error}</Banner> : null}
    </div>
  )
}

function CaseEntry({
  item,
  studentId,
  userId,
  documents,
  onChanged,
}: {
  item: CaseNote
  studentId: string
  userId: string
  documents: GuidanceDocument[]
  onChanged: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [category, setCategory] = useState<CaseCategory>(item.category)
  const [occurredOn, setOccurredOn] = useState(item.occurred_on ?? '')
  const [narrative, setNarrative] = useState(item.narrative ?? '')
  const [perpetrator, setPerpetrator] = useState(item.perpetrator ?? '')
  const [victim, setVictim] = useState(item.victim ?? '')
  const [additionalNotes, setAdditionalNotes] = useState(item.additional_notes ?? '')
  const [studentsConference, setStudentsConference] = useState(item.students_conference ?? '')
  const [parentalConference, setParentalConference] = useState(item.parental_conference ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function beginEdit() {
    setTitle(item.title)
    setCategory(item.category)
    setOccurredOn(item.occurred_on ?? '')
    setNarrative(item.narrative ?? '')
    setPerpetrator(item.perpetrator ?? '')
    setVictim(item.victim ?? '')
    setAdditionalNotes(item.additional_notes ?? '')
    setStudentsConference(item.students_conference ?? '')
    setParentalConference(item.parental_conference ?? '')
    setFiles([])
    setError(null)
    setEditing(true)
  }

  async function onSave(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const caseTitle = requiredText(title, 'Title')
      const notes = category === 'case'
        ? {
          narrative: requiredText(narrative, 'Narrative'),
          perpetrator: optionalText(perpetrator),
          victim: optionalText(victim),
          additionalNotes: optionalText(additionalNotes),
          studentsConference: null,
          parentalConference: null,
        }
        : {
          narrative: null,
          perpetrator: null,
          victim: null,
          additionalNotes: null,
          studentsConference: optionalText(studentsConference),
          parentalConference: optionalText(parentalConference),
        }
      if (category === 'sanction' && !notes.studentsConference && !notes.parentalConference) {
        throw new Error('Add the students conference or the parental conference.')
      }
      await updateCase(item.id, {
        title: caseTitle,
        category,
        occurredOn: occurredOn || null,
        ...notes,
      })
      const fileNote = category === 'case'
        ? notes.narrative
        : [notes.studentsConference, notes.parentalConference].filter(Boolean).join('\n\n')
      for (const file of files) {
        await uploadStudentFile({
          studentId,
          file,
          extension: fileExtension(file.name),
          folder: 'case-files',
          docType: 'case_file',
          title: files.length === 1 ? caseTitle : `${caseTitle} — ${file.name}`,
          description: fileNote,
          caseHistoryId: item.id,
          createdBy: userId,
        })
      }
      setEditing(false)
      setFiles([])
      await onChanged()
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li>
      {editing ? (
        <form onSubmit={(event) => void onSave(event)}>
          <Field label="Title"><input value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
          <div className="split">
            <Field label="Category">
              <select value={category} onChange={(event) => setCategory(event.target.value as CaseCategory)}>
                {CASE_CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} />
            </Field>
          </div>
          {category === 'case' ? (
            <>
              <Field label="Narrative">
                <textarea value={narrative} onChange={(event) => setNarrative(event.target.value)} rows={4} required />
              </Field>
              <div className="split">
                <Field label="Perpetrator">
                  <input value={perpetrator} onChange={(event) => setPerpetrator(event.target.value)} />
                </Field>
                <Field label="Victim">
                  <input value={victim} onChange={(event) => setVictim(event.target.value)} />
                </Field>
              </div>
              <Field label="Additional notes">
                <textarea value={additionalNotes} onChange={(event) => setAdditionalNotes(event.target.value)} rows={3} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Students conference">
                <textarea value={studentsConference} onChange={(event) => setStudentsConference(event.target.value)} rows={4} />
              </Field>
              <Field label="Parental conference">
                <textarea value={parentalConference} onChange={(event) => setParentalConference(event.target.value)} rows={4} />
              </Field>
            </>
          )}
          <FilePicker
            label="Attach files (optional)"
            accept={ATTACHABLE_ACCEPT}
            extensions={ATTACHABLE_EXTENSIONS}
            files={files}
            disabled={busy}
            emptyLabel="Drop files here"
            hint="or choose files · PDF, Word, or image"
            onFiles={(next) => {
              setError(null)
              setFiles(next)
            }}
            onReject={setError}
          />
          {error ? <Banner tone="error">{error}</Banner> : null}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      ) : (
        <>
          <div className="entry-top">
            <EntryPair lead={item.title} detail={optionLabel(CASE_CATEGORIES, item.category)} />
            <EntryTools
              createdAt={item.created_at}
              busy={busy}
              onEdit={beginEdit}
              onDelete={async () => {
                await deleteCase(item.id)
                await onChanged()
              }}
            />
          </div>
          {item.occurred_on ? <p className="muted">{formatDateOnly(item.occurred_on)}</p> : null}
          <CaseFields item={item} />
          <SavedFiles
            files={documents}
            onRemove={async (id, storagePath) => {
              await deleteStudentFile(id, storagePath)
              await onChanged()
            }}
          />
        </>
      )}
    </li>
  )
}

function StatusSelect({
  value,
  disabled,
  onChange,
}: {
  value: PlanStatus
  disabled: boolean
  onChange: (next: PlanStatus) => void
}) {
  return (
    <label className="plan-status-field">
      <span>Status</span>
      <select
        className="plan-status"
        aria-label="Goal status"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as PlanStatus)}
      >
        {PLAN_STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function PlanEntry({
  plan,
  onChanged,
  onStatus,
}: {
  plan: ActionPlan
  onChanged: () => Promise<void>
  onStatus: (next: PlanStatus) => Promise<void>
}) {
  const editable = useEditWindow(plan.created_at)
  const [editing, setEditing] = useState(false)
  const [goal, setGoal] = useState(plan.goal)
  const [targetDate, setTargetDate] = useState(plan.target_date ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSave(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updatePlan(plan.id, {
        goal: requiredText(goal, 'Goal'),
        status: plan.status,
        targetDate: targetDate || null,
      })
      setEditing(false)
      await onChanged()
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li>
      {editing ? (
        <form onSubmit={(event) => void onSave(event)}>
          <Field label="Goal">
            <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} required />
          </Field>
          <StatusSelect value={plan.status} disabled={!editable || busy} onChange={(next) => void onStatus(next)} />
          <Field label="Target date">
            <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
          </Field>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      ) : (
        <>
          <div className="entry-top">
            <strong>{plan.goal}</strong>
            <EntryTools
              createdAt={plan.created_at}
              busy={busy}
              onEdit={() => {
                setGoal(plan.goal)
                setTargetDate(plan.target_date ?? '')
                setEditing(true)
              }}
              onDelete={async () => {
                await deletePlan(plan.id)
                await onChanged()
              }}
            />
          </div>
          <StatusSelect value={plan.status} disabled={!editable} onChange={(next) => void onStatus(next)} />
          {plan.target_date ? <p className="muted">Target {formatDateOnly(plan.target_date)}</p> : null}
        </>
      )}
    </li>
  )
}

function SessionEntry({ session, onChanged }: { session: SessionLog; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [sessionDate, setSessionDate] = useState(session.session_date)
  const [sessionType, setSessionType] = useState<SessionType>(session.session_type)
  const [notes, setNotes] = useState(session.notes)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSave(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updateSession(session.id, {
        sessionDate,
        sessionType,
        notes: requiredText(notes, 'Notes'),
      })
      setEditing(false)
      await onChanged()
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li>
      {editing ? (
        <form onSubmit={(event) => void onSave(event)}>
          <div className="split">
            <Field label="Date">
              <input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} required />
            </Field>
            <Field label="Type">
              <select value={sessionType} onChange={(event) => setSessionType(event.target.value as SessionType)}>
                {SESSION_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} required />
          </Field>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      ) : (
        <>
          <div className="entry-top">
            <EntryPair lead={formatDateOnly(session.session_date)} detail={optionLabel(SESSION_TYPES, session.session_type)} />
            <EntryTools
              createdAt={session.created_at}
              busy={busy}
              onEdit={() => {
                setSessionDate(session.session_date)
                setSessionType(session.session_type)
                setNotes(session.notes)
                setEditing(true)
              }}
              onDelete={async () => {
                await deleteSession(session.id)
                await onChanged()
              }}
            />
          </div>
          <p>{session.notes}</p>
          {session.counselor_name ? <p className="muted">{session.counselor_name}</p> : null}
        </>
      )}
    </li>
  )
}

function DocumentEntry({ document, onChanged }: { document: GuidanceDocument; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(document.title)
  const [docType, setDocType] = useState<DocumentType>(document.doc_type)
  const [description, setDescription] = useState(document.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSave(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updateDocument(document.id, {
        title: requiredText(title, 'Title'),
        docType,
        description: description.trim() || null,
      })
      setEditing(false)
      await onChanged()
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="file-row">
      <SavedFiles
        files={[document]}
        onRemove={async (id, storagePath) => {
          await deleteStudentFile(id, storagePath)
          await onChanged()
        }}
      />
      <div>
        {editing ? (
          <form onSubmit={(event) => void onSave(event)}>
            <Field label="Title"><input value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
            <Field label="Type">
              <select value={docType} onChange={(event) => setDocType(event.target.value as DocumentType)}>
                {DOCUMENT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Description">
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </Field>
            {error ? <Banner tone="error">{error}</Banner> : null}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        ) : (
          <>
            <div className="entry-top">
              <strong>{document.title}</strong>
              <EntryTools
                createdAt={document.created_at}
                busy={busy}
                onEdit={() => {
                  setTitle(document.title)
                  setDocType(document.doc_type)
                  setDescription(document.description ?? '')
                  setEditing(true)
                }}
                onDelete={async () => {
                  await deleteStudentFile(document.id, document.storage_path)
                  await onChanged()
                }}
              />
            </div>
            <p className="muted">{optionLabel(DOCUMENT_TYPES, document.doc_type)} · {formatTimestamp(document.created_at)}</p>
            {document.description ? <p>{document.description}</p> : null}
          </>
        )}
      </div>
    </li>
  )
}

function CallSlipEntry({ slip, onChanged }: { slip: CallSlip; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [scheduledLocal, setScheduledLocal] = useState(dateTimeLocalValue(slip.scheduled_at))
  const [guardianName, setGuardianName] = useState(slip.guardian_name)
  const [reason, setReason] = useState(slip.reason)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSave(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const when = new Date(scheduledLocal)
      if (Number.isNaN(when.getTime())) throw new Error('Choose a date and time.')
      await updateCallSlip(slip.id, {
        scheduledAt: when.toISOString(),
        guardianName: requiredText(guardianName, 'Guardian'),
        reason: requiredText(reason, 'Reason'),
      })
      setEditing(false)
      await onChanged()
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li>
      {editing ? (
        <form onSubmit={(event) => void onSave(event)}>
          <Field label="Schedule">
            <input type="datetime-local" value={scheduledLocal} onChange={(event) => setScheduledLocal(event.target.value)} required />
          </Field>
          <Field label="Guardian">
            <input value={guardianName} onChange={(event) => setGuardianName(event.target.value)} required />
          </Field>
          <Field label="Reason">
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required />
          </Field>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      ) : (
        <>
          <div className="entry-top">
            <strong>{formatTimestamp(slip.scheduled_at)}</strong>
            <div className="row-actions">
              {slip.document ? <OpenFileButton path={slip.document.storage_path} label="Open PDF" /> : null}
              <EntryTools
                createdAt={slip.created_at}
                busy={busy}
                onEdit={() => {
                  setScheduledLocal(dateTimeLocalValue(slip.scheduled_at))
                  setGuardianName(slip.guardian_name)
                  setReason(slip.reason)
                  setEditing(true)
                }}
                onDelete={async () => {
                  await deleteCallSlip(slip.id)
                  await onChanged()
                }}
              />
            </div>
          </div>
          <p>{slip.reason}</p>
          <p className="muted">{slip.guardian_name}</p>
        </>
      )}
    </li>
  )
}

function WaiverEntry({ waiver, onChanged }: { waiver: WaiverRecord; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [guardianName, setGuardianName] = useState(waiver.guardian_name)
  const [purpose, setPurpose] = useState(waiver.purpose)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSave(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updateWaiver(waiver.id, {
        guardianName: requiredText(guardianName, 'Guardian'),
        purpose: requiredText(purpose, 'Purpose'),
      })
      setEditing(false)
      await onChanged()
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li>
      {editing ? (
        <form onSubmit={(event) => void onSave(event)}>
          <Field label="Guardian">
            <input value={guardianName} onChange={(event) => setGuardianName(event.target.value)} required />
          </Field>
          <Field label="Purpose">
            <textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} rows={3} required />
          </Field>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      ) : (
        <>
          <div className="entry-top">
            <strong>{waiver.guardian_name}</strong>
            <div className="row-actions">
              {waiver.document ? <OpenFileButton path={waiver.document.storage_path} label="Open PDF" /> : null}
              <EntryTools
                createdAt={waiver.created_at}
                busy={busy}
                onEdit={() => {
                  setGuardianName(waiver.guardian_name)
                  setPurpose(waiver.purpose)
                  setEditing(true)
                }}
                onDelete={async () => {
                  await deleteWaiver(waiver.id)
                  await onChanged()
                }}
              />
            </div>
          </div>
          <p>{waiver.purpose}</p>
          <p className="muted">{formatTimestamp(waiver.created_at)}</p>
        </>
      )}
    </li>
  )
}

function fileExtension(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase() ?? 'bin'
  return /^[a-z0-9]{1,5}$/.test(extension) ? extension : 'bin'
}
