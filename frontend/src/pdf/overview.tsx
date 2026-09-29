import { pdf, Text, View } from '@react-pdf/renderer'
import { formatTimestamp } from '../lib/format.ts'
import { formatPercent, type Share } from '../lib/overview.ts'
import { PaperPage } from './paper.tsx'

export interface OverviewReport {
  schoolName: string
  officeName: string
  preparedBy: string
  issuedAt: Date
  year: string
  grade: string
  sex: string
  section: string
  caseHistory: string
  studentCount: number
  withCase: number
  withSanction: number
  statuses: Share[]
  grades: Share[]
  sections: Share[]
}

export function renderOverviewReport(data: OverviewReport): Promise<Blob> {
  return pdf(<OverviewDocument data={data} />).toBlob()
}

function OverviewDocument({ data }: { data: OverviewReport }) {
  return (
    <PaperPage title="GUIDANCE DASHBOARD" schoolName={data.schoolName} officeName={data.officeName}>
      <Text style={{ marginBottom: 8 }}>
        Prepared {formatTimestamp(data.issuedAt.toISOString())} by {data.preparedBy}.
      </Text>
      <Text style={{ marginBottom: 4 }}>Filters</Text>
      <Text>School year: {data.year}</Text>
      <Text>Grade: {data.grade}</Text>
      <Text>Gender: {data.sex}</Text>
      <Text>Section: {data.section}</Text>
      <Text style={{ marginBottom: 10 }}>Case history: {data.caseHistory}</Text>
      <Text>Students: {data.studentCount}</Text>
      <Text>With a case: {data.withCase}</Text>
      <Text style={{ marginBottom: 10 }}>With a sanction: {data.withSanction}</Text>
      <ShareBlock title="Status" rows={data.statuses} />
      <ShareBlock title="Grade" rows={data.grades} />
      {data.sections.length > 0 ? <ShareBlock title="Section" rows={data.sections} /> : null}
    </PaperPage>
  )
}

function ShareBlock({ title, rows }: { title: string; rows: Share[] }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ marginBottom: 4 }}>{title}</Text>
      {rows.length === 0 ? <Text>None in this view.</Text> : rows.map((row) => (
        <Text key={row.key}>
          {row.label}: {row.count} ({formatPercent(row.percent)})
        </Text>
      ))}
    </View>
  )
}
