'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { Note } from '@/lib/types'
import Link from 'next/link'
import RightSidebar from '@/components/editor/RightSidebar'
import EmojiPicker from '@/components/editor/EmojiPicker'

const Editor = dynamic(() => import('@/components/editor/Editor'), { ssr: false })

export default function EditNotePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [content, setContent] = useState<object>({})
  const [isPublic, setIsPublic] = useState(false)
  const [slug, setSlug] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('notes').select('*').eq('id', id).single()
      if (data) {
        setNote(data)
        setTitle(data.title)
        setDescription(data.description ?? '')
        setEmoji(data.emoji ?? '')
        setContent(data.content ?? {})
        setIsPublic(data.is_public)
        setSlug(data.slug ?? '')
      }
      setLoading(false)
    }
    load()
  }, [id])

  const handleSave = useCallback(async () => {
    if (!title.trim()) return
    setSaving(true)
    setSaved(false)

    const supabase = createClient()
    await supabase
      .from('notes')
      .update({
        title: title.trim(),
        emoji: emoji || null,
        description: description.trim() || null,
        content,
        is_public: isPublic,
        slug: isPublic && slug.trim() ? slug.trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [id, title, description, emoji, content, isPublic, slug])

  async function handleDelete() {
    if (!confirm('Notiz wirklich löschen?')) return
    const supabase = createClient()
    await supabase.from('notes').delete().eq('id', id)
    router.push('/dashboard')
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave])

  if (loading) return <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Lädt…</div>
  if (!note) return (
    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
      Notiz nicht gefunden. <Link href="/dashboard" style={{ color: 'var(--accent)' }}>Zurück</Link>
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', animation: 'fadeIn 0.2s ease both' }}>

      {/* Main editor column */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '28px' }}>

          {/* Emoji button */}
          <div style={{ position: 'relative', flexShrink: 0, marginTop: '4px' }}>
            <button
              onClick={() => setPickerOpen(o => !o)}
              title="Emoji auswählen"
              style={{
                width: '52px', height: '52px', fontSize: '28px',
                background: pickerOpen ? 'var(--surface2)' : 'none',
                border: '1px solid ' + (pickerOpen ? 'var(--border)' : 'transparent'),
                borderRadius: '10px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', lineHeight: 1,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { if (!pickerOpen) { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'none' } }}
            >
              {emoji || '📄'}
            </button>
            {pickerOpen && (
              <EmojiPicker
                onSelect={e => { setEmoji(e); setPickerOpen(false) }}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>

          {/* Title + Description */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
              style={{
                fontSize: '28px', fontWeight: 800, background: 'none', border: 'none',
                outline: 'none', color: 'var(--accent)', fontFamily: 'inherit', width: '100%', padding: 0,
              }}
            />
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung…"
              style={{
                fontSize: '13px', background: 'none', border: 'none', outline: 'none',
                color: 'var(--muted)', fontFamily: 'inherit', width: '100%', padding: 0,
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginTop: '4px' }}>
            {saved && <span style={{ fontSize: '12px', color: 'var(--accent)' }}>Gespeichert</span>}
            <button
              onClick={handleDelete}
              style={{
                padding: '9px 14px', background: 'none', color: 'var(--muted)',
                border: '1px solid var(--border)', borderRadius: '8px',
                fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              Löschen
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '9px 20px', background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                fontFamily: 'inherit', cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Speichert…' : 'Speichern'}
            </button>
          </div>

        </div>

        {/* Editor */}
        <Editor content={content} onChange={setContent} />

        {/* Metadaten */}
        <div style={{
          marginTop: '20px', padding: '16px 20px', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: '10px',
          display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }}
            />
            Öffentlich
          </label>
          {isPublic && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>/notes/</span>
              <input
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="mein-slug"
                style={{
                  flex: 1, padding: '5px 10px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: '6px',
                  fontSize: '12px', fontFamily: 'inherit', color: 'var(--text)', outline: 'none',
                }}
              />
              {slug && (
                <Link
                  href={`/notes/${slug}`}
                  target="_blank"
                  style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  Ansehen →
                </Link>
              )}
            </div>
          )}
          <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: 'auto' }}>
            Strg+S zum Speichern
          </span>
        </div>

      </div>

      {/* Right sidebar */}
      <RightSidebar content={content} />

    </div>
  )
}
