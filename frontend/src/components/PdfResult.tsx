import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerSource from 'pdfjs-dist/build/pdf.worker.min.mjs?raw'
import { Banner } from './ui.tsx'

// Chrome's PDF viewer does not load inside Streamlit's frame, so the page is
// drawn here instead. The worker has to live in a blob because this app is
// shipped as one HTML file and cannot request a separate worker script.
if (!GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = URL.createObjectURL(
    new Blob([workerSource], { type: 'text/javascript' }),
  )
}

export function PdfResult({
  file,
  busy,
  attached,
  error,
  notice,
  onPrint,
  onDownload,
  onAttach,
}: {
  file: Blob | null
  busy: boolean
  attached: boolean
  error: string | null
  notice: string | null
  onPrint: () => void
  onDownload: () => void
  onAttach: () => void
}) {
  if (!file) return null
  return (
    <section className="panel">
      <h2>PDF</h2>
      <PdfCanvas file={file} />
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onPrint}>
          Print
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onDownload}>
          Download
        </button>
        <button type="button" className="btn btn-primary" disabled={busy || attached} onClick={onAttach}>
          {attached ? 'Attached' : busy ? 'Working…' : 'Attach to this record'}
        </button>
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}
    </section>
  )
}

function PdfCanvas({ file }: { file: Blob }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [message, setMessage] = useState('Preparing preview…')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    setFailed(false)
    setMessage('Preparing preview…')

    void (async () => {
      try {
        const data = new Uint8Array(await file.arrayBuffer())
        const pdf = await getDocument({ data }).promise
        const page = await pdf.getPage(1)
        if (cancelled) return
        const viewport = page.getViewport({ scale: 1.5 })
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvas, viewport }).promise
        if (!cancelled) setMessage('')
      } catch (caught) {
        if (cancelled) return
        setFailed(true)
        setMessage(caught instanceof Error ? caught.message : 'Could not show this PDF.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [file])

  return (
    <div className="pdf-preview">
      {message ? <p className={failed ? 'banner banner-error' : 'muted'}>{message}</p> : null}
      <canvas ref={canvasRef} className="pdf-canvas" />
    </div>
  )
}
