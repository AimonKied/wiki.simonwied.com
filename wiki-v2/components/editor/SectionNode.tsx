'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useState, useRef, useEffect } from 'react'

const ELEMENTS = [
  { key: 'paragraph',   label: 'Text',         icon: '¶'   },
  { key: 'h1',          label: 'Überschrift 1', icon: 'H1'  },
  { key: 'h2',          label: 'Überschrift 2', icon: 'H2'  },
  { key: 'h3',          label: 'Überschrift 3', icon: 'H3'  },
  { key: 'bulletList',  label: 'Aufzählung',    icon: '•'   },
  { key: 'orderedList', label: 'Nummeriert',    icon: '1.'  },
  { key: 'codeBlock',   label: 'Code',          icon: '</>' },
  { key: 'blockquote',  label: 'Zitat',         icon: '"'   },
  { key: 'hr',          label: 'Trennlinie',    icon: '—'   },
  { key: 'table',       label: 'Tabelle',       icon: '⊞'  },
  { key: 'image',       label: 'Bild',          icon: '⬜'  },
]

interface HandleInfo {
  top: number       // relative to card top (px)
  height: number    // element height (px)
  childPos: number  // ProseMirror position before child opening token
  childSize: number // child node size
}

function SectionView({ editor, node, getPos, deleteNode }: NodeViewProps) {
  const [handle, setHandle] = useState<HandleInfo | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [imageMode, setImageMode] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as HTMLElement)) {
        setPickerOpen(false)
      }
    }
    if (pickerOpen) document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [pickerOpen])

  function onMouseMove(e: React.MouseEvent) {
    if (!cardRef.current || !editor.isEditable || typeof getPos !== 'function') return
    const cardRect = cardRef.current.getBoundingClientRect()
    const sectionPos = getPos()
    if (sectionPos === undefined) return

    const sectionNode = editor.state.doc.nodeAt(sectionPos)
    if (!sectionNode) return

    // Iterate section children using ProseMirror state.
    // coordsAtPos gives reliable viewport coordinates from document positions —
    // no DOM traversal that might match wrong elements.
    let childOffset = sectionPos + 1
    for (let i = 0; i < sectionNode.childCount; i++) {
      const child = sectionNode.child(i)

      let topY: number, bottomY: number
      try {
        if (child.isLeaf) {
          // Leaf nodes (hr, image): single token, use side=1 to get coords of the node itself
          const c = editor.view.coordsAtPos(childOffset, 1)
          topY = c.top
          bottomY = c.bottom
        } else {
          // Non-leaf: enter node (+1), exit node (nodeSize-1)
          topY    = editor.view.coordsAtPos(childOffset + 1).top
          bottomY = editor.view.coordsAtPos(childOffset + child.nodeSize - 1).bottom
        }
      } catch {
        childOffset += child.nodeSize
        continue
      }

      if (e.clientY >= topY - 4 && e.clientY <= bottomY + 4) {
        setHandle({
          top: topY - cardRect.top,
          height: bottomY - topY,
          childPos: childOffset,
          childSize: child.nodeSize,
        })
        return
      }

      childOffset += child.nodeSize
    }
    setHandle(null)
  }

  function deleteElement() {
    if (!handle || !editor) return
    const { childPos, childSize } = handle
    const $pos = editor.state.doc.resolve(childPos)
    const parent = $pos.parent

    if (parent.type.name === 'section' && parent.childCount === 1) {
      // Only child — delete the whole section
      const sectionStart = childPos - $pos.parentOffset - 1
      editor.chain().focus().deleteRange({ from: sectionStart, to: sectionStart + parent.nodeSize }).run()
    } else {
      editor.chain().focus().deleteRange({ from: childPos, to: childPos + childSize }).run()
    }
  }

  function addElement(key: string) {
    if (!editor || typeof getPos !== 'function') return
    if (key === 'image') { setPickerOpen(false); setImageMode(true); return }
    const sectionPos = getPos()
    if (sectionPos === undefined) return
    const insertPos = sectionPos + node.nodeSize - 1
    if (key === 'hr') {
      editor.chain().focus().insertContentAt(insertPos, { type: 'horizontalRule' }).run()
      setPickerOpen(false); return
    }
    if (key === 'table') {
      editor.chain().focus().setTextSelection(insertPos).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
      setPickerOpen(false); return
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
    setPickerOpen(false)
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
        ref={cardRef}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHandle(null)}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px 28px 16px 44px',
          position: 'relative',
          outline: 'none',
        }}
      >
        {/* Hover indicator: React-controlled overlay — no DOM classList manipulation */}
        {editable && handle && (
          <div
            style={{
              position: 'absolute',
              left: 4,
              right: 4,
              top: handle.top - 3,
              height: handle.height + 6,
              borderRadius: '6px',
              background: 'transparent',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        )}

        {/* Handle buttons: drag + delete for the hovered element */}
        {editable && handle && (
          <div
            style={{
              position: 'absolute',
              left: 4,
              top: handle.top,
              height: handle.height,
              display: 'flex',
              alignItems: 'center',
              gap: '1px',
              zIndex: 10,
            }}
          >
            <div
              title="Verschieben"
              style={{ cursor: 'grab', color: 'var(--muted)', fontSize: '13px', padding: '3px 2px', borderRadius: '3px', lineHeight: 1, userSelect: 'none' }}
            >
              ⠿
            </div>
            <button
              title="Löschen"
              onClick={deleteElement}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '11px', padding: '3px 4px', borderRadius: '3px', lineHeight: 1, fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent2)'; e.currentTarget.style.background = '#fff0f2' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Section-level delete — top right */}
        {editable && (
          <button
            title="Block löschen"
            onClick={() => deleteNode()}
            className="wiki-section-delete"
            style={{
              position: 'absolute', top: 8, right: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: '11px', padding: '3px 6px',
              borderRadius: '4px', fontFamily: 'inherit', lineHeight: 1,
            }}
          >
            Block ✕
          </button>
        )}

        <NodeViewContent />

        {/* Element picker */}
        {editable && (
          <div style={{ position: 'relative', marginTop: '12px' }} ref={pickerRef}>
            <button
              onClick={() => setPickerOpen(p => !p)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '4px 10px', background: 'none',
                border: '1px dashed var(--border)', borderRadius: '6px',
                color: 'var(--muted)', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span>
              Element
            </button>

            {pickerOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '8px',
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px',
                zIndex: 200, width: '300px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}>
                {ELEMENTS.map(el => (
                  <button
                    key={el.key}
                    onClick={() => addElement(el.key)}
                    style={{
                      padding: '8px 10px', background: 'none',
                      border: '1px solid transparent', borderRadius: '6px',
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      display: 'flex', flexDirection: 'column', gap: '2px',
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
                  autoFocus value={imageUrl}
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

      <style>{`
        .wiki-section-delete { opacity: 0; transition: opacity 0.1s; }
        [data-node-view-wrapper]:hover .wiki-section-delete { opacity: 1; }
        .wiki-section-delete:hover { color: var(--accent2) !important; background: #fff0f2 !important; }
      `}</style>
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
