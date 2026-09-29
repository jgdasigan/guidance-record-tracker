import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.tsx'
import { PdfResult } from '../components/PdfResult.tsx'
import { Banner, Field, PageHeader } from '../components/ui.tsx'
import { insertWaiver, updateWaiver, uploadStudentFile } from '../lib/api.ts'
import { downloadPdf, printPdf } from '../lib/files.ts'
import { downloadName, messageFrom, recorded, requiredText } from '../lib/format.ts'
import { useOffice } from '../office/OfficeContext.tsx'
import { renderWaiver } from '../pdf/waiver.tsx'

export function WaiverPage() {
  const { studentId = '' } = useParams()
  const { profile } = useAuth()
  const { students, school, loading } = useOffice()
  const student = students.find((item) => item.id === studentId) ?? null
  const [guardianName, setGuardianName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [seeded, setSeeded] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewKey, setPreviewKey] = useState('')
  const [waiverId, setWaiverId] = useState<string | null>(null)
  const [attached, setAttached] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!student || seeded) return
    setGuardianName(student.emergency_contact_name ?? '')
    setSeeded(true)
  }, [seeded, student])

  const formKey = `${guardianName}|${purpose}`
  const previewFresh = blob != null && previewKey === formKey

  if (loading) return <p className="muted">Loading student…</p>
  if (!student || !profile) {
    return (
      <div className="page">
        <p>This student is not in your records.</p>
        <Link to="/">Back to students</Link>
      </div>
    )
  }

  async function createPreview(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      const next = await renderWaiver({
        schoolName: school.school_name,
        officeName: school.office_name,
        studentName: student!.full_name,
        gradeLevel: student!.grade_level,
        section: student!.section,
        age: student!.age,
        guardianName: requiredText(guardianName, 'Parent or guardian'),
        relationship: student!.emergency_contact_relationship,
        phone: student!.emergency_contact_phone ?? '',
        purpose: requiredText(purpose, 'Purpose'),
        counselorName: profile!.full_name,
        issuedAt: new Date(),
      })
      setBlob(next)
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return URL.createObjectURL(next)
      })
      setPreviewKey(`${guardianName}|${purpose}`)
      setAttached(false)
    } catch (caught) {
      setError(messageFrom(caught))
    }
  }

  async function rememberWaiver(documentId: string | null): Promise<void> {
    const payload = { guardianName: guardianName.trim(), purpose: purpose.trim() }
    if (waiverId) {
      await updateWaiver(waiverId, { ...payload, documentId: documentId ?? undefined })
      return
    }
    const id = await insertWaiver({
      studentId: student!.id,
      ...payload,
      documentId,
      createdBy: profile!.id,
    })
    setWaiverId(id)
  }

  async function run(action: 'print' | 'download' | 'attach') {
    if (!blob || !previewFresh) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (action === 'attach') {
        const documentId = await uploadStudentFile({
          studentId: student!.id,
          file: blob,
          extension: 'pdf',
          folder: 'waivers',
          docType: 'waiver',
          title: `Waiver - ${student!.full_name}`,
          description: purpose.trim(),
          caseHistoryId: null,
          createdBy: profile!.id,
        })
        await rememberWaiver(documentId)
        setAttached(true)
        setNotice('Attached to this student\'s record.')
      } else {
        await rememberWaiver(null)
        if (action === 'print') {
          printPdf(blob)
          setNotice('The print dialog should open. Attach the waiver if you also want it stored on the record.')
        } else {
          downloadPdf(blob, downloadName('waiver', student!.full_name))
          setNotice('Downloaded. Attach the waiver if you also want it stored on the record.')
        }
      }
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page narrow">
      <p className="back"><Link to={`/students/${student.id}`}>Back to {student.full_name}</Link></p>
      <PageHeader
        title="Waiver"
        lede="A short consent form with this student's information. Create the PDF, then print it or attach it to the record."
      />
      <form className="panel" onSubmit={(event) => void createPreview(event)}>
        <Field label="Parent or guardian">
          <input value={guardianName} onChange={(event) => setGuardianName(event.target.value)} required />
        </Field>
        <dl className="info-grid">
          <dt>Student</dt>
          <dd>{student.full_name}</dd>
          <dt>Grade and section</dt>
          <dd>{student.grade_level} - {student.section}</dd>
          <dt>Age</dt>
          <dd>{recorded(student.age)}</dd>
        </dl>
        <Field label="Purpose">
          <textarea
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            rows={4}
            placeholder="Counseling sessions about attendance and classroom conduct"
            required
          />
        </Field>
        {error && !previewUrl ? <Banner tone="error">{error}</Banner> : null}
        <button type="submit" className="btn btn-primary">Create PDF</button>
        {blob && !previewFresh ? (
          <p className="muted">The form changed. Create the PDF again before printing or attaching.</p>
        ) : null}
      </form>
      <PdfResult
        file={previewFresh ? blob : null}
        busy={busy}
        attached={attached}
        error={previewUrl ? error : null}
        notice={notice}
        onPrint={() => void run('print')}
        onDownload={() => void run('download')}
        onAttach={() => void run('attach')}
      />
    </div>
  )
}
