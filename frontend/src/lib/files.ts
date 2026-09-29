const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const ATTACHABLE_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx']

export const ATTACHABLE_ACCEPT = ATTACHABLE_EXTENSIONS.join(',')

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']

export function isImagePath(path: string): boolean {
  const name = path.toLowerCase()
  return IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension))
}

export function isPdfPath(path: string): boolean {
  return path.toLowerCase().endsWith('.pdf')
}

export function assertUploadSize(file: File): void {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('That file is larger than 10 MB. Use a smaller scan or PDF.')
  }
}

export function printPdf(blob: Blob): void {
  // Printing the window would include the student list. A throwaway frame
  // prints only the generated form.
  const url = URL.createObjectURL(blob)
  const frame = document.createElement('iframe')
  frame.setAttribute('title', 'Print preview')
  frame.style.position = 'fixed'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.src = url
  frame.onload = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    window.setTimeout(() => {
      frame.remove()
      URL.revokeObjectURL(url)
    }, 60_000)
  }
  document.body.appendChild(frame)
}

export function downloadPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
