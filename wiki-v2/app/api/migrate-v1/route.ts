import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readFileSync } from 'fs'
import path from 'path'
import { parseV1Html } from '@/lib/v1Parser'

export interface MigrateRequestBody {
  slug: string
  categorySlug: string
  isPublic: boolean
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Migration nur lokal verfuegbar' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as MigrateRequestBody
  const { slug, categorySlug, isPublic } = body

  // Read HTML file
  const htmlPath = path.join(process.cwd(), '..', 'pages', slug, `${slug}.html`)
  let html: string
  try {
    html = readFileSync(htmlPath, 'utf-8')
  } catch {
    return NextResponse.json({ error: `Datei nicht gefunden: ${htmlPath}` }, { status: 404 })
  }

  // Parse
  const { meta, content } = parseV1Html(html)

  // Look up category
  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .ilike('slug', categorySlug)
    .single()

  // Check if article already exists
  const { data: existing } = await supabase
    .from('notes')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Artikel mit diesem Slug existiert bereits', id: existing.id }, { status: 409 })
  }

  // Insert note
  const { data: note, error } = await supabase
    .from('notes')
    .insert({
      title: meta.title,
      emoji: meta.emoji,
      description: meta.description,
      content,
      content_type: 'article',
      user_id: user.id,
      is_public: isPublic,
      slug: isPublic ? slug : null,
    })
    .select('id')
    .single()

  if (error || !note) {
    return NextResponse.json({ error: error?.message ?? 'Datenbankfehler' }, { status: 500 })
  }

  // Assign category
  if (category) {
    await supabase
      .from('note_categories')
      .insert({ note_id: note.id, category_id: category.id })
  }

  return NextResponse.json({ id: note.id, title: meta.title })
}
