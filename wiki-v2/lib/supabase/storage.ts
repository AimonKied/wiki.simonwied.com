import { createClient } from './client'

export const MEDIA_LIMITS = {
  image: 10 * 1024 * 1024,  // 10 MB
  video: 50 * 1024 * 1024,  // 50 MB
}

const ACCEPTED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
const ACCEPTED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']

export function validateMedia(file: File): { ok: true } | { ok: false; error: string } {
  const isVideo = file.type.startsWith('video/')
  const accepted = isVideo ? ACCEPTED_VIDEO : ACCEPTED_IMAGE
  const limit = isVideo ? MEDIA_LIMITS.video : MEDIA_LIMITS.image

  if (!accepted.includes(file.type)) {
    return { ok: false, error: `Dateityp nicht unterstützt: ${file.type}` }
  }
  if (file.size > limit) {
    const mb = Math.round(limit / 1024 / 1024)
    return { ok: false, error: `Datei zu groß. Maximum: ${mb} MB` }
  }
  return { ok: true }
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
  if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`)

  const { data } = supabase.storage.from('wiki-media').getPublicUrl(path)
  return data.publicUrl
}
