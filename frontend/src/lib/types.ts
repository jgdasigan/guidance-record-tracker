export type StaffRole = 'admin' | 'counselor'

export type GuidanceStatus = 'routine' | 'monitoring' | 'critical' | 'referred' | 'closed'

export type SessionType = 'routine' | 'crisis' | 'academic'

export type CaseCategory = 'case' | 'sanction'

export type PlanStatus = 'active' | 'met' | 'dropped'

export type DocumentType = 'call_slip' | 'waiver' | 'case_file' | 'other'

export type StudentSex = 'male' | 'female'

export interface Profile {
  id: string
  full_name: string
  role: StaffRole
}

export interface SchoolSettings {
  school_name: string
  office_name: string
}

export interface Student {
  id: string
  full_name: string
  grade_level: string
  section: string
  sex: StudentSex | null
  age: number | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
  status: GuidanceStatus
  created_at: string
  updated_at: string
}

export interface StudentInput {
  full_name: string
  grade_level: string
  section: string
  sex: StudentSex
  age: number | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
}

export interface CaseNote {
  id: string
  title: string
  category: CaseCategory
  narrative: string | null
  perpetrator: string | null
  victim: string | null
  additional_notes: string | null
  students_conference: string | null
  parental_conference: string | null
  occurred_on: string | null
  created_at: string
}

export interface ActionPlan {
  id: string
  goal: string
  status: PlanStatus
  target_date: string | null
  created_at: string
}

export interface SessionLog {
  id: string
  session_date: string
  session_type: SessionType
  notes: string
  created_at: string
  counselor_name: string | null
}

export interface StatusEvent {
  id: string
  from_status: GuidanceStatus | null
  to_status: GuidanceStatus
  description: string | null
  created_at: string
  actor_name: string | null
}

export interface GuidanceDocument {
  id: string
  case_history_id: string | null
  doc_type: DocumentType
  title: string
  description: string | null
  storage_path: string
  created_at: string
}

export interface LinkedFile {
  storage_path: string
  title: string
}

export interface CallSlip {
  id: string
  scheduled_at: string
  guardian_name: string
  reason: string
  document_id: string | null
  created_at: string
  document: LinkedFile | null
}

export interface WaiverRecord {
  id: string
  guardian_name: string
  purpose: string
  document_id: string | null
  created_at: string
  document: LinkedFile | null
}

export interface AlertRow {
  id: string
  student_id: string
  message: string
  created_at: string
  acknowledged_at: string | null
  student_name: string
  grade_level: string
  section: string
}

export interface StudentDetail {
  cases: CaseNote[]
  plans: ActionPlan[]
  sessions: SessionLog[]
  documents: GuidanceDocument[]
  events: StatusEvent[]
  callSlips: CallSlip[]
  waivers: WaiverRecord[]
}
