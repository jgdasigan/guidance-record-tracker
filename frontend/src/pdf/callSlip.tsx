import { pdf, Text, View } from '@react-pdf/renderer'
import { formatSchedule, formatTimestamp, recorded } from '../lib/format.ts'
import { Fact, PaperPage, scheduleBox, Signatures } from './paper.tsx'

export interface CallSlipPdfData {
  schoolName: string
  officeName: string
  studentName: string
  gradeLevel: string
  section: string
  age: number | null
  guardianName: string
  relationship: string | null
  phone: string
  scheduledAt: Date
  reason: string
  counselorName: string
  issuedAt: Date
}

export function CallSlipDocument({ data }: { data: CallSlipPdfData }) {
  return (
    <PaperPage title="CALL SLIP" schoolName={data.schoolName} officeName={data.officeName}>
      <Fact label="Student" value={data.studentName} />
      <Fact label="Grade and section" value={`${data.gradeLevel} - ${data.section}`} />
      <Fact label="Age" value={recorded(data.age)} />
      <Fact label="Parent / guardian" value={data.guardianName} />
      {data.relationship ? <Fact label="Relationship" value={data.relationship} /> : null}
      <Fact label="Contact number" value={recorded(data.phone)} />
      <View style={scheduleBox.box}>
        <Text style={scheduleBox.label}>Report to the guidance office</Text>
        <Text style={scheduleBox.when}>{formatSchedule(data.scheduledAt)}</Text>
      </View>
      <Text style={{ marginTop: 4, color: '#5c564e' }}>Reason for the call</Text>
      <Text>{data.reason}</Text>
      <Text style={{ marginTop: 10 }}>
        Please allow this student to leave class and report to the guidance office at the schedule above. Kindly sign and return this slip.
      </Text>
      <Text style={{ marginTop: 8 }}>
        Prepared {formatTimestamp(data.issuedAt.toISOString())} by {data.counselorName}.
      </Text>
      <Signatures labels={['Guidance counselor', 'Parent / guardian', 'Student']} />
    </PaperPage>
  )
}

export function renderCallSlip(data: CallSlipPdfData): Promise<Blob> {
  return pdf(<CallSlipDocument data={data} />).toBlob()
}
