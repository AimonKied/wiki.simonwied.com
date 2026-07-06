'use client'

import { useState, useEffect } from 'react'
import EmojiPicker from './EmojiPicker'

const WORKSPACE_HEADER_COLLAPSED_KEY = 'wiki-workspace-header-collapsed'

// Eine Chrome fuer Edit- und Public-Ansicht einer Notiz, damit beide exakt
// gleich aussehen (Notion-Style: Viewer sieht dieselbe Seite, nur ohne
// Eingabefelder/Aktionen). `editable=false` macht aus Inputs statischen Text.
export default function NoteHeader({
  emoji,
  title,
  description,
  statusLabel,
  typeLabel,
  isArticle,
  isPublic,
  editable,
  onEmojiChange,
  onTitleChange,
  onDescriptionChange,
  titleInputRef,
  actions,
  linkRight,
  floating,
}: {
  emoji: string
  title: string
  description: string
  statusLabel: string
  typeLabel: string
  isArticle: boolean
  isPublic: boolean
  editable: boolean
  onEmojiChange?: (emoji: string) => void
  onTitleChange?: (value: string) => void
  onDescriptionChange?: (value: string) => void
  titleInputRef?: React.Ref<HTMLInputElement>
  actions?: React.ReactNode
  linkRight?: React.ReactNode
  // Kompakte einzeilige Kopfleiste statt Titel+Beschreibung+Badges — fuer
  // Workspace-Notizen, deren Canvas selbst im Vordergrund stehen soll.
  floating?: boolean
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  // Workspace-Kopfleiste einklappbar, damit sie dem Canvas nicht dauerhaft
  // im Weg ist. Zustand in localStorage; body-Attribut lässt Editor.tsx den
  // Canvas per CSS entsprechend hoeher machen (siehe globals.css).
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    if (!floating) return
    let stored = false
    try { stored = localStorage.getItem(WORKSPACE_HEADER_COLLAPSED_KEY) === '1' } catch {}
    if (stored) {
      setCollapsed(true)
      document.body.setAttribute('data-workspace-header-collapsed', 'true')
    }
    return () => { document.body.removeAttribute('data-workspace-header-collapsed') }
  }, [floating])

  function toggleCollapsed() {
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem(WORKSPACE_HEADER_COLLAPSED_KEY, next ? '1' : '0') } catch {}
      if (next) document.body.setAttribute('data-workspace-header-collapsed', 'true')
      else document.body.removeAttribute('data-workspace-header-collapsed')
      return next
    })
  }

  if (floating) {
    if (collapsed) {
      return (
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Kopfleiste einblenden"
          aria-label="Kopfleiste einblenden"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '18px', marginBottom: '8px',
            border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px',
            background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontSize: '10px', lineHeight: 1,
          }}
        >
          ⌄
        </button>
      )
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>{emoji || '🗂️'}</span>
        {editable ? (
          <input
            ref={titleInputRef}
            value={title}
            placeholder="Ohne Titel"
            onChange={e => onTitleChange?.(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
            style={{
              flex: '1 1 200px', minWidth: 0, fontSize: '15px', fontWeight: 700, background: 'none', border: 'none',
              outline: 'none', color: 'var(--text)', fontFamily: 'inherit', padding: 0,
            }}
          />
        ) : (
          <span style={{
            flex: '1 1 200px', minWidth: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title || 'Ohne Titel'}
          </span>
        )}
        <span
          title={isPublic ? 'Öffentlich' : 'Privater Entwurf'}
          style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: isPublic ? 'var(--accent)' : 'var(--muted)' }}
        />
        {linkRight}
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
            {actions}
          </div>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Kopfleiste ausblenden"
          aria-label="Kopfleiste ausblenden"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '22px', height: '22px', flexShrink: 0,
            border: 'none', borderRadius: '5px',
            background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '11px', lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)' }}
        >
          ︿
        </button>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>

        {/* Emoji */}
        <div style={{ position: 'relative', flexShrink: 0, marginTop: '4px' }}>
          <button
            type="button"
            disabled={!editable}
            onClick={() => editable && setPickerOpen(o => !o)}
            title={editable ? 'Emoji auswählen' : undefined}
            style={{
              width: '52px', height: '52px', fontSize: '28px',
              background: pickerOpen ? 'var(--surface2)' : 'none',
              border: '1px solid ' + (pickerOpen ? 'var(--border)' : 'transparent'),
              borderRadius: '10px', cursor: editable ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', lineHeight: 1,
            }}
            onMouseEnter={e => { if (editable) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)' } }}
            onMouseLeave={e => { if (editable && !pickerOpen) { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'none' } }}
          >
            {emoji || '📄'}
          </button>
          {editable && pickerOpen && (
            <EmojiPicker
              onSelect={e => { onEmojiChange?.(e); setPickerOpen(false) }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>

        {/* Titel + Beschreibung */}
        <div style={{ flex: '1 1 420px', minWidth: 'min(100%, 280px)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 800 }}>
            {statusLabel}
          </div>
          {editable ? (
            <input
              ref={titleInputRef}
              value={title}
              placeholder="Ohne Titel"
              onChange={e => onTitleChange?.(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
              style={{
                fontSize: '28px', fontWeight: 800, background: 'none', border: 'none',
                outline: 'none', color: 'var(--accent)', fontFamily: 'var(--font-display)', width: '100%', padding: 0,
              }}
            />
          ) : (
            <h1 style={{
              fontSize: '28px', fontWeight: 800, margin: 0,
              color: 'var(--accent)', fontFamily: 'var(--font-display)', width: '100%',
            }}>
              {title || 'Ohne Titel'}
            </h1>
          )}
          {editable ? (
            <input
              value={description}
              onChange={e => onDescriptionChange?.(e.target.value)}
              placeholder="Kurze Beschreibung…"
              style={{
                fontSize: '13px', background: 'none', border: 'none', outline: 'none',
                color: 'var(--muted)', fontFamily: 'inherit', width: '100%', padding: 0,
              }}
            />
          ) : description ? (
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              {description}
            </p>
          ) : null}
        </div>

        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, marginTop: '4px', flexWrap: 'wrap' }}>
            {actions}
          </div>
        )}
      </div>

      {/* Badges */}
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
          {isPublic ? 'Öffentlich' : 'Privater Entwurf'}
        </span>
        {linkRight}
      </div>
    </>
  )
}
