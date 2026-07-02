'use client'

import { useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import EmojiPicker from '@/components/editor/EmojiPicker'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { mdToArticleJson, mdExtractTitle } from '@/lib/markdownConvert'

const Editor = dynamic(() => import('@/components/editor/Editor'), { ssr: false })
const ArticleEditor = dynamic(() => import('@/components/editor/ArticleEditor'), { ssr: false })

const DEFAULT_WORKSPACE_CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'section',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Uebersicht' }] },
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

const DEFAULT_ARTICLE_CONTENT = {
  type: 'doc',
  attrs: { wikiMode: 'article' },
  content: [
    {
      type: 'section',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Abschnitt' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Eintrag' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Schreibe hier deinen Artikel im Stil von wiki v1.' }] },
      ],
    },
  ],
}

export default function NewNotePage() {
  const searchParams = useSearchParams()
  const contentMode = searchParams.get('type') === 'workspace' ? 'workspace' : 'article'
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [content, setContent] = useState<object>(contentMode === 'article' ? DEFAULT_ARTICLE_CONTENT : DEFAULT_WORKSPACE_CONTENT)
  const [saving, setSaving] = useState(false)
  const [importKey, setImportKey] = useState(0)
  const router = useRouter()
  const mdImportRef = useRef<HTMLInputElement>(null)

  function handleMdImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const extracted = mdExtractTitle(text)
      if (extracted && !title.trim()) setTitle(extracted)
      setContent(mdToArticleJson(text))
      setImportKey(k => k + 1)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

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
        content_type: contentMode,
        user_id: user.id,
      })
      .select('id')
      .single()

    setSaving(false)
    if (!error && data) router.push(`/notes/${data.id}/edit`)
  }

  const modeTitle = contentMode === 'article' ? 'Neuer Artikel' : 'Neuer Workspace'
  const modeDescription = contentMode === 'article'
    ? 'Linearer Text fuer Guides, Rezepte, Cheatsheets und laengere Notizen.'
    : 'Freie Flaeche fuer strukturierte Bloecke, Skizzen und visuelle Arbeitsstaende.'

  return (
    <div style={{ animation: 'fadeIn 0.2s ease both', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flexShrink: 0, marginTop: '4px' }}>
          <button
            onClick={() => setPickerOpen(o => !o)}
            title="Emoji auswaehlen"
            style={{
              width: '52px',
              height: '52px',
              fontSize: '28px',
              background: pickerOpen ? 'var(--surface2)' : 'none',
              border: '1px solid ' + (pickerOpen ? 'var(--border)' : 'transparent'),
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              lineHeight: 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { if (!pickerOpen) { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'none' } }}
          >
            {emoji || (contentMode === 'article' ? 'A' : '+')}
          </button>
          {pickerOpen && (
            <EmojiPicker
              onSelect={e => { setEmoji(e); setPickerOpen(false) }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>

        <div style={{ flex: '1 1 420px', minWidth: 'min(100%, 280px)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 800 }}>
            {modeTitle}
          </div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={contentMode === 'article' ? 'Titel des Artikels...' : 'Titel des Workspaces...'}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
            style={{
              fontSize: '28px',
              fontWeight: 800,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--accent)',
              fontFamily: 'inherit',
              width: '100%',
              padding: 0,
            }}
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Kurze Beschreibung..."
            style={{
              fontSize: '13px',
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--muted)',
              fontFamily: 'inherit',
              width: '100%',
              padding: 0,
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginTop: '4px', flexWrap: 'wrap' }}>
          <ThemeToggle />
          {contentMode === 'article' && (
            <>
              <input
                ref={mdImportRef}
                type="file"
                accept=".md,text/markdown"
                style={{ display: 'none' }}
                onChange={handleMdImport}
              />
              <button
                type="button"
                onClick={() => mdImportRef.current?.click()}
                style={{
                  padding: '9px 14px',
                  background: 'none',
                  color: 'var(--muted)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                MD importieren
              </button>
            </>
          )}
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
            {saving ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '7px 11px',
          border: '1px solid var(--border)',
          borderRadius: '999px',
          background: 'var(--surface)',
          color: 'var(--muted)',
          fontSize: '12px',
          fontWeight: 700,
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
          {contentMode === 'article' ? 'Artikel' : 'Workspace Canvas'}
        </span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '7px 11px',
          border: '1px solid var(--border)',
          borderRadius: '999px',
          background: 'var(--surface)',
          color: 'var(--muted)',
          fontSize: '12px',
          fontWeight: 600,
        }}>
          {modeDescription}
        </span>
        <Link
          href={contentMode === 'article' ? '/create?type=workspace' : '/create?type=article'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '7px 11px',
            border: '1px solid var(--border)',
            borderRadius: '999px',
            background: 'transparent',
            color: 'var(--accent)',
            fontSize: '12px',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Zu {contentMode === 'article' ? 'Workspace' : 'Artikel'} wechseln
        </Link>
      </div>

      {contentMode === 'article' ? (
        <div style={{ padding: '8px 0 24px' }}>
          <ArticleEditor key={importKey} content={content} onChange={setContent} />
        </div>
      ) : (
        <Editor content={content} onChange={setContent} />
      )}
    </div>
  )
}
