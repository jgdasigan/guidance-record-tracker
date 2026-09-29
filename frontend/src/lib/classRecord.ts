import { read, type CellObject, type WorkBook, type WorkSheet } from 'xlsx'
import type { StudentSex } from './types.ts'

// DepEd's Electronic Class Record keeps the class roster on one sheet.
// Grade and section sit in fixed cells, and each sex has a fixed name column.
// Rows left blank are unused slots in that template, so they are not students.
const INPUT_SHEET = 'input data'
const NAME_FIRST_ROW = 11
const NAME_LAST_ROW = 60
const MALE_NAME_COLUMN = 'K'
const FEMALE_NAME_COLUMN = 'N'
const GRADE_CELL = 'E25'
const SECTION_CELL = 'E26'
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xlsm', '.xls', '.csv']

export interface ClassLearner {
  name: string
  sex: StudentSex
}

export interface ClassRoster {
  gradeLevel: string
  section: string
  learners: ClassLearner[]
}

export interface RosterImportPlan {
  gradeLevel: string
  section: string
  toAdd: ClassLearner[]
  alreadyRecorded: number
  repeatedInFile: number
}

export function isClassRecordFile(fileName: string): boolean {
  return ACCEPTED_EXTENSIONS.includes(fileExtension(fileName))
}

export function parseClassRecord(data: ArrayBuffer, fileName: string): ClassRoster {
  const extension = fileExtension(fileName)
  if (!isClassRecordFile(fileName)) {
    throw new Error('Only CSV or Excel files are accepted (.csv, .xlsx, .xls, or .xlsm).')
  }

  let workbook: WorkBook
  try {
    workbook = read(data, { type: 'array' })
  } catch {
    throw new Error('This file could not be read. Use the Electronic Class Record workbook.')
  }

  const sheet = inputSheet(workbook, extension)
  const gradeLevel = cellText(sheet, GRADE_CELL)
  const section = cellText(sheet, SECTION_CELL)
  if (!gradeLevel) throw new Error('Grade level is empty (cell E25 on INPUT DATA).')
  if (!section) throw new Error('Section is empty (cell E26 on INPUT DATA).')

  const learners = [
    ...columnLearners(sheet, MALE_NAME_COLUMN, 'male'),
    ...columnLearners(sheet, FEMALE_NAME_COLUMN, 'female'),
  ]
  if (learners.length === 0) {
    throw new Error('No learner names were found in K11:K60 or N11:N60. Empty cells are skipped.')
  }

  return { gradeLevel, section, learners }
}

export function planRosterImport(
  roster: ClassRoster,
  existing: Array<{ full_name: string; grade_level: string; section: string }>,
): RosterImportPlan {
  const seen = new Set<string>()
  const existingKeys = new Set(
    existing.map((student) => rosterKey(student.full_name, student.grade_level, student.section)),
  )
  const toAdd: ClassLearner[] = []
  let alreadyRecorded = 0
  let repeatedInFile = 0

  for (const learner of roster.learners) {
    const key = rosterKey(learner.name, roster.gradeLevel, roster.section)
    if (seen.has(key)) {
      repeatedInFile += 1
      continue
    }
    seen.add(key)
    if (existingKeys.has(key)) {
      alreadyRecorded += 1
      continue
    }
    toAdd.push(learner)
  }

  return {
    gradeLevel: roster.gradeLevel,
    section: roster.section,
    toAdd,
    alreadyRecorded,
    repeatedInFile,
  }
}

function inputSheet(workbook: WorkBook, extension: string): WorkSheet {
  const named = workbook.SheetNames.find((name) => name.trim().toLowerCase() === INPUT_SHEET)
  if (named) return workbook.Sheets[named]
  // A CSV export has no sheet tabs. Treat the only sheet as INPUT DATA.
  if (extension === '.csv' && workbook.SheetNames[0]) {
    return workbook.Sheets[workbook.SheetNames[0]]
  }
  const found = workbook.SheetNames.length > 0 ? workbook.SheetNames.join(', ') : 'none'
  throw new Error(`This file has no INPUT DATA sheet. Sheets found: ${found}.`)
}

function columnLearners(sheet: WorkSheet, column: string, sex: StudentSex): ClassLearner[] {
  const learners: ClassLearner[] = []
  for (let row = NAME_FIRST_ROW; row <= NAME_LAST_ROW; row += 1) {
    const name = cellText(sheet, `${column}${row}`)
    if (!name) continue
    learners.push({ name, sex })
  }
  return learners
}

function cellText(sheet: WorkSheet, address: string): string {
  const cell = sheet[address] as CellObject | undefined
  if (!cell || cell.v == null || cell.v === '') return ''
  return String(cell.v).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function rosterKey(name: string, grade: string, section: string): string {
  return [name, grade, section].map(normalizeLabel).join('\n')
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase()
}
