'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import EmojiPicker from '@/components/editor/EmojiPicker'

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
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
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
      .insert({
        title: title.trim(),
        emoji: emoji || null,
        description: description.trim() || null,
        content,
        user_id: user.id,
      })
      .select('id')
      .single()

    setSaving(false)
    if (!error && data) router.push(`/notes/${data.id}/edit`)
  }

  return (
    <div style={{ animation: 'fadeIn 0.2s ease both', maxWidth: '860px' }}>

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
            placeholder="Titel der Notiz…"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
            style={{
              fontSize: '28px', fontWeight: 800,
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--accent)', fontFamily: 'inherit', width: '100%',
              padding: 0,
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

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          style={{
            padding: '9px 20px', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
            fontFamily: 'inherit', cursor: saving || !title.trim() ? 'not-allowed' : 'pointer',
            opacity: saving || !title.trim() ? 0.6 : 1, flexShrink: 0, marginTop: '4px',
          }}
        >
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
      </div>

      <Editor content={DEFAULT_CONTENT} onChange={setContent} />
    </div>
  )
}
