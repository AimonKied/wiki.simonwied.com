'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { Note } from '@/lib/types'
import Link from 'next/link'

const Editor = dynamic(() => import('@/components/editor/Editor'), { ssr: false })

export default function EditNotePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState<object>({})
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
        setContent(data.content ?? {})
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
      .update({ title: title.trim(), content, updated_at: new Date().toISOString() })
      .eq('id', id)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [id, title, content])

  // Autosave on Ctrl+S
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

  if (loading) return (
    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Lädt…</div>
  )
  if (!note) return (
    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Notiz nicht gefunden. <Link href="/dashboard" style={{ color: 'var(--accent)' }}>Zurück</Link></div>
  )

  return (
    <div style={{ animation: 'fadeIn 0.2s ease both', maxWidth: '860px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{
            fontSize: '28px',
            fontWeight: 800,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontFamily: 'inherit',
            flex: 1,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {saved && <span style={{ fontSize: '12px', color: 'var(--accent)' }}>Gespeichert</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '9px 20px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
        </div>
      </div>

      <Editor content={content} onChange={setContent} />

      <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--muted)' }}>
        Strg+S zum Speichern
      </p>
    </div>
  )
}
