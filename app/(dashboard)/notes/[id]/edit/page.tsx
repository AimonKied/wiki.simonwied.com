'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { Note, Category } from '@/lib/notes/types'
import Link from 'next/link'
import RightSidebar from '@/components/editor/RightSidebar'
import ArticleToc from '@/components/editor/ArticleToc'
import NoteHeader from '@/components/editor/NoteHeader'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { mdToArticleJson, mdExtractTitle, articleJsonToMd } from '@/lib/editor/markdown'

type Visibility = 'private' | 'link' | 'public'

const Editor = dynamic(() => import('@/components/editor/Editor'), { ssr: false })
const ArticleEditor = dynamic(() => import('@/components/editor/ArticleEditor'), { ssr: false })

function menuItemStyle(color?: string): React.CSSProperties {
  return {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    color: color ?? 'var(--muted)',
    fontSize: '13px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'background 0.1s',
  }
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function EditNotePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('')
  const [content, setContent] = useState<object>({})
  const [contentType, setContentType] = useState<'article' | 'workspace'>('workspace')
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [publishVisibility, setPublishVisibility] = useState<Visibility>('public')
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [publishError, setPublishError] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [categoryError, setCategoryError] = useState(false)
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const saveChain = useRef(Promise.resolve())
  const debounceRef = useRef(0)
  const hydratedRef = useRef(false)
  const mdImportRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [importKey, setImportKey] = useState(0)
  // Sekundaere Aktionen (MD-Import/-Export, Privat schalten, Loeschen) im ⋯-Menue
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
  const actionsMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!actionsMenuOpen) return
    function onDocClick(e: MouseEvent) {
      if (actionsMenuRef.current?.contains(e.target as Node)) return
      setActionsMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setActionsMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [actionsMenuOpen])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [noteRes, catsRes, noteCatsRes, shareLinkRes] = await Promise.all([
        supabase.from('notes').select('*').eq('id', id).single(),
        supabase.from('categories').select('*').order('position').order('title'),
        supabase.from('note_categories').select('category_id').eq('note_id', id),
        supabase.from('note_share_links').select('token').eq('note_id', id).maybeSingle(),
      ])

      if (noteRes.data) {
        const data = noteRes.data as Note
        // Oeffnen zaehlt als "zuletzt verwendet"; danach Sidebar-Reload
        // anstossen — so haengt "Zuletzt" nicht an Supabase-Realtime
        void supabase
          .from('notes')
          .update({ last_opened_at: new Date().toISOString() })
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.error('last_opened_at konnte nicht gesetzt werden:', error.message)
            else document.dispatchEvent(new Event('wiki-notes-changed'))
          })
        setNote(data)
        setTitle(data.title)
        setDescription(data.description ?? '')
        setEmoji(data.emoji ?? '')
        setContent(data.content ?? {})
        setContentType(data.content_type ?? 'workspace')
        const loadedVisibility = data.visibility ?? (data.is_public ? 'public' : 'private')
        setVisibility(loadedVisibility)
        setPublishVisibility(loadedVisibility === 'private' ? 'public' : loadedVisibility)
        setSlug(data.slug ?? '')
        setSlugManual(!!data.slug)
      }
      if (catsRes.data) setAllCategories(catsRes.data as Category[])
      if (noteCatsRes.data) setSelectedCategories(noteCatsRes.data.map(r => r.category_id))
      setShareToken((shareLinkRes.data?.token as string | undefined) ?? null)

      setLoading(false)
    }
    load()
  }, [id])

  // Auto-suggest slug from title (only if not manually edited)
  useEffect(() => {
    if (slugManual || (visibility !== 'public' && publishVisibility !== 'public')) return
    setSlug(slugify(title))
  }, [title, visibility, publishVisibility, slugManual])

  // Auto-save only changes the working copy. Publishing always goes through the
  // atomic RPC below, so readers can never observe a half-updated snapshot.
  const persist = useCallback(() => {
    setCategoryError(false)
    window.clearTimeout(debounceRef.current)
    debounceRef.current = 0

    const effectiveSlug = slug.trim()
    const draftSlug = effectiveSlug || null

    const snapshot = {
      title: title.trim(),
      emoji: emoji || null,
      description: description.trim() || null,
      content,
      slug: draftSlug,
    }
    const payload: Record<string, unknown> = {
      title: snapshot.title,
      emoji: snapshot.emoji,
      description: snapshot.description,
      content,
      content_type: contentType,
      slug: draftSlug,
    }
    setSaveStatus('saving')
    saveChain.current = saveChain.current
      .then(async () => {
        const supabase = createClient()
        const { error } = await supabase.from('notes').update(payload).eq('id', id)
        if (error) { setSaveStatus('error'); return }
        setSaveStatus('saved')
        // Sidebar "Zuletzt" refetches on this — instant even without Supabase realtime
        document.dispatchEvent(new Event('wiki-notes-changed'))
      })
      .catch(() => setSaveStatus('error'))
  }, [id, title, description, emoji, content, contentType, slug])

  const handleSave = useCallback(() => { persist() }, [persist])
  const openPublishModal = useCallback(() => {
    if (!slug.trim()) setSlug(slugify(title))
    setCategoryError(false)
    setCopyStatus('idle')
    setPublishError('')
    setPublishVisibility(visibility === 'private' ? 'public' : visibility)
    setPublishModalOpen(true)
  }, [slug, title, visibility])

  const confirmVisibility = useCallback(async () => {
    if (publishVisibility !== 'private' && !title.trim()) {
      setPublishError('Zum Freigeben ist ein Titel erforderlich.')
      return
    }
    if (publishVisibility === 'public' && selectedCategories.length === 0) {
      setCategoryError(true)
      setPublishError('Bitte wähle mindestens eine Kategorie.')
      return
    }

    window.clearTimeout(debounceRef.current)
    debounceRef.current = 0
    setCategoryError(false)
    setPublishError('')
    setSaveStatus('saving')

    const effectiveSlug = slug.trim() || slugify(title)
    if (effectiveSlug !== slug) setSlug(effectiveSlug)
    const snapshot = {
      title: title.trim(),
      emoji: emoji || null,
      description: description.trim() || null,
      content,
      slug: effectiveSlug || null,
    }

    const task = saveChain.current.then(async () => {
      const supabase = createClient()
      if (publishVisibility === 'private') {
        const { error } = await supabase.rpc('set_note_private', { p_note_id: id })
        if (error) throw error
        setVisibility('private')
        setShareToken(null)
        setNote(current => current ? { ...current, visibility: 'private', is_public: false } : current)
      } else {
        const { data, error } = await supabase.rpc('publish_note', {
          p_note_id: id,
          p_visibility: publishVisibility,
          p_snapshot: snapshot,
          p_slug: effectiveSlug,
          p_category_ids: selectedCategories,
          p_rotate_link: false,
        }).single()
        if (error) throw error
        const token = (data as { share_token?: string | null } | null)?.share_token ?? null
        setVisibility(publishVisibility)
        setShareToken(publishVisibility === 'link' ? token : null)
        setNote(current => current ? {
          ...current,
          visibility: publishVisibility,
          is_public: publishVisibility === 'public',
          published: snapshot,
          published_at: new Date().toISOString(),
        } : current)
      }
      setSaveStatus('saved')
      setPublishError('')
      document.dispatchEvent(new Event('wiki-notes-changed'))
      if (publishVisibility !== 'link') setPublishModalOpen(false)
    })

    saveChain.current = task.catch((error: unknown) => {
      setSaveStatus('error')
      setPublishError(error instanceof Error ? error.message : 'Freigabe fehlgeschlagen.')
    })
    await saveChain.current
  }, [content, description, emoji, id, publishVisibility, selectedCategories, slug, title])

  const handleUnpublish = useCallback(async () => {
    const supabase = createClient()
    const { error } = await supabase.rpc('set_note_private', { p_note_id: id })
    if (error) { setSaveStatus('error'); return }
    setVisibility('private')
    setShareToken(null)
    setNote(current => current ? { ...current, visibility: 'private', is_public: false } : current)
    document.dispatchEvent(new Event('wiki-notes-changed'))
  }, [id])

  const copyShareLink = useCallback(async () => {
    if (!shareToken) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
  }, [shareToken])

  const rotateShareLink = useCallback(async () => {
    if (!window.confirm('Der bisherige Freigabelink wird sofort ungültig. Neuen Link erzeugen?')) return
    const supabase = createClient()
    const { data, error } = await supabase.rpc('rotate_note_share_link', { p_note_id: id })
    if (error || !data) { setCopyStatus('error'); return }
    setShareToken(data as string)
    setCopyStatus('idle')
  }, [id])

  // Notion-style: broadcast title/emoji per keystroke so the sidebar entry
  // updates in the same frame, before any save round trip.
  const patchSidebar = useCallback((patch: { title?: string; emoji?: string | null }) => {
    document.dispatchEvent(new CustomEvent('wiki-note-patched', { detail: { id, ...patch } }))
  }, [id])

  // Fresh notes arrive here straight from "Neuer Inhalt" with an empty title —
  // focus it so typing starts immediately (like Notion's new page).
  useEffect(() => {
    if (loading || !note || title.trim()) return
    const raf = window.requestAnimationFrame(() => titleInputRef.current?.focus())
    return () => window.cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, note])

  async function confirmDelete() {
    const supabase = createClient()
    await supabase.from('notes').delete().eq('id', id)
    document.dispatchEvent(new Event('wiki-notes-changed'))
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

  // Auto-save with debounce; first run after load marks hydration only
  useEffect(() => {
    if (loading || !note) return
    if (!hydratedRef.current) { hydratedRef.current = true; return }
    setSaveStatus('idle')
    debounceRef.current = window.setTimeout(handleSave, 1500)
    return () => {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = 0
    }
  }, [loading, note, handleSave])

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (debounceRef.current === 0 && saveStatus !== 'saving') return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [saveStatus])

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

  function handleMdExport() {
    const md = articleJsonToMd(content)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.trim() || 'artikel'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggleCategory(catId: string) {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    )
    setCategoryError(false)
  }

  if (loading) return <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Lädt…</div>
  if (!note) return (
    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
      Notiz nicht gefunden. <Link href="/dashboard" style={{ color: 'var(--accent)' }}>Zurück</Link>
    </div>
  )

  const isArticle = contentType === 'article'
  const typeLabel = isArticle ? 'Artikel' : 'Workspace Canvas'
  const visibilityLabel = visibility === 'public'
    ? 'Öffentlich'
    : visibility === 'link'
      ? 'Nur per Link'
      : 'Privater Entwurf'

  return (
    <div
      className="note-editor-shell"
      data-content-type={isArticle ? 'article' : 'workspace'}
      style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', animation: 'fadeIn 0.2s ease both', flexWrap: 'wrap' }}
    >

      {/* Main editor column — relative als Anker fuer die schwebende
          Workspace-Kopfleiste (NoteHeader floating) */}
      <div className="note-editor-main" style={{ flex: 1, minWidth: 0, position: 'relative' }}>

        <NoteHeader
          emoji={emoji}
          title={title}
          description={description}
          statusLabel={visibilityLabel}
          visibilityLabel={visibilityLabel}
          typeLabel={typeLabel}
          isArticle={isArticle}
          isPublic={visibility === 'public'}
          floating={!isArticle}
          editable
          titleInputRef={titleInputRef}
          onEmojiChange={e => { setEmoji(e); patchSidebar({ emoji: e || null }) }}
          onTitleChange={v => { setTitle(v); patchSidebar({ title: v }) }}
          onDescriptionChange={setDescription}
          linkRight={visibility === 'public' && note.published?.slug ? (
            <Link
              href={`/notes/${note.published.slug}`}
              target="_blank"
              style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              /notes/{note.published.slug} ansehen →
            </Link>
          ) : visibility === 'link' && shareToken ? (
            <Link
              href={`/share/${shareToken}`}
              target="_blank"
              style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              Freigabelink ansehen →
            </Link>
          ) : undefined}
          actions={
            <>
              <ThemeToggle />
              {saveStatus === 'error' && <span style={{ fontSize: '12px', color: 'var(--accent2)' }}>Speichern fehlgeschlagen</span>}
              <button
                onClick={openPublishModal}
                title="Sichtbarkeit und Veröffentlichung verwalten"
                style={{
                  padding: '9px 20px', background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                Teilen
              </button>

              {/* ⋯-Menue fuer sekundaere Aktionen */}
              {isArticle && (
                <input
                  ref={mdImportRef}
                  type="file"
                  accept=".md,text/markdown"
                  style={{ display: 'none' }}
                  onChange={handleMdImport}
                />
              )}
              <div ref={actionsMenuRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setActionsMenuOpen(o => !o)}
                  title="Weitere Aktionen"
                  aria-expanded={actionsMenuOpen}
                  style={{
                    padding: '9px 12px', background: actionsMenuOpen ? 'var(--surface2)' : 'none',
                    color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '8px',
                    fontSize: '15px', fontFamily: 'inherit', cursor: 'pointer', lineHeight: 1,
                  }}
                >
                  ⋯
                </button>
                {actionsMenuOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 150,
                    width: '200px', display: 'flex', flexDirection: 'column', gap: '2px',
                    padding: '6px', background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '10px', boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                    animation: 'fadeIn 0.12s ease both',
                  }}>
                    {isArticle && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setActionsMenuOpen(false); mdImportRef.current?.click() }}
                          style={menuItemStyle()}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          MD importieren
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActionsMenuOpen(false); handleMdExport() }}
                          style={menuItemStyle()}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          MD exportieren
                        </button>
                      </>
                    )}
                    {visibility !== 'private' && (
                      <button
                        type="button"
                        title="Notiz wieder privat schalten"
                        onClick={() => { setActionsMenuOpen(false); handleUnpublish() }}
                        style={menuItemStyle()}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        Privat schalten
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setActionsMenuOpen(false); setDeleteModalOpen(true) }}
                      style={menuItemStyle('var(--accent2)')}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      Löschen
                    </button>
                  </div>
                )}
              </div>
            </>
          }
        />

        {/* Editor */}
        {isArticle
          ? <ArticleEditor key={importKey} content={content} onChange={setContent} />
          : <Editor content={content} onChange={setContent} />}

      </div>

      {!isArticle && <RightSidebar content={content} />}
      {isArticle && <ArticleToc content={content} />}

      {/* Publish modal — portalled to body so the editor's transform (fadeIn)
          doesn't clip the fixed overlay to a rectangle */}
      {publishModalOpen && createPortal(
        <div
          onClick={() => setPublishModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', animation: 'fadeIn 0.12s ease both',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '460px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '14px', padding: '22px 22px 18px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ fontSize: '17px', fontWeight: 800, marginBottom: '4px', fontFamily: 'var(--font-display)' }}>
              Teilen und veröffentlichen
            </div>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
              Leser sehen immer nur den zuletzt freigegebenen Stand, nie deinen laufenden Entwurf.
            </p>

            <div style={{ display: 'grid', gap: '8px', marginBottom: '18px' }}>
              {([
                ['private', 'Entwurf', 'Nur für mich sichtbar. Bestehende Links werden widerrufen.'],
                ['link', 'Nur per Link', 'Jeder mit dem geheimen Link kann diesen Stand lesen.'],
                ['public', 'Öffentlich', 'In der Bibliothek und über die öffentliche URL sichtbar.'],
              ] as Array<[Visibility, string, string]>).map(([value, label, help]) => {
                const active = publishVisibility === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setPublishVisibility(value); setCategoryError(false); setCopyStatus('idle') }}
                    style={{
                      display: 'flex', gap: '11px', alignItems: 'flex-start', width: '100%', textAlign: 'left',
                      padding: '11px 12px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : 'var(--bg)',
                      color: 'var(--text)',
                    }}
                  >
                    <span style={{
                      width: '15px', height: '15px', marginTop: '2px', flexShrink: 0, borderRadius: '50%',
                      border: `4px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: 'var(--surface)',
                    }} />
                    <span>
                      <strong style={{ display: 'block', fontSize: '13px', marginBottom: '2px' }}>{label}</strong>
                      <span style={{ display: 'block', fontSize: '11px', lineHeight: 1.5, color: 'var(--muted)' }}>{help}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {publishVisibility === 'public' && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 700, letterSpacing: '0.06em' }}>URL</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>/notes/</span>
                    <input
                      value={slug}
                      onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); setSlugManual(true) }}
                      placeholder="mein-slug"
                      style={{ flex: 1, padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', color: 'var(--text)', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '22px' }}>
                  <div style={{ fontSize: '11px', color: categoryError ? 'var(--accent2)' : 'var(--muted)', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.06em' }}>
                    {categoryError ? 'Mindestens eine Kategorie wählen' : 'KATEGORIEN'}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {allCategories.map(cat => {
                      const active = selectedCategories.includes(cat.id)
                      return (
                        <button key={cat.id} type="button" onClick={() => toggleCategory(cat.id)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 11px', borderRadius: '999px', cursor: 'pointer',
                          fontSize: '12px', fontFamily: 'inherit', fontWeight: 600,
                          border: `1px solid ${active ? cat.color ?? 'var(--accent)' : 'var(--border)'}`,
                          background: active ? (cat.color ?? 'var(--accent)') + '22' : 'transparent',
                          color: active ? (cat.color ?? 'var(--accent)') : 'var(--muted)',
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cat.color ?? 'var(--muted)', display: 'inline-block' }} />
                          {cat.title}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {publishVisibility === 'link' && shareToken && visibility === 'link' && (
              <div style={{ padding: '12px', marginBottom: '18px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg)' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '7px', fontWeight: 700 }}>GEHEIMER FREIGABELINK</div>
                <div style={{ fontSize: '12px', color: 'var(--text)', overflowWrap: 'anywhere', marginBottom: '10px' }}>
                  {typeof window !== 'undefined' ? window.location.origin : ''}/share/{shareToken}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={copyShareLink} style={{ padding: '7px 11px', borderRadius: '7px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    {copyStatus === 'copied' ? 'Kopiert ✓' : copyStatus === 'error' ? 'Kopieren fehlgeschlagen' : 'Link kopieren'}
                  </button>
                  <button type="button" onClick={rotateShareLink} style={{ padding: '7px 11px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer' }}>
                    Link erneuern
                  </button>
                </div>
              </div>
            )}

            {publishError && (
              <p role="alert" style={{ margin: '0 0 14px', color: 'var(--accent2)', fontSize: '12px', lineHeight: 1.5 }}>
                {publishError}
              </p>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <button
                onClick={() => setPublishModalOpen(false)}
                style={{
                  padding: '9px 16px', background: 'none', color: 'var(--muted)',
                  border: '1px solid var(--border)', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                Schließen
              </button>
              <button
                onClick={confirmVisibility}
                disabled={saveStatus === 'saving'}
                style={{
                  padding: '9px 20px', background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                  fontFamily: 'inherit', cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                  opacity: saveStatus === 'saving' ? 0.6 : 1,
                }}
              >
                {publishVisibility === 'private'
                  ? 'Privat schalten'
                  : visibility === publishVisibility
                    ? 'Aktuellen Stand freigeben'
                    : publishVisibility === 'link' ? 'Per Link freigeben' : 'Öffentlich machen'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deleteModalOpen && createPortal(
        <div
          onClick={() => setDeleteModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 210,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', animation: 'fadeIn 0.12s ease both',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '380px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '14px', padding: '20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ fontSize: '17px', fontWeight: 800, marginBottom: '6px', fontFamily: 'var(--font-display)' }}>
              {isArticle ? 'Artikel löschen?' : 'Workspace löschen?'}
            </div>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
              „{title || 'Ohne Titel'}“ wird endgültig gelöscht.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                style={{
                  padding: '9px 14px', background: 'none', color: 'var(--muted)',
                  border: '1px solid var(--border)', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                style={{
                  padding: '9px 16px', background: 'var(--accent2)', color: '#fff',
                  border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}
