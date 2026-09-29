import type { CaseCategory, GuidanceStatus, Student, StudentSex } from './types.ts'

export type CaseFilter = 'all' | 'case' | 'sanction' | 'none'
export type SexFilter = 'all' | StudentSex

export interface CaseIndex {
  cases: Set<string>
  sanctions: Set<string>
}

export interface Share {
  key: string
  label: string
  count: number
  percent: number
}

// Philippine school year runs June through May, so a record added in
// September 2026 belongs to 2026-2027.
export function schoolYearOf(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  const start = date.getMonth() >= 5 ? date.getFullYear() : date.getFullYear() - 1
  return `${start}-${start + 1}`
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function indexCases(marks: Array<{ student_id: string; category: CaseCategory }>): CaseIndex {
  const cases = new Set<string>()
  const sanctions = new Set<string>()
  for (const mark of marks) {
    if (mark.category === 'case') cases.add(mark.student_id)
    if (mark.category === 'sanction') sanctions.add(mark.student_id)
  }
  return { cases, sanctions }
}

export function matchesCase(studentId: string, filter: CaseFilter, index: CaseIndex): boolean {
  if (filter === 'all') return true
  if (filter === 'case') return index.cases.has(studentId)
  if (filter === 'sanction') return index.sanctions.has(studentId)
  return !index.cases.has(studentId) && !index.sanctions.has(studentId)
}

export function filterStudents(
  students: Student[],
  index: CaseIndex,
  filters: {
    year: string
    grade: string
    sex: SexFilter
    section: string
    caseHistory: CaseFilter
  },
): Student[] {
  return students.filter((student) => {
    if (filters.year !== 'all' && schoolYearOf(student.created_at) !== filters.year) return false
    if (filters.grade !== 'all' && student.grade_level !== filters.grade) return false
    if (filters.sex !== 'all' && student.sex !== filters.sex) return false
    if (filters.section !== 'all' && student.section !== filters.section) return false
    return matchesCase(student.id, filters.caseHistory, index)
  })
}

export function shareFromCounts(counts: Array<{ key: string; label: string; count: number }>): Share[] {
  const total = counts.reduce((sum, item) => sum + item.count, 0)
  return counts.map((item) => ({
    key: item.key,
    label: item.label,
    count: item.count,
    percent: total === 0 ? 0 : (item.count / total) * 100,
  }))
}

export function gradeSort(a: string, b: string): number {
  const left = Number(a)
  const right = Number(b)
  if (Number.isFinite(left) && Number.isFinite(right) && String(left) === a && String(right) === b) {
    return left - right
  }
  return a.localeCompare(b, undefined, { numeric: true })
}

export function statusShares(
  students: Student[],
  statuses: Array<{ value: GuidanceStatus; label: string }>,
): Share[] {
  return shareFromCounts(statuses.map((status) => ({
    key: status.value,
    label: status.label,
    count: students.filter((student) => student.status === status.value).length,
  })))
}

export function gradeShares(students: Student[]): Share[] {
  const grades = [...new Set(students.map((student) => student.grade_level))].sort(gradeSort)
  return shareFromCounts(grades.map((grade) => ({
    key: grade,
    label: `Grade ${grade}`,
    count: students.filter((student) => student.grade_level === grade).length,
  })))
}

export function sectionShares(students: Student[]): Share[] {
  const sections = [...new Set(students.map((student) => student.section))].sort((a, b) => a.localeCompare(b))
  return shareFromCounts(sections.map((section) => ({
    key: section,
    label: section,
    count: students.filter((student) => student.section === section).length,
  })))
}
