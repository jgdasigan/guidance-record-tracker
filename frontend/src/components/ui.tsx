import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react'
import { messageFrom, withinEditWindow } from '../lib/format.ts'
import { signedDocumentUrls } from '../lib/api.ts'
import { isImagePath, isPdfPath } from '../lib/files.ts'
import { statusLabel } from '../lib/labels.ts'
import type { GuidanceStatus } from '../lib/types.ts'

export function Banner({
  tone,
  children,
}: {
  tone: 'error' | 'ok' | 'warn'
  children: ReactNode
}) {
  return (
    <p className={`banner banner-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function StatusPill({ status, large = false }: { status: GuidanceStatus; large?: boolean }) {
  return <span className={`pill pill-${status}${large ? ' pill-lg' : ''}`}>{statusLabel(status)}</span>
}

export function PageHeader({
  title,
  lede,
  actions,
}: {
  title: string
  lede?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  )
}

export function FilePicker({
  label,
  accept,
  extensions,
  files,
  disabled = false,
  emptyLabel,
  hint,
  onFiles,
  onReject,
}: {
  label: string
  accept: string
  extensions: string[]
  files: File[]
  disabled?: boolean
  emptyLabel: string
  hint: string
  onFiles: (files: File[]) => void
  onReject: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function add(incoming: File[]) {
    if (disabled || incoming.length === 0) return
    const accepted: File[] = []
    let rejected = false
    for (const file of incoming) {
      const name = file.name.toLowerCase()
      if (extensions.some((extension) => name.endsWith(extension))) accepted.push(file)
      else rejected = true
    }
    if (accepted.length > 0) onFiles([...files, ...accepted])
    if (rejected) onReject('Only PDF, Word, or image files are accepted.')
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!disabled) setDragging(true)
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    setDragging(false)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setDragging(false)
    add([...event.dataTransfer.files])
  }

  return (
    <div className="field">
      <span>{label}</span>
      <div
        className={`drop-zone${dragging ? ' drop-zone-active' : ''}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={(event) => {
          event.preventDefault()
          if (!disabled) inputRef.current?.click()
        }}
        onKeyDown={(event) => {
          if (disabled) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <strong>{emptyLabel}</strong>
        <span className="muted">{hint}</span>
      </div>
      {files.length > 0 ? (
        <div className="thumbs">
          {files.map((file, index) => (
            <PendingThumb
              key={`${file.name}-${file.lastModified}-${file.size}-${index}`}
              file={file}
              onRemove={() => onFiles(files.filter((_, item) => item !== index))}
            />
          ))}
        </div>
      ) : null}
      <input
        ref={inputRef}
        className="file-input-clip"
        type="file"
        accept={accept}
        multiple
        tabIndex={-1}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const picked = [...(event.target.files ?? [])]
          event.target.value = ''
          add(picked)
        }}
      />
    </div>
  )
}

function PendingThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const image = isImagePath(file.name)
  const pdf = isPdfPath(file.name)

  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])

  return (
    <>
      <FileThumb
        name={file.name}
        previewUrl={image ? url : null}
        onOpen={() => setOpen(true)}
        onRemove={onRemove}
      />
      {open && url ? (
        <FileViewer
          url={url}
          name={file.name}
          kind={image ? 'image' : pdf ? 'pdf' : 'file'}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

export function FileThumb({
  name,
  previewUrl,
  onOpen,
  onRemove,
}: {
  name: string
  previewUrl: string | null
  onOpen: () => void
  onRemove?: () => void
}) {
  return (
    <div className="thumb">
      <button type="button" className="thumb-open" onClick={onOpen} aria-label={`Open ${name}`}>
        {previewUrl ? <img src={previewUrl} alt={name} /> : <span className="thumb-label">{name}</span>}
      </button>
      {onRemove ? (
        <button type="button" className="thumb-remove" aria-label={`Remove ${name}`} onClick={onRemove}>
          ×
        </button>
      ) : null}
    </div>
  )
}

export function FileViewer({
  url,
  name,
  kind,
  onClose,
}: {
  url: string
  name: string
  kind: 'image' | 'pdf' | 'file'
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-back viewer-back" role="presentation" onMouseDown={onClose}>
      <div
        className="viewer"
        role="dialog"
        aria-label={name}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="viewer-bar">
          <strong>{name}</strong>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
        {kind === 'image' ? <img src={url} alt={name} /> : null}
        {kind === 'pdf' ? <iframe title={name} src={url} /> : null}
        {kind === 'file' ? <p className="muted">This file can be kept with the record. It does not preview here.</p> : null}
      </div>
    </div>
  )
}

export function useEditWindow(createdAt: string | undefined): boolean {
  const [open, setOpen] = useState(() => (createdAt ? withinEditWindow(createdAt) : true))
  useEffect(() => {
    if (!createdAt) {
      setOpen(true)
      return
    }
    const remaining = new Date(createdAt).getTime() + 60 * 60 * 1000 - Date.now()
    if (remaining <= 0) {
      setOpen(false)
      return
    }
    setOpen(true)
    const timer = window.setTimeout(() => setOpen(false), remaining)
    return () => window.clearTimeout(timer)
  }, [createdAt])
  return open
}

export function SavedFiles({
  files,
  onRemove,
}: {
  files: Array<{ id: string; title: string; storage_path: string; created_at?: string }>
  onRemove?: (id: string, storagePath: string) => Promise<void>
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [viewer, setViewer] = useState<{ url: string; name: string; path: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const paths = files.map((file) => file.storage_path).join('\n')

  useEffect(() => {
    const list = paths ? paths.split('\n') : []
    if (list.length === 0) return
    let cancel = false
    void signedDocumentUrls(list)
      .then((next) => {
        if (!cancel) setUrls(next)
      })
      .catch((caught) => {
        if (!cancel) setError(messageFrom(caught))
      })
    return () => {
      cancel = true
    }
  }, [paths])

  if (files.length === 0) return null

  return (
    <>
      <div className="thumbs">
        {files.map((file) => (
          <SavedThumb
            key={file.id}
            name={file.title}
            createdAt={file.created_at}
            previewUrl={isImagePath(file.storage_path) ? urls[file.storage_path] ?? null : null}
            onOpen={() => {
              const next = urls[file.storage_path]
              if (!next) return
              setViewer({ url: next, name: file.title, path: file.storage_path })
            }}
            onRemove={onRemove ? () => onRemove(file.id, file.storage_path).catch((caught) => setError(messageFrom(caught))) : undefined}
          />
        ))}
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {viewer ? (
        <FileViewer
          url={viewer.url}
          name={viewer.name}
          kind={isImagePath(viewer.path) ? 'image' : isPdfPath(viewer.path) ? 'pdf' : 'file'}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </>
  )
}

function SavedThumb({
  name,
  createdAt,
  previewUrl,
  onOpen,
  onRemove,
}: {
  name: string
  createdAt?: string
  previewUrl: string | null
  onOpen: () => void
  onRemove?: () => void
}) {
  const open = useEditWindow(createdAt)
  return (
    <FileThumb
      name={name}
      previewUrl={previewUrl}
      onOpen={onOpen}
      onRemove={onRemove && (createdAt ? open : true) ? onRemove : undefined}
    />
  )
}

export function OpenFileButton({ path, label = 'Open' }: { path: string; label?: string }) {
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  return (
    <span className="open-file">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          setError(null)
          void signedDocumentUrls([path])
            .then((urls) => {
              const next = urls[path]
              if (!next) throw new Error('Could not open that file.')
              setUrl(next)
            })
            .catch((caught) => setError(messageFrom(caught)))
        }}
      >
        {label}
      </button>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {url ? (
        <FileViewer
          url={url}
          name={label}
          kind={isImagePath(path) ? 'image' : isPdfPath(path) ? 'pdf' : 'file'}
          onClose={() => setUrl(null)}
        />
      ) : null}
    </span>
  )
}
