import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactNode } from 'react'

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 46,
    fontFamily: 'Times-Roman',
    fontSize: 11,
    color: '#1e1a16',
    lineHeight: 1.4,
  },
  school: { fontSize: 16, textAlign: 'center' },
  office: { fontSize: 11, textAlign: 'center', marginTop: 2 },
  rule: {
    marginTop: 8,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1a16',
  },
  title: { fontSize: 13, textAlign: 'center', letterSpacing: 1.1, marginBottom: 14 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 150, color: '#5c564e' },
  value: { flex: 1 },
  paragraph: { marginTop: 10 },
  signatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 46,
  },
  sign: { width: '30%' },
  signLine: {
    borderTopWidth: 1,
    borderTopColor: '#1e1a16',
    paddingTop: 4,
    fontSize: 9,
  },
})

export function PaperPage({
  title,
  schoolName,
  officeName,
  children,
}: {
  title: string
  schoolName: string
  officeName: string
  children: ReactNode
}) {
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.school}>{schoolName}</Text>
        <Text style={styles.office}>{officeName}</Text>
        <View style={styles.rule} />
        <Text style={styles.title}>{title}</Text>
        {children}
      </Page>
    </Document>
  )
}

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

export function Signatures({ labels }: { labels: string[] }) {
  return (
    <View style={styles.signatures}>
      {labels.map((label) => (
        <View key={label} style={styles.sign}>
          <Text style={styles.signLine}>{label}</Text>
        </View>
      ))}
    </View>
  )
}

export const scheduleBox = StyleSheet.create({
  box: {
    marginTop: 14,
    marginBottom: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e1a16',
  },
  label: { fontSize: 9, color: '#5c564e', marginBottom: 3 },
  when: { fontSize: 13 },
})
