'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Fragment } from '@tiptap/pm/model'
import type { Node as PMNode } from '@tiptap/pm/model'
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
  top: number
  height: number
  childPos: number
  childSize: number
  childIdx: number
}

interface ElBound { top: number; bottom: number; mid: number }

interface DragState {
  childIdx: number
  childPos: number
  childSize: number
  dropIdx: number
  elBounds: ElBound[]
}

function SectionView({ editor, node, getPos, deleteNode }: NodeViewProps) {
  const [handle, setHandle] = useState<HandleInfo | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [imageMode, setImageMode] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<(DragState & { cardTop: number }) | null>(null)

  useEffect(() => () => {
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as HTMLElement)) {
        setPickerOpen(false)
      }
    }
    if (pickerOpen) document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [pickerOpen])

  function calcElBounds(sectionPos: number, cardTop: number): ElBound[] {
    const sectionNode = editor.state.doc.nodeAt(sectionPos)
    if (!sectionNode) return []
    const bounds: ElBound[] = []
    let offset = sectionPos + 1
    for (let i = 0; i < sectionNode.childCount; i++) {
      const child = sectionNode.child(i)
      try {
        let topY: number, bottomY: number
        if (child.isLeaf) {
          const c = editor.view.coordsAtPos(offset, 1)
          topY = c.top; bottomY = c.bottom
        } else {
          topY    = editor.view.coordsAtPos(offset + 1).top
          bottomY = editor.view.coordsAtPos(offset + child.nodeSize - 1).bottom
        }
        bounds.push({ top: topY - cardTop, bottom: bottomY - cardTop, mid: (topY + bottomY) / 2 - cardTop })
      } catch {
        bounds.push({ top: 0, bottom: 0, mid: 0 })
      }
      offset += child.nodeSize
    }
    return bounds
  }

  function onMouseMove(e: React.MouseEvent) {
    if (dragRef.current) return
    if (!cardRef.current || !editor.isEditable || typeof getPos !== 'function') return
    const cardRect = cardRef.current.getBoundingClientRect()
    const sectionPos = getPos()
    if (sectionPos === undefined) return

    const sectionNode = editor.state.doc.nodeAt(sectionPos)
    if (!sectionNode) return

    let offset = sectionPos + 1
    for (let i = 0; i < sectionNode.childCount; i++) {
      const child = sectionNode.child(i)
      let topY: number, bottomY: number
      try {
        if (child.isLeaf) {
          const c = editor.view.coordsAtPos(offset, 1)
          topY = c.top; bottomY = c.bottom
        } else {
          topY    = editor.view.coordsAtPos(offset + 1).top
          bottomY = editor.view.coordsAtPos(offset + child.nodeSize - 1).bottom
        }
      } catch { offset += child.nodeSize; continue }

      if (e.clientY >= topY - 4 && e.clientY <= bottomY + 4) {
        setHandle({ top: topY - cardRect.top, height: bottomY - topY, childPos: offset, childSize: child.nodeSize, childIdx: i })
        return
      }
      offset += child.nodeSize
    }
    setHandle(null)
  }

  function startDrag(e: React.MouseEvent) {
    if (!handle || !cardRef.current || typeof getPos !== 'function') return
    e.preventDefault()
    e.stopPropagation()

    const cardRect = cardRef.current.getBoundingClientRect()
    const sectionPos = getPos()
    if (sectionPos === undefined) return

    const elBounds = calcElBounds(sectionPos, cardRect.top)
    const initial: DragState & { cardTop: number } = {
      childIdx: handle.childIdx,
      childPos: handle.childPos,
      childSize: handle.childSize,
      dropIdx: handle.childIdx,
      elBounds,
      cardTop: cardRect.top,
    }
    dragRef.current = initial
    setDrag(initial)
    setHandle(null)

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return
      const relY = ev.clientY - dragRef.current.cardTop
      let dropIdx = 0
      for (let i = 0; i < dragRef.current.elBounds.length; i++) {
        if (relY >= dragRef.current.elBounds[i].mid) dropIdx = i + 1
      }
      dragRef.current = { ...dragRef.current, dropIdx }
      setDrag({ ...dragRef.current })
    }

    function onUp() {
      if (dragRef.current) {
        const { childIdx, childPos, childSize, dropIdx } = dragRef.current
        moveElement(childIdx, childPos, childSize, dropIdx)
      }
      dragRef.current = null
      setDrag(null)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function moveElement(fromIdx: number, _fromPos: number, _fromSize: number, toInsertIdx: number) {
    if (!editor || typeof getPos !== 'function') return
    if (fromIdx === toInsertIdx || fromIdx + 1 === toInsertIdx) return
    const sectionPos = getPos()
    if (sectionPos === undefined) return
    const sectionNode = editor.state.doc.nodeAt(sectionPos)
    if (!sectionNode) return

    const children: PMNode[] = []
    for (let i = 0; i < sectionNode.childCount; i++) children.push(sectionNode.child(i))

    const [moved] = children.splice(fromIdx, 1)
    const adjustedIdx = toInsertIdx > fromIdx ? toInsertIdx - 1 : toInsertIdx
    children.splice(adjustedIdx, 0, moved)

    const tr = editor.state.tr
    tr.replaceWith(sectionPos + 1, sectionPos + sectionNode.nodeSize - 1, Fragment.from(children))
    editor.view.dispatch(tr)
  }

  function deleteElement() {
    if (!handle || !editor) return
    const { childPos, childSize } = handle
    const $pos = editor.state.doc.resolve(childPos)
    const parent = $pos.parent
    if (parent.type.name === 'section' && parent.childCount === 1) {
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

  // Drop line Y position (relative to card)
  const dropLineY = (() => {
    if (!drag) return 0
    const { dropIdx, elBounds } = drag
    if (!elBounds.length) return 0
    if (dropIdx === 0) return elBounds[0].top
    if (dropIdx >= elBounds.length) return elBounds[elBounds.length - 1].bottom
    return (elBounds[dropIdx - 1].bottom + elBounds[dropIdx].top) / 2
  })()

  const showDropLine = drag !== null
    && drag.dropIdx !== drag.childIdx
    && drag.dropIdx !== drag.childIdx + 1

  return (
    <NodeViewWrapper style={{ margin: '0 0 12px' }}>
      <div
        ref={cardRef}
        onMouseMove={onMouseMove}
        onMouseLeave={() => { if (!dragRef.current) setHandle(null) }}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px 28px 16px 44px',
          position: 'relative',
          outline: 'none',
          cursor: drag ? 'grabbing' : undefined,
        }}
      >
        {/* Drag: frame around the element being dragged */}
        {editable && drag && drag.elBounds[drag.childIdx] && (
          <div style={{
            position: 'absolute',
            left: 4, right: 4,
            top: drag.elBounds[drag.childIdx].top - 3,
            height: drag.elBounds[drag.childIdx].bottom - drag.elBounds[drag.childIdx].top + 6,
            borderRadius: '6px',
            boxShadow: 'inset 0 0 0 1.5px var(--accent)',
            background: 'rgba(99,102,241,0.04)',
            pointerEvents: 'none',
            zIndex: 2,
          }} />
        )}

        {/* Drag: drop indicator line */}
        {editable && showDropLine && (
          <div style={{
            position: 'absolute',
            left: 44, right: 4,
            top: dropLineY - 1,
            height: 2,
            background: 'var(--accent)',
            borderRadius: '1px',
            pointerEvents: 'none',
            zIndex: 15,
          }}>
            <div style={{
              position: 'absolute',
              left: -4, top: -3,
              width: 8, height: 8,
              borderRadius: '50%',
              background: 'var(--accent)',
            }} />
          </div>
        )}

        {/* Handle buttons: ⠿ drag + ✕ delete — no frame on hover */}
        {editable && handle && !drag && (
          <div style={{
            position: 'absolute',
            left: 4, top: handle.top, height: handle.height,
            display: 'flex', alignItems: 'center', gap: '1px', zIndex: 10,
          }}>
            <div
              title="Verschieben"
              onMouseDown={startDrag}
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
