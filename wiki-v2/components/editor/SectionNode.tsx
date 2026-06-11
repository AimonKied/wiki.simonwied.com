'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useState, useRef, useEffect } from 'react'

const ELEMENTS = [
  { key: 'paragraph',   label: 'Text',         icon: '¶',   },
  { key: 'h1',          label: 'Überschrift 1', icon: 'H1',  },
  { key: 'h2',          label: 'Überschrift 2', icon: 'H2',  },
  { key: 'h3',          label: 'Überschrift 3', icon: 'H3',  },
  { key: 'bulletList',  label: 'Aufzählung',    icon: '•',   },
  { key: 'orderedList', label: 'Nummeriert',    icon: '1.',  },
  { key: 'codeBlock',   label: 'Code',          icon: '</>',  },
  { key: 'blockquote',  label: 'Zitat',         icon: '"',   },
  { key: 'hr',          label: 'Trennlinie',    icon: '—',   },
  { key: 'table',       label: 'Tabelle',       icon: '⊞',  },
  { key: 'image',       label: 'Bild',          icon: '⬜',  },
]

function SectionView({ editor, node, getPos, deleteNode }: NodeViewProps) {
  const [open, setOpen] = useState(false)
  const [imageMode, setImageMode] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [hovered, setHovered] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as HTMLElement)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function addElement(key: string) {
    if (!editor || typeof getPos !== 'function') return
    if (key === 'image') { setOpen(false); setImageMode(true); return }

    const sectionPos = getPos()
    if (sectionPos === undefined) return
    const insertPos = sectionPos + node.nodeSize - 1

    if (key === 'hr') {
      editor.chain().focus().insertContentAt(insertPos, { type: 'horizontalRule' }).run()
      setOpen(false); return
    }
    if (key === 'table') {
      editor.chain().focus().setTextSelection(insertPos).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
      setOpen(false); return
    }

    const nodes: Record<string, object> = {
      paragraph:   { type: 'paragraph' },
      h1:          { type: 'heading', attrs: { level: 1 } },
      h2:          { type: 'heading', attrs: { level: 2 } },
      h3:          { type: 'heading', attrs: { level: 3 } },
      bulletList:  { type: 'bulletList',  content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      orderedList: { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      codeBlock:   { type: 'codeBlock',   attrs: { language: null } },
      blockquote:  { type: 'blockquote',  content: [{ type: 'paragraph' }] },
    }
    const n = nodes[key]
    if (n) editor.chain().focus().insertContentAt(insertPos, n).run()
    setOpen(false)
  }

  function insertImage() {
    if (!editor || !imageUrl.trim() || typeof getPos !== 'function') return
    const sectionPos = getPos()
    if (sectionPos === undefined) return
    editor.chain().focus()
      .insertContentAt(sectionPos + node.nodeSize - 1, { type: 'image', attrs: { src: imageUrl.trim() } })
      .run()
    setImageUrl('')
    setImageMode(false)
  }

  const editable = editor.isEditable

  return (
    <NodeViewWrapper style={{ margin: '0 0 12px' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px 28px 16px',
          position: 'relative',
          transition: 'border-color 0.15s',
        }}
      >
        {/* Delete button — top right, visible on hover */}
        {editable && hovered && (
          <button
            title="Block löschen"
            onClick={() => deleteNode()}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'none',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              color: 'var(--muted)',
              fontSize: '11px',
              padding: '3px 7px',
              borderRadius: '4px',
              fontFamily: 'inherit',
              lineHeight: 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent2)'; e.currentTarget.style.borderColor = 'var(--accent2)'; e.currentTarget.style.background = '#fff0f2' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'none' }}
          >
            ✕
          </button>
        )}

        {/* Editable content */}
        <NodeViewContent />

        {/* Element picker */}
        {editable && (
          <div style={{ position: 'relative', marginTop: '12px' }} ref={pickerRef}>
            <button
              onClick={() => setOpen(p => !p)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                background: 'none',
                border: '1px dashed var(--border)',
                borderRadius: '6px',
                color: 'var(--muted)',
                fontSize: '11px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.1s',
              }}
            >
              <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span>
              Element
            </button>

            {open && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '8px',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '3px',
                zIndex: 200,
                width: '300px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}>
                {ELEMENTS.map(el => (
                  <button
                    key={el.key}
                    onClick={() => addElement(el.key)}
                    style={{
                      padding: '8px 10px',
                      background: 'none',
                      border: '1px solid transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent' }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{el.icon}</span>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{el.label}</span>
                  </button>
                ))}
              </div>
            )}

            {imageMode && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <input
                  autoFocus
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') insertImage(); if (e.key === 'Escape') setImageMode(false) }}
                  placeholder="https://..."
                  style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit', outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
                />
                <button onClick={insertImage} style={{ padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 }}>OK</button>
                <button onClick={() => setImageMode(false)} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
              </div>
            )}
          </div>
        )}
      </div>

    </NodeViewWrapper>
  )
}

export const SectionExtension = Node.create({
  name: 'section',
  group: 'block',
  content: 'block+',
  defining: true,

  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes), 0]
  },

  parseHTML() {
    return [{ tag: 'section' }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SectionView)
  },
})
