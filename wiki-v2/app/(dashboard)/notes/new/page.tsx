'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'

const Editor = dynamic(() => import('@/components/editor/Editor'), { ssr: false })

const DEFAULT_CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'section',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Übersicht' }] },
        { type: 'paragraph' },
      ],
    },
    {
      type: 'section',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Details' }] },
        { type: 'paragraph' },
      ],
    },
    {
      type: 'section',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Notizen' }] },
        { type: 'paragraph' },
      ],
    },
  ],
}

export default function NewNotePage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState<object>(DEFAULT_CONTENT)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data, error } = await supabase
      .from('notes')
      .insert({ title: title.trim(), content, user_id: user.id })
      .select('id')
      .single()

    setSaving(false)
    if (!error && data) {
      router.push(`/notes/${data.id}/edit`)
    }
  }

  return (
    <div style={{ animation: 'fadeIn 0.2s ease both', maxWidth: '860px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Titel der Notiz…"
          autoFocus
          style={{
            fontSize: '28px',
            fontWeight: 800,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontFamily: 'inherit',
            flex: 1,
            marginRight: '16px',
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          style={{
            padding: '9px 20px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: saving || !title.trim() ? 'not-allowed' : 'pointer',
            opacity: saving || !title.trim() ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
      </div>

      <Editor content={DEFAULT_CONTENT} onChange={setContent} />
    </div>
  )
}
