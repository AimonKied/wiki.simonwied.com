import { createClient } from './client'

export const MEDIA_LIMITS = {
  image: 10 * 1024 * 1024,  // 10 MB
}

const ACCEPTED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']

export function validateMedia(file: File): { ok: true } | { ok: false; error: string } {
  if (!ACCEPTED_IMAGE.includes(file.type)) {
    return { ok: false, error: `Dateityp nicht unterstützt: ${file.type}` }
  }
  if (file.size > MEDIA_LIMITS.image) {
    const mb = Math.round(MEDIA_LIMITS.image / 1024 / 1024)
    return { ok: false, error: `Datei zu groß. Maximum: ${mb} MB` }
  }
  return { ok: true }
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

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('wiki-media').upload(path, file)
  if (error) {
    if (error.message.toLowerCase().includes('bucket not found')) {
      return fileToDataUrl(file)
    }
    throw new Error(`Upload fehlgeschlagen: ${error.message}`)
  }

  const { data } = supabase.storage.from('wiki-media').getPublicUrl(path)
  return data.publicUrl
}
