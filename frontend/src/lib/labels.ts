import type {
  CaseCategory,
  DocumentType,
  GuidanceStatus,
  PlanStatus,
  SessionType,
  StaffRole,
  StudentSex,
} from './types.ts'

export const STATUS_OPTIONS: { value: GuidanceStatus; label: string; hint: string }[] = [
  {
    value: 'routine',
    label: 'Routine / Cleared',
    hint: 'Doing well. Scheduled check-ins only.',
  },
  {
    value: 'monitoring',
    label: 'Under Monitoring',
    hint: 'A smaller ongoing issue. Regular follow-ups.',
  },
  {
    value: 'critical',
    label: 'Critical / Intervention',
    hint: 'Needs active counseling or crisis handling now.',
  },
  {
    value: 'referred',
    label: 'Referred',
    hint: 'Sent to an outside specialist or a higher school authority.',
  },
  {
    value: 'closed',
    label: 'Case Closed',
    hint: 'This issue is resolved. No immediate action.',
  },
]

export const STATUS_RANK: Record<GuidanceStatus, number> = {
  critical: 0,
  monitoring: 1,
  referred: 2,
  routine: 3,
  closed: 4,
}

const STATUS_LABELS = Object.fromEntries(
  STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<GuidanceStatus, string>

export const SEX_OPTIONS: { value: StudentSex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

export function sexLabel(sex: StudentSex | null): string {
  return SEX_OPTIONS.find((option) => option.value === sex)?.label ?? 'Not recorded'
}

export function statusLabel(status: GuidanceStatus): string {
  return STATUS_LABELS[status]
}

export function statusHint(status: GuidanceStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.hint ?? ''
}

export const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'routine', label: 'Routine' },
  { value: 'crisis', label: 'Crisis' },
  { value: 'academic', label: 'Academic' },
]

export const CASE_CATEGORIES: { value: CaseCategory; label: string }[] = [
  { value: 'case', label: 'Case' },
  { value: 'sanction', label: 'Sanction' },
]

export const PLAN_STATUSES: { value: PlanStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'met', label: 'Met' },
  { value: 'dropped', label: 'Dropped' },
]

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'call_slip', label: 'Call slip' },
  { value: 'waiver', label: 'Waiver' },
  { value: 'case_file', label: 'Case file' },
  { value: 'other', label: 'Other' },
]

export function optionLabel<T extends string>(
  options: { value: T; label: string }[],
  value: T,
): string {
  return options.find((option) => option.value === value)?.label ?? value
}

export function roleLabel(role: StaffRole): string {
  return role === 'admin' ? 'Administrator' : 'Counselor'
}
