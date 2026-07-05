'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { Note, Category } from '@/lib/types'
import Link from 'next/link'
import RightSidebar from '@/components/editor/RightSidebar'
import ArticleToc from '@/components/editor/ArticleToc'
import EmojiPicker from '@/components/editor/EmojiPicker'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { mdToArticleJson, mdExtractTitle, articleJsonToMd } from '@/lib/markdownConvert'

const Editor = dynamic(() => import('@/components/editor/Editor'), { ssr: false })
const ArticleEditor = dynamic(() => import('@/components/editor/ArticleEditor'), { ssr: false })

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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [content, setContent] = useState<object>({})
  const [contentType, setContentType] = useState<'article' | 'workspace'>('workspace')
  const [isPublic, setIsPublic] = useState(false)
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [categoryError, setCategoryError] = useState(false)
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const saveChain = useRef(Promise.resolve())
  const debounceRef = useRef(0)
  const hydratedRef = useRef(false)
  const mdImportRef = useRef<HTMLInputElement>(null)
  const [importKey, setImportKey] = useState(0)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [noteRes, catsRes, noteCatsRes] = await Promise.all([
        supabase.from('notes').select('*').eq('id', id).single(),
        supabase.from('categories').select('*').order('position').order('title'),
        supabase.from('note_categories').select('category_id').eq('note_id', id),
      ])

      if (noteRes.data) {
        const data = noteRes.data as Note
        setNote(data)
        setTitle(data.title)
        setDescription(data.description ?? '')
        setEmoji(data.emoji ?? '')
        setContent(data.content ?? {})
        setContentType(data.content_type ?? 'workspace')
        setIsPublic(data.is_public)
        setSlug(data.slug ?? '')
        setSlugManual(!!data.slug)
      }
      if (catsRes.data) setAllCategories(catsRes.data as Category[])
      if (noteCatsRes.data) setSelectedCategories(noteCatsRes.data.map(r => r.category_id))

      setLoading(false)
    }
    load()
  }, [id])

  // Auto-suggest slug from title (only if not manually edited)
  useEffect(() => {
    if (slugManual || !isPublic) return
    setSlug(slugify(title))
  }, [title, isPublic, slugManual])

  // 'draft' = auto-save working copy only (never touches the public snapshot).
  // 'publish' = copy the current draft into the frozen public snapshot + go public.
  // 'unpublish' = take the note offline (snapshot stays for a later re-publish).
  const persist = useCallback((mode: 'draft' | 'publish' | 'unpublish' = 'draft') => {
    if (!title.trim()) return
    if (mode === 'publish' && selectedCategories.length === 0) {
      setCategoryError(true)
      return
    }
    setCategoryError(false)
    window.clearTimeout(debounceRef.current)
    debounceRef.current = 0

    const effectiveSlug = slug.trim() || (mode === 'publish' ? slugify(title) : '')
    if (mode === 'publish' && effectiveSlug !== slug) setSlug(effectiveSlug)
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
    if (mode === 'publish') { payload.is_public = true; payload.published = snapshot }
    if (mode === 'unpublish') { payload.is_public = false }
    const cats = [...selectedCategories]

    setSaveStatus('saving')
    saveChain.current = saveChain.current
      .then(async () => {
        const supabase = createClient()
        const { error } = await supabase.from('notes').update(payload).eq('id', id)
        if (error) { setSaveStatus('error'); return }

        // Sync categories: delete all, re-insert current selection
        await supabase.from('note_categories').delete().eq('note_id', id)
        if (cats.length > 0) {
          await supabase.from('note_categories').insert(
            cats.map(cat_id => ({ note_id: id, category_id: cat_id }))
          )
        }
        setSaveStatus('saved')
        // Sidebar "Zuletzt" refetches on this — instant even without Supabase realtime
        document.dispatchEvent(new Event('wiki-notes-changed'))
        if (mode === 'publish') { setIsPublic(true); setNote(n => n ? { ...n, is_public: true, published: snapshot } : n) }
        if (mode === 'unpublish') { setIsPublic(false); setNote(n => n ? { ...n, is_public: false } : n) }
      })
      .catch(() => setSaveStatus('error'))
  }, [id, title, description, emoji, content, contentType, slug, selectedCategories])

  const handleSave = useCallback(() => { persist('draft') }, [persist])
  const openPublishModal = useCallback(() => {
    if (!slug.trim()) setSlug(slugify(title))
    setCategoryError(false)
    setPublishModalOpen(true)
  }, [slug, title])
  const confirmPublish = useCallback(() => {
    if (selectedCategories.length === 0) { setCategoryError(true); return }
    persist('publish')
    setPublishModalOpen(false)
  }, [persist, selectedCategories])
  const handleUnpublish = useCallback(() => { persist('unpublish') }, [persist])

  // Notion-style: broadcast title/emoji per keystroke so the sidebar entry
  // updates in the same frame, before any save round trip.
  const patchSidebar = useCallback((patch: { title?: string; emoji?: string | null }) => {
    document.dispatchEvent(new CustomEvent('wiki-note-patched', { detail: { id, ...patch } }))
  }, [id])

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
  const publishState = isPublic ? 'Oeffentlich sichtbar' : 'Privater Entwurf'

  return (
    <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', animation: 'fadeIn 0.2s ease both', flexWrap: 'wrap' }}>

      {/* Main editor column */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>

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
                onSelect={e => { setEmoji(e); patchSidebar({ emoji: e || null }); setPickerOpen(false) }}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>

          {/* Title + Description */}
          <div style={{ flex: '1 1 420px', minWidth: 'min(100%, 280px)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 800 }}>
              {publishState}
            </div>
            <input
              value={title}
              onChange={e => { setTitle(e.target.value); patchSidebar({ title: e.target.value }) }}
              onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
              style={{
                fontSize: '28px', fontWeight: 800, background: 'none', border: 'none',
                outline: 'none', color: 'var(--accent)', fontFamily: 'var(--font-display)', width: '100%', padding: 0,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginTop: '4px', flexWrap: 'wrap' }}>
            <ThemeToggle />
            {saveStatus === 'saving' && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Speichert…</span>}
            {saveStatus === 'saved' && <span style={{ fontSize: '12px', color: 'var(--accent)' }}>{isPublic ? 'Entwurf gespeichert' : 'Gespeichert'}</span>}
            {saveStatus === 'error' && <span style={{ fontSize: '12px', color: 'var(--accent2)' }}>Speichern fehlgeschlagen</span>}
            {isArticle && (
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
                    padding: '9px 14px', background: 'none', color: 'var(--muted)',
                    border: '1px solid var(--border)', borderRadius: '8px',
                    fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  MD importieren
                </button>
                <button
                  type="button"
                  onClick={handleMdExport}
                  style={{
                    padding: '9px 14px', background: 'none', color: 'var(--muted)',
                    border: '1px solid var(--border)', borderRadius: '8px',
                    fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  MD exportieren
                </button>
              </>
            )}
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
            {isPublic ? (
              <>
                <button
                  onClick={handleUnpublish}
                  title="Notiz wieder privat schalten"
                  style={{
                    padding: '9px 16px', background: 'none', color: 'var(--muted)',
                    border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  Zurückziehen
                </button>
                <button
                  onClick={openPublishModal}
                  title="Aktuellen Stand öffentlich übernehmen"
                  style={{
                    padding: '9px 20px', background: 'var(--accent)', color: '#fff',
                    border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  Änderungen veröffentlichen
                </button>
              </>
            ) : (
              <button
                onClick={openPublishModal}
                style={{
                  padding: '9px 20px', background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                Veröffentlichen
              </button>
            )}
          </div>

        </div>

        {/* Type badge */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            padding: '5px 10px', border: '1px solid var(--border)',
            borderRadius: '999px', background: 'var(--surface)',
            color: 'var(--muted)', fontSize: '11px', fontWeight: 700,
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isArticle ? '#009955' : '#4488ff' }} />
            {typeLabel}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            padding: '5px 10px', border: '1px solid var(--border)',
            borderRadius: '999px', background: 'var(--surface)',
            color: 'var(--muted)', fontSize: '11px', fontWeight: 700,
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isPublic ? 'var(--accent)' : 'var(--muted)' }} />
            {publishState}
          </span>
          {isPublic && note.published?.slug && (
            <Link
              href={`/notes/${note.published.slug}`}
              target="_blank"
              style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              /notes/{note.published.slug} ansehen →
            </Link>
          )}
        </div>

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
              {isPublic ? 'Änderungen veröffentlichen' : 'Veröffentlichen'}
            </div>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
              URL und Kategorien festlegen. Erst mit Bestätigung wird der aktuelle Stand öffentlich.
            </p>

            {/* Slug */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 700, letterSpacing: '0.06em' }}>
                URL
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>/notes/</span>
                <input
                  value={slug}
                  onChange={e => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                    setSlugManual(true)
                  }}
                  placeholder="mein-slug"
                  autoFocus
                  style={{
                    flex: 1, padding: '8px 10px', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: '8px',
                    fontSize: '13px', fontFamily: 'inherit', color: 'var(--text)', outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Categories */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ fontSize: '11px', color: categoryError ? 'var(--accent2)' : 'var(--muted)', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.06em' }}>
                {categoryError ? 'Mindestens eine Kategorie wählen' : 'KATEGORIEN'}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {allCategories.map(cat => {
                  const active = selectedCategories.includes(cat.id)
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '6px 11px', borderRadius: '999px', cursor: 'pointer',
                        fontSize: '12px', fontFamily: 'inherit', fontWeight: 600,
                        border: `1px solid ${active ? cat.color ?? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? (cat.color ?? 'var(--accent)') + '22' : 'transparent',
                        color: active ? (cat.color ?? 'var(--accent)') : 'var(--muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: cat.color ?? 'var(--muted)',
                        display: 'inline-block',
                      }} />
                      {cat.title}
                    </button>
                  )
                })}
              </div>
            </div>

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
                Abbrechen
              </button>
              <button
                onClick={confirmPublish}
                disabled={saveStatus === 'saving'}
                style={{
                  padding: '9px 20px', background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                  fontFamily: 'inherit', cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                  opacity: saveStatus === 'saving' ? 0.6 : 1,
                }}
              >
                {isPublic ? 'Änderungen veröffentlichen' : 'Veröffentlichen'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}
