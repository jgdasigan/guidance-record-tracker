import { pdf, Text } from '@react-pdf/renderer'
import { formatTimestamp, recorded } from '../lib/format.ts'
import { Fact, PaperPage, Signatures } from './paper.tsx'

export interface WaiverPdfData {
  schoolName: string
  officeName: string
  studentName: string
  gradeLevel: string
  section: string
  age: number | null
  guardianName: string
  relationship: string | null
  phone: string
  purpose: string
  counselorName: string
  issuedAt: Date
}

export function WaiverDocument({ data }: { data: WaiverPdfData }) {
  return (
    <PaperPage
      title="PARENT / GUARDIAN WAIVER"
      schoolName={data.schoolName}
      officeName={data.officeName}
    >
      <Fact label="Student" value={data.studentName} />
      <Fact label="Grade and section" value={`${data.gradeLevel} - ${data.section}`} />
      <Fact label="Age" value={recorded(data.age)} />
      <Fact label="Parent / guardian" value={data.guardianName} />
      {data.relationship ? <Fact label="Relationship" value={data.relationship} /> : null}
      <Fact label="Contact number" value={recorded(data.phone)} />
      <Text style={{ marginTop: 12, color: '#5c564e' }}>Purpose</Text>
      <Text>{data.purpose}</Text>
      <Text style={{ marginTop: 10 }}>
        I am the parent or guardian of the student named above. I allow the guidance counselor to meet with the student for the purpose stated here, and I understand I may ask the office about these sessions.
      </Text>
      <Text style={{ marginTop: 8 }}>
        Prepared {formatTimestamp(data.issuedAt.toISOString())} by {data.counselorName}.
      </Text>
      <Signatures labels={['Parent / guardian', 'Guidance counselor']} />
    </PaperPage>
  )
}

export function renderWaiver(data: WaiverPdfData): Promise<Blob> {
  return pdf(<WaiverDocument data={data} />).toBlob()
}
