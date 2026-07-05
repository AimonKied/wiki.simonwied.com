'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import EmojiPicker from '@/components/editor/EmojiPicker'
import ArticleToc from '@/components/editor/ArticleToc'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { mdToArticleJson, mdExtractTitle } from '@/lib/markdownConvert'

const Editor = dynamic(() => import('@/components/editor/Editor'), { ssr: false })
const ArticleEditor = dynamic(() => import('@/components/editor/ArticleEditor'), { ssr: false })

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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
  const typeParam = searchParams.get('type')
  const draftParam = searchParams.get('draft')
  const contentMode = typeParam === 'article' || typeParam === 'workspace' ? typeParam : null
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [content, setContent] = useState<object>(contentMode === 'workspace' ? DEFAULT_WORKSPACE_CONTENT : DEFAULT_ARTICLE_CONTENT)
  const [loading, setLoading] = useState(!!contentMode)
  const [noteId, setNoteId] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [importKey, setImportKey] = useState(0)
  const router = useRouter()
  const mdImportRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const saveChain = useRef(Promise.resolve())
  const debounceRef = useRef(0)
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (!contentMode) return
    setContent(contentMode === 'workspace' ? DEFAULT_WORKSPACE_CONTENT : DEFAULT_ARTICLE_CONTENT)
    setImportKey(k => k + 1)
  }, [contentMode])

  useEffect(() => {
    if (!contentMode) return

    let cancelled = false

    async function loadOrCreateDraft() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      if (draftParam) {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('id', draftParam)
          .eq('user_id', user.id)
          .maybeSingle()

        if (cancelled) return
        if (error || !data) {
          setSaveStatus('error')
          setLoading(false)
          return
        }

        const noteData = data as {
          title: string
          emoji: string | null
          description: string | null
          content: object | null
          content_type: 'article' | 'workspace'
          is_public: boolean
        }
        setNoteId(draftParam)
        setTitle(noteData.title)
        setEmoji(noteData.emoji ?? '')
        setDescription(noteData.description ?? '')
        setContent(noteData.content ?? (noteData.content_type === 'workspace' ? DEFAULT_WORKSPACE_CONTENT : DEFAULT_ARTICLE_CONTENT))
        setIsPublic(noteData.is_public)
        setSaveStatus('saved')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('notes')
        .insert({
          title: '',
          emoji: null,
          description: null,
          content: contentMode === 'workspace' ? DEFAULT_WORKSPACE_CONTENT : DEFAULT_ARTICLE_CONTENT,
          content_type: contentMode,
          is_public: false,
          user_id: user.id,
        })
        .select('id')
        .single()

      if (cancelled) return
      if (error || !data) {
        setSaveStatus('error')
        setLoading(false)
        return
      }

      setNoteId(data.id)
      router.replace(`/create?type=${contentMode}&draft=${data.id}`)
      setLoading(false)
      setSaveStatus('saved')
    }

    loadOrCreateDraft()

    return () => {
      cancelled = true
    }
  }, [contentMode, draftParam, router])

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

  const persist = useCallback((mode: 'draft' | 'publish' = 'draft') => {
    if (!contentMode || !noteId) return

    window.clearTimeout(debounceRef.current)
    debounceRef.current = 0

    const effectiveTitle = title.trim()
    const effectiveSlug = mode === 'publish' && effectiveTitle ? slugify(effectiveTitle) : null

    const payload: Record<string, unknown> = {
      title: effectiveTitle,
      emoji: emoji || null,
      description: description.trim() || null,
      content,
      content_type: contentMode,
      slug: effectiveSlug,
    }
    if (mode === 'publish') {
      payload.is_public = true
      payload.published = {
        title: effectiveTitle,
        emoji: emoji || null,
        description: description.trim() || null,
        content,
        slug: effectiveSlug,
      }
    }

    setSaveStatus('saving')
    saveChain.current = saveChain.current
      .then(async () => {
        const supabase = createClient()
        const { error } = await supabase.from('notes').update(payload).eq('id', noteId)
        if (error) {
          setSaveStatus('error')
          return
        }
        setSaveStatus('saved')
        if (mode === 'publish') setIsPublic(true)
      })
      .catch(() => setSaveStatus('error'))
  }, [contentMode, noteId, title, emoji, description, content])

  const handlePublish = useCallback(() => {
    if (!title.trim()) return
    persist('publish')
  }, [persist, title])

  useEffect(() => {
    if (loading || !noteId) return
    if (!hydratedRef.current) { hydratedRef.current = true; return }
    setSaveStatus('idle')
    debounceRef.current = window.setTimeout(() => persist('draft'), 1200)
    return () => {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = 0
    }
  }, [loading, noteId, title, description, emoji, content, persist])

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (debounceRef.current === 0 && saveStatus !== 'saving') return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [saveStatus])

  useEffect(() => {
    if (contentMode !== 'article' || loading || !noteId) return
    const isDefaultTitle = title === 'Neuer Artikel' || !title.trim()
    if (!isDefaultTitle) return

    const raf = window.requestAnimationFrame(() => {
      const input = titleInputRef.current
      if (!input) return
      input.focus()
      input.select()
    })

    return () => window.cancelAnimationFrame(raf)
  }, [contentMode, loading, noteId, title])

  const modeTitle = contentMode === 'article' ? 'Neuer Artikel' : 'Neuer Workspace'
  const modeDescription = contentMode === 'article'
    ? 'Linearer Text fuer Guides, Rezepte, Cheatsheets und laengere Notizen.'
    : 'Freie Flaeche fuer strukturierte Bloecke, Skizzen und visuelle Arbeitsstaende.'

  if (!contentMode) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease both', width: '100%', maxWidth: '980px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '6px', fontFamily: 'var(--font-display)', letterSpacing: '0.01em' }}>Neuer Inhalt</h1>
            <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
              Waehle zuerst, welche Art von Inhalt du erstellen moechtest.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '12px' }}>
          <Link
            href="/create?type=article"
            style={{
              display: 'block',
              padding: '18px 20px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text)',
              textDecoration: 'none',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>Artikel</div>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px', lineHeight: 1.6 }}>
              Linearer Text fuer Guides, Rezepte, Cheatsheets und laengere Notizen.
            </p>
          </Link>

          <Link
            href="/create?type=workspace"
            style={{
              display: 'block',
              padding: '18px 20px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text)',
              textDecoration: 'none',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>Canvas Workspace</div>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px', lineHeight: 1.6 }}>
              Freie Flaeche fuer strukturierte Bloecke, Skizzen und visuelle Arbeitsstaende.
            </p>
          </Link>
        </div>
      </div>
    )
  }

  if (loading || !noteId) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease both', width: '100%', color: 'var(--muted)', fontSize: '13px' }}>
        Entwurf wird angelegt…
      </div>
    )
  }

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
            ref={titleInputRef}
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
              fontFamily: 'var(--font-display)',
              width: '100%',
              padding: 0,
              caretColor: 'var(--accent)',
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
            onClick={handlePublish}
            disabled={!noteId || !title.trim() || isPublic}
            style={{
              padding: '9px 20px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: !noteId || !title.trim() || isPublic ? 'not-allowed' : 'pointer',
              opacity: !noteId || !title.trim() || isPublic ? 0.6 : 1,
              flexShrink: 0,
            }}
          >
            {isPublic ? 'Veröffentlicht' : 'Veröffentlichen'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
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
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isPublic ? 'var(--accent)' : 'var(--border)' }} />
          {isPublic ? 'Öffentlich' : 'Privater Entwurf'}
        </span>
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
          fontWeight: 600,
        }}>
          {saveStatus === 'saving' && 'Speichert…'}
          {saveStatus === 'saved' && 'Gespeichert'}
          {saveStatus === 'error' && 'Speichern fehlgeschlagen'}
          {saveStatus === 'idle' && 'Autosave aktiv'}
        </span>
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
      </div>

      {contentMode === 'article' ? (
        <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', padding: '8px 0 24px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ArticleEditor key={importKey} content={content} onChange={setContent} />
          </div>
          <ArticleToc content={content} />
        </div>
      ) : (
        <Editor content={content} onChange={setContent} />
      )}
    </div>
  )
}
