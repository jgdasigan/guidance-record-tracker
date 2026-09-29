import { useEffect, useState, type FormEvent } from 'react'
import { Banner, Field, PageHeader } from '../components/ui.tsx'
import { saveSchool } from '../lib/api.ts'
import { messageFrom, requiredText } from '../lib/format.ts'
import { useOffice } from '../office/OfficeContext.tsx'

export function LetterheadPage() {
  const { school, refresh } = useOffice()
  const [schoolName, setSchoolName] = useState(school.school_name)
  const [officeName, setOfficeName] = useState(school.office_name)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSchoolName(school.school_name)
    setOfficeName(school.office_name)
  }, [school.office_name, school.school_name])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await saveSchool({
        school_name: requiredText(schoolName, 'School name'),
        office_name: requiredText(officeName, 'Office name'),
      })
      await refresh()
      setNotice('Letterhead saved. New call slips and waivers will use it.')
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page narrow">
      <PageHeader
        title="Letterhead"
        lede="Printed on every call slip and waiver. This does not change forms that were already generated."
      />
      <form className="panel" onSubmit={(event) => void onSubmit(event)}>
        <Field label="School name">
          <input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} required />
        </Field>
        <Field label="Office name">
          <input value={officeName} onChange={(event) => setOfficeName(event.target.value)} required />
        </Field>
        {error ? <Banner tone="error">{error}</Banner> : null}
        {notice ? <Banner tone="ok">{notice}</Banner> : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save letterhead'}
        </button>
      </form>
    </div>
  )
}
