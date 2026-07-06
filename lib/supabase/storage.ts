import { createClient } from './client'

export const MEDIA_LIMITS = {
  input: 25 * 1024 * 1024,   // 25 MB — Rohdatei vor Kompression
  stored: 2 * 1024 * 1024,   // 2 MB — nach Kompression im Bucket
}

const ACCEPTED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']

// SVG ist Vektor, GIF verliert Animation beim Canvas-Export — beide unkomprimiert lassen
const SKIP_COMPRESSION = ['image/svg+xml', 'image/gif']

const MAX_DIMENSION = 1600
const WEBP_QUALITY = 0.85

export function validateMedia(file: File): { ok: true } | { ok: false; error: string } {
  if (!ACCEPTED_IMAGE.includes(file.type)) {
    return { ok: false, error: `Dateityp nicht unterstützt: ${file.type}` }
  }
  if (file.size > MEDIA_LIMITS.input) {
    const mb = Math.round(MEDIA_LIMITS.input / 1024 / 1024)
    return { ok: false, error: `Datei zu groß. Maximum: ${mb} MB` }
  }
  return { ok: true }
}

async function compressImage(file: File): Promise<File> {
  if (SKIP_COMPRESSION.includes(file.type)) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY)
  )
  if (!blob || blob.size >= file.size) return file

  const baseName = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `${baseName}.webp`, { type: 'image/webp' })
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'))
    reader.readAsDataURL(file)
  })
}

export async function uploadMedia(file: File): Promise<string> {
  const validation = validateMedia(file)
  if (!validation.ok) throw new Error(validation.error)

  const compressed = await compressImage(file)
  if (compressed.size > MEDIA_LIMITS.stored) {
    const mb = Math.round(MEDIA_LIMITS.stored / 1024 / 1024)
    throw new Error(`Bild auch nach Kompression zu groß. Maximum: ${mb} MB`)
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const ext = compressed.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('wiki-media').upload(path, compressed)
  if (error) {
    if (error.message.toLowerCase().includes('bucket not found')) {
      return fileToDataUrl(compressed)
    }
    throw new Error(`Upload fehlgeschlagen: ${error.message}`)
  }

  const { data } = supabase.storage.from('wiki-media').getPublicUrl(path)
  return data.publicUrl
}
