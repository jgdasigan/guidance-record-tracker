import type { StudentSex } from './types.ts'

export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function formatSchedule(value: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

// Date columns come back as YYYY-MM-DD. Parsing that with Date treats it as
// UTC midnight and can show the previous day in timezones behind UTC.
export function formatDateOnly(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(year, month - 1, day),
  )
}

const EDIT_WINDOW_MS = 60 * 60 * 1000

export function withinEditWindow(createdAt: string, now = Date.now()): boolean {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return now - created < EDIT_WINDOW_MS
}

export function dateTimeLocalValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function todayInputValue(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function downloadName(kind: string, studentName: string): string {
  const slug = studentName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const day = todayInputValue()
  return `${kind}-${slug || 'student'}-${day}.pdf`
}

export function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong. Try again.'
}

export function requiredSex(value: string): StudentSex {
  if (value !== 'male' && value !== 'female') throw new Error('Sex is required.')
  return value
}

export function requiredText(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} is required.`)
  return trimmed
}

export function parseAge(value: string): number {
  const age = Number(value)
  if (!Number.isInteger(age) || age < 3 || age > 25) {
    throw new Error('Age needs to be a whole number from 3 to 25.')
  }
  return age
}

export function parseOptionalAge(value: string): number | null {
  if (!value.trim()) return null
  return parseAge(value)
}

export function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

// Letters plus the punctuation real names use: spaces (Dela Cruz), hyphens
// (Ann-Marie), apostrophes (O'Brien), and periods (a middle initial like "D.").
// The trailing \.? also covers a bare initial ("D.") with nothing after the dot.
// The hyphen must stay escaped (\-, not a trailing bare "-") - some browsers'
// native <input pattern> constraint validation silently no-ops (accepts any
// value) on an unescaped trailing hyphen inside a repeated character class,
// even though the same source works as a plain JS RegExp.
export const NAME_PATTERN_SOURCE = "^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ .'\\-][A-Za-zÀ-ÖØ-öø-ÿ]+)*\\.?$"
const NAME_PATTERN = new RegExp(NAME_PATTERN_SOURCE)

export function sanitizeLetters(value: string): string {
  return value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ .'-]/g, '')
}

export function requiredLetters(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} is required.`)
  if (!NAME_PATTERN.test(trimmed)) throw new Error(`${label} can only contain letters.`)
  return trimmed
}

export function optionalLetters(value: string, label: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!NAME_PATTERN.test(trimmed)) throw new Error(`${label} can only contain letters.`)
  return trimmed
}

export function composeFullName(firstName: string, middleName: string, lastName: string): string {
  return [firstName, middleName, lastName].map((part) => part.trim()).filter(Boolean).join(' ')
}

// Student names are stored as one string, so editing an existing record has to
// guess the last/first/middle split back out. Heuristic: the last word is the
// last name, and a trailing single letter (with or without a period) before it
// is a middle initial. This mis-splits multi-word last names (e.g. "Dela Cruz"
// lands partly in the first-name field) since that structure isn't recoverable
// from a flat string - counselors can fix it up in the form when it happens.
export function splitFullName(fullName: string): { firstName: string; middleName: string; lastName: string } {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { firstName: '', middleName: '', lastName: '' }
  const lastName = tokens.pop() ?? ''
  let middleName = ''
  if (tokens.length > 0 && /^[A-Za-zÀ-ÖØ-öø-ÿ]\.?$/.test(tokens[tokens.length - 1])) {
    middleName = tokens.pop() ?? ''
  }
  return { firstName: tokens.join(' '), middleName, lastName }
}

export function recorded(value: string | number | null | undefined): string {
  if (value == null || String(value).trim() === '') return 'Not recorded'
  return String(value)
}
