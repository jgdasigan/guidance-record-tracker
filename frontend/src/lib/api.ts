import { assertUploadSize } from './files.ts'
import { requireSupabase } from './supabase.ts'
import type {
  AlertRow,
  CallSlip,
  CaseCategory,
  CaseNote,
  DocumentType,
  GuidanceDocument,
  GuidanceStatus,
  LinkedFile,
  PlanStatus,
  Profile,
  SchoolSettings,
  SessionLog,
  SessionType,
  StaffRole,
  StatusEvent,
  Student,
  StudentDetail,
  StudentInput,
  WaiverRecord,
} from './types.ts'

interface NameRow {
  full_name?: string
}

function relatedName(value: NameRow | NameRow[] | null | undefined): string | null {
  if (value == null) return null
  const row = Array.isArray(value) ? value[0] : value
  return row?.full_name ?? null
}

function relatedFile(value: LinkedFile | LinkedFile[] | null | undefined): LinkedFile | null {
  if (value == null) return null
  const row = Array.isArray(value) ? value[0] : value
  if (!row?.storage_path) return null
  return { storage_path: row.storage_path, title: row.title }
}

function asProfile(row: { id: string; full_name: string; role: string } | null): Profile | null {
  if (!row) return null
  if (row.role !== 'admin' && row.role !== 'counselor') return null
  return { id: row.id, full_name: row.full_name, role: row.role as StaffRole }
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return asProfile(data)
}

export async function fetchSchool(): Promise<SchoolSettings | null> {
  const { data, error } = await requireSupabase()
    .from('school_settings')
    .select('school_name, office_name')
    .eq('id', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function saveSchool(settings: SchoolSettings): Promise<void> {
  const { error } = await requireSupabase()
    .from('school_settings')
    .update({
      school_name: settings.school_name,
      office_name: settings.office_name,
    })
    .eq('id', true)
  if (error) throw new Error(error.message)
}

export async function fetchStudents(): Promise<Student[]> {
  const { data, error } = await requireSupabase()
    .from('students')
    .select(
      'id, full_name, grade_level, section, sex, age, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, status, created_at, updated_at',
    )
    .order('full_name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Student[]
}

export async function fetchCaseMarks(): Promise<Array<{ student_id: string; category: CaseCategory }>> {
  const { data, error } = await requireSupabase()
    .from('case_history')
    .select('student_id, category')
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{ student_id: string; category: CaseCategory }>
}

export async function fetchAlerts(): Promise<AlertRow[]> {
  const { data, error } = await requireSupabase()
    .from('alerts')
    .select(
      'id, student_id, message, created_at, acknowledged_at, student:students(full_name, grade_level, section)',
    )
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<{
    id: string
    student_id: string
    message: string
    created_at: string
    acknowledged_at: string | null
    student: { full_name: string; grade_level: string; section: string } | { full_name: string; grade_level: string; section: string }[] | null
  }>).map((row) => {
    const student = Array.isArray(row.student) ? row.student[0] : row.student
    return {
      id: row.id,
      student_id: row.student_id,
      message: row.message,
      created_at: row.created_at,
      acknowledged_at: row.acknowledged_at,
      student_name: student?.full_name ?? 'Unknown student',
      grade_level: student?.grade_level ?? '',
      section: student?.section ?? '',
    }
  })
}

export async function acknowledgeAlert(alertId: string, userId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('alerts')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
    })
    .eq('id', alertId)
  if (error) throw new Error(error.message)
}

export async function createStudent(input: StudentInput, createdBy: string): Promise<string> {
  const { data, error } = await requireSupabase()
    .from('students')
    .insert({ ...input, created_by: createdBy })
    .select('id')
    .single()
  if (error) throw new Error(explainStudentWriteError(error.message))
  return (data as { id: string }).id
}

export async function createStudents(inputs: StudentInput[], createdBy: string): Promise<void> {
  if (inputs.length === 0) return
  const { error } = await requireSupabase()
    .from('students')
    .insert(inputs.map((input) => ({ ...input, created_by: createdBy })))
  if (error) throw new Error(explainStudentWriteError(error.message))
}

export async function deleteStudent(studentId: string): Promise<void> {
  const db = requireSupabase()
  const files = await db.from('documents').select('storage_path').eq('student_id', studentId)
  if (files.error) throw new Error(files.error.message)
  const paths = ((files.data ?? []) as Array<{ storage_path: string }>)
    .map((row) => row.storage_path)
    .filter((path) => path)
  if (paths.length > 0) {
    const removed = await db.storage.from('guidance-documents').remove(paths)
    if (removed.error) throw new Error(removed.error.message)
  }
  const deleted = await db.from('students').delete().eq('id', studentId).select('id')
  if (deleted.error) throw new Error(deleted.error.message)
  if (!deleted.data || deleted.data.length === 0) {
    throw new Error('Only an administrator can delete a student.')
  }
}

export async function updateStudent(studentId: string, input: StudentInput): Promise<void> {
  const { error } = await requireSupabase().from('students').update(input).eq('id', studentId)
  if (error) throw new Error(explainStudentWriteError(error.message))
}

function explainStudentWriteError(message: string): string {
  if (/null value in column "(age|emergency_contact_name|emergency_contact_phone)"/i.test(message)) {
    return 'Age and emergency contact are still required in the database. Run supabase/optional-roster-fields.sql once in the Supabase SQL editor, then try again.'
  }
  if (/sex/i.test(message) && /schema cache|does not exist|column/i.test(message)) {
    return 'Sex is not on the students table yet. Run supabase/optional-roster-fields.sql once in the Supabase SQL editor, then try again.'
  }
  return message
}

export async function updateStudentStatus(
  studentId: string,
  status: GuidanceStatus,
  description: string,
): Promise<void> {
  const { error } = await requireSupabase()
    .from('students')
    .update({ status, status_note: description })
    .eq('id', studentId)
  if (error) throw new Error(explainStatusWriteError(error.message))
}

function explainStatusWriteError(message: string): string {
  if (/status_note|description/i.test(message) && /schema cache|does not exist|column/i.test(message)) {
    return 'Status notes are not in the database yet. Run supabase/status-note.sql once in the Supabase SQL editor, then try again.'
  }
  return message
}

export async function fetchStudentDetail(studentId: string): Promise<StudentDetail> {
  const db = requireSupabase()
  const [cases, plans, sessions, documents, events, callSlips, waivers] = await Promise.all([
    db
      .from('case_history')
      .select('id, title, category, description, narrative, perpetrator, victim, additional_notes, students_conference, parental_conference, occurred_on, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false }),
    db
      .from('action_plans')
      .select('id, goal, status, target_date, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false }),
    db
      .from('session_logs')
      .select('id, session_date, session_type, notes, created_at, counselor:profiles(full_name)')
      .eq('student_id', studentId)
      .order('session_date', { ascending: false }),
    db
      .from('documents')
      .select('id, case_history_id, doc_type, title, description, storage_path, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false }),
    db
      .from('status_events')
      .select('id, from_status, to_status, description, created_at, actor:profiles(full_name)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false }),
    db
      .from('call_slips')
      .select('id, scheduled_at, guardian_name, reason, document_id, created_at, document:documents(storage_path, title)')
      .eq('student_id', studentId)
      .order('scheduled_at', { ascending: false }),
    db
      .from('waivers')
      .select('id, guardian_name, purpose, document_id, created_at, document:documents(storage_path, title)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false }),
  ])

  for (const result of [cases, plans, sessions, documents, events, callSlips, waivers]) {
    if (result.error) throw new Error(explainCaseWriteError(result.error.message))
  }

  return {
    cases: ((cases.data ?? []) as Array<CaseNote & { description: string | null }>).map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      narrative: row.narrative ?? (row.category === 'sanction' ? null : row.description),
      perpetrator: row.perpetrator,
      victim: row.victim,
      additional_notes: row.additional_notes,
      students_conference: row.students_conference,
      parental_conference: row.parental_conference,
      occurred_on: row.occurred_on,
      created_at: row.created_at,
    })),
    plans: (plans.data ?? []) as StudentDetail['plans'],
    sessions: ((sessions.data ?? []) as Array<{
      id: string
      session_date: string
      session_type: SessionType
      notes: string
      created_at: string
      counselor: NameRow | NameRow[] | null
    }>).map((row) => ({
      id: row.id,
      session_date: row.session_date,
      session_type: row.session_type,
      notes: row.notes,
      created_at: row.created_at,
      counselor_name: relatedName(row.counselor),
    })) satisfies SessionLog[],
    documents: (documents.data ?? []) as GuidanceDocument[],
    events: ((events.data ?? []) as Array<{
      id: string
      from_status: GuidanceStatus | null
      to_status: GuidanceStatus
      description: string | null
      created_at: string
      actor: NameRow | NameRow[] | null
    }>).map((row) => ({
      id: row.id,
      from_status: row.from_status,
      to_status: row.to_status,
      description: row.description,
      created_at: row.created_at,
      actor_name: relatedName(row.actor),
    })) satisfies StatusEvent[],
    callSlips: ((callSlips.data ?? []) as Array<{
      id: string
      scheduled_at: string
      guardian_name: string
      reason: string
      document_id: string | null
      created_at: string
      document: LinkedFile | LinkedFile[] | null
    }>).map((row) => ({
      id: row.id,
      scheduled_at: row.scheduled_at,
      guardian_name: row.guardian_name,
      reason: row.reason,
      document_id: row.document_id,
      created_at: row.created_at,
      document: relatedFile(row.document),
    })) satisfies CallSlip[],
    waivers: ((waivers.data ?? []) as Array<{
      id: string
      guardian_name: string
      purpose: string
      document_id: string | null
      created_at: string
      document: LinkedFile | LinkedFile[] | null
    }>).map((row) => ({
      id: row.id,
      guardian_name: row.guardian_name,
      purpose: row.purpose,
      document_id: row.document_id,
      created_at: row.created_at,
      document: relatedFile(row.document),
    })) satisfies WaiverRecord[],
  }
}

export async function createCase(input: {
  studentId: string
  title: string
  category: CaseCategory
  narrative: string | null
  perpetrator: string | null
  victim: string | null
  additionalNotes: string | null
  studentsConference: string | null
  parentalConference: string | null
  occurredOn: string | null
  recordedBy: string
}): Promise<string> {
  const { data, error } = await requireSupabase()
    .from('case_history')
    .insert({
      student_id: input.studentId,
      recorded_by: input.recordedBy,
      ...caseRow(input),
    })
    .select('id')
    .single()
  if (error) throw new Error(explainCaseWriteError(error.message))
  return (data as { id: string }).id
}

function caseSummary(input: {
  category: CaseCategory
  narrative: string | null
  perpetrator: string | null
  victim: string | null
  additionalNotes: string | null
  studentsConference: string | null
  parentalConference: string | null
}): string {
  const lines = input.category === 'case'
    ? [
      input.narrative,
      input.perpetrator ? `Perpetrator: ${input.perpetrator}` : null,
      input.victim ? `Victim: ${input.victim}` : null,
      input.additionalNotes ? `Additional notes: ${input.additionalNotes}` : null,
    ]
    : [
      input.studentsConference ? `Students conference: ${input.studentsConference}` : null,
      input.parentalConference ? `Parental conference: ${input.parentalConference}` : null,
    ]
  return lines.filter((line) => line).join('\n\n')
}

function explainCaseWriteError(message: string): string {
  const windowMessage = explainEditWindow(message)
  if (windowMessage !== message) return windowMessage
  if (/narrative|perpetrator|additional_notes|students_conference|parental_conference|case_history_category_check/i.test(message)) {
    return 'Case categories are not updated in the database yet. Run supabase/case-categories.sql once in the Supabase SQL editor, then try again.'
  }
  return message
}

function explainEditWindow(message: string): string {
  if (/within an hour/i.test(message)) {
    return 'This can only be changed within an hour of when it was saved.'
  }
  return message
}

function caseRow(input: {
  title: string
  category: CaseCategory
  narrative: string | null
  perpetrator: string | null
  victim: string | null
  additionalNotes: string | null
  studentsConference: string | null
  parentalConference: string | null
  occurredOn: string | null
}) {
  return {
    title: input.title,
    category: input.category,
    description: caseSummary(input),
    narrative: input.category === 'case' ? input.narrative : null,
    perpetrator: input.category === 'case' ? input.perpetrator : null,
    victim: input.category === 'case' ? input.victim : null,
    additional_notes: input.category === 'case' ? input.additionalNotes : null,
    students_conference: input.category === 'sanction' ? input.studentsConference : null,
    parental_conference: input.category === 'sanction' ? input.parentalConference : null,
    occurred_on: input.occurredOn,
  }
}

export async function createPlan(input: {
  studentId: string
  goal: string
  targetDate: string | null
  createdBy: string
}): Promise<void> {
  const { error } = await requireSupabase().from('action_plans').insert({
    student_id: input.studentId,
    goal: input.goal,
    target_date: input.targetDate,
    created_by: input.createdBy,
  })
  if (error) throw new Error(error.message)
}

export async function updateCase(
  caseId: string,
  input: {
    title: string
    category: CaseCategory
    narrative: string | null
    perpetrator: string | null
    victim: string | null
    additionalNotes: string | null
    studentsConference: string | null
    parentalConference: string | null
    occurredOn: string | null
  },
): Promise<void> {
  const { error } = await requireSupabase().from('case_history').update(caseRow(input)).eq('id', caseId)
  if (error) throw new Error(explainCaseWriteError(error.message))
}

export async function deleteCase(caseId: string): Promise<void> {
  const { error } = await requireSupabase().from('case_history').delete().eq('id', caseId)
  if (error) throw new Error(explainCaseWriteError(error.message))
}

export async function updatePlan(
  planId: string,
  input: { goal: string; status: PlanStatus; targetDate: string | null },
): Promise<void> {
  const { error } = await requireSupabase().from('action_plans').update({
    goal: input.goal,
    status: input.status,
    target_date: input.targetDate,
  }).eq('id', planId)
  if (error) throw new Error(explainEditWindow(error.message))
}

export async function updatePlanStatus(planId: string, status: PlanStatus): Promise<void> {
  const { error } = await requireSupabase().from('action_plans').update({ status }).eq('id', planId)
  if (error) throw new Error(explainEditWindow(error.message))
}

export async function deletePlan(planId: string): Promise<void> {
  const { error } = await requireSupabase().from('action_plans').delete().eq('id', planId)
  if (error) throw new Error(explainEditWindow(error.message))
}

export async function updateSession(
  sessionId: string,
  input: { sessionDate: string; sessionType: SessionType; notes: string },
): Promise<void> {
  const { error } = await requireSupabase().from('session_logs').update({
    session_date: input.sessionDate,
    session_type: input.sessionType,
    notes: input.notes,
  }).eq('id', sessionId)
  if (error) throw new Error(explainEditWindow(error.message))
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await requireSupabase().from('session_logs').delete().eq('id', sessionId)
  if (error) throw new Error(explainEditWindow(error.message))
}

export async function updateDocument(
  documentId: string,
  input: { title: string; docType: DocumentType; description: string | null },
): Promise<void> {
  const { error } = await requireSupabase().from('documents').update({
    title: input.title,
    doc_type: input.docType,
    description: input.description,
  }).eq('id', documentId)
  if (error) throw new Error(explainEditWindow(error.message))
}

export async function createSession(input: {
  studentId: string
  sessionDate: string
  sessionType: SessionType
  notes: string
  counselorId: string
}): Promise<void> {
  const { error } = await requireSupabase().from('session_logs').insert({
    student_id: input.studentId,
    session_date: input.sessionDate,
    session_type: input.sessionType,
    notes: input.notes,
    counselor_id: input.counselorId,
  })
  if (error) throw new Error(error.message)
}

export async function uploadStudentFile(input: {
  studentId: string
  file: Blob
  extension: string
  folder: string
  docType: DocumentType
  title: string
  description: string | null
  caseHistoryId: string | null
  createdBy: string
}): Promise<string> {
  if (input.file instanceof File) assertUploadSize(input.file)
  const path = `${input.studentId}/${input.folder}/${crypto.randomUUID()}.${input.extension}`
  const db = requireSupabase()
  const uploaded = await db.storage.from('guidance-documents').upload(path, input.file, {
    contentType: input.file.type || 'application/pdf',
    upsert: false,
  })
  if (uploaded.error) throw new Error(uploaded.error.message)

  const inserted = await db
    .from('documents')
    .insert({
      student_id: input.studentId,
      case_history_id: input.caseHistoryId,
      doc_type: input.docType,
      title: input.title,
      description: input.description,
      storage_path: path,
      created_by: input.createdBy,
    })
    .select('id')
    .single()
  if (inserted.error) {
    await db.storage.from('guidance-documents').remove([path])
    throw new Error(inserted.error.message)
  }
  return (inserted.data as { id: string }).id
}

export async function signedDocumentUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths)]
  if (unique.length === 0) return {}
  const { data, error } = await requireSupabase()
    .storage
    .from('guidance-documents')
    .createSignedUrls(unique, 60 * 60)
  if (error) throw new Error(error.message)
  const urls: Record<string, string> = {}
  for (const [index, item] of (data ?? []).entries()) {
    if (!item.signedUrl) continue
    const key = item.path && unique.includes(item.path) ? item.path : unique[index]
    if (key) urls[key] = item.signedUrl
  }
  return urls
}

export async function deleteStudentFile(documentId: string, storagePath: string): Promise<void> {
  const db = requireSupabase()
  const deleted = await db.from('documents').delete().eq('id', documentId)
  if (deleted.error) throw new Error(explainEditWindow(deleted.error.message))
  const removed = await db.storage.from('guidance-documents').remove([storagePath])
  if (removed.error) throw new Error(removed.error.message)
}

export async function deleteCallSlip(slipId: string): Promise<void> {
  const { error } = await requireSupabase().from('call_slips').delete().eq('id', slipId)
  if (error) throw new Error(explainEditWindow(error.message))
}

export async function deleteWaiver(waiverId: string): Promise<void> {
  const { error } = await requireSupabase().from('waivers').delete().eq('id', waiverId)
  if (error) throw new Error(explainEditWindow(error.message))
}

export async function insertCallSlip(input: {
  studentId: string
  scheduledAt: string
  guardianName: string
  reason: string
  documentId: string | null
  createdBy: string
}): Promise<string> {
  const { data, error } = await requireSupabase()
    .from('call_slips')
    .insert({
      student_id: input.studentId,
      scheduled_at: input.scheduledAt,
      guardian_name: input.guardianName,
      reason: input.reason,
      document_id: input.documentId,
      created_by: input.createdBy,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

export async function updateCallSlip(
  slipId: string,
  input: {
    scheduledAt: string
    guardianName: string
    reason: string
    documentId?: string
  },
): Promise<void> {
  const patch: {
    scheduled_at: string
    guardian_name: string
    reason: string
    document_id?: string
  } = {
    scheduled_at: input.scheduledAt,
    guardian_name: input.guardianName,
    reason: input.reason,
  }
  if (input.documentId) patch.document_id = input.documentId
  const { error } = await requireSupabase().from('call_slips').update(patch).eq('id', slipId)
  if (error) throw new Error(explainEditWindow(error.message))
}

export async function insertWaiver(input: {
  studentId: string
  guardianName: string
  purpose: string
  documentId: string | null
  createdBy: string
}): Promise<string> {
  const { data, error } = await requireSupabase()
    .from('waivers')
    .insert({
      student_id: input.studentId,
      guardian_name: input.guardianName,
      purpose: input.purpose,
      document_id: input.documentId,
      created_by: input.createdBy,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

export async function updateWaiver(
  waiverId: string,
  input: { guardianName: string; purpose: string; documentId?: string },
): Promise<void> {
  const patch: { guardian_name: string; purpose: string; document_id?: string } = {
    guardian_name: input.guardianName,
    purpose: input.purpose,
  }
  if (input.documentId) patch.document_id = input.documentId
  const { error } = await requireSupabase().from('waivers').update(patch).eq('id', waiverId)
  if (error) throw new Error(explainEditWindow(error.message))
}
