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
  const dragRef    = useRef<(DragState & { cardTop: number }) | null>(null)
  const ghostRef   = useRef<HTMLElement | null>(null)
  const origElRef  = useRef<HTMLElement | null>(null)
  const ghostOffY  = useRef<number>(0)
  const siblingsRef = useRef<HTMLElement[]>([])
  const ghostHRef   = useRef<number>(0)
  const cardTopRef  = useRef<number>(0)
  const slotRef     = useRef<HTMLElement | null>(null)

  function resetDragStyles() {
    if (ghostRef.current) { ghostRef.current.parentNode?.removeChild(ghostRef.current); ghostRef.current = null }
    if (slotRef.current)  { slotRef.current.parentNode?.removeChild(slotRef.current);  slotRef.current  = null }
    if (origElRef.current) {
      const el = origElRef.current
      el.style.position = ''; el.style.top = ''; el.style.left = ''
      el.style.width = ''; el.style.opacity = ''; el.style.pointerEvents = ''
      el.style.zIndex = ''
      origElRef.current = null
    }
    siblingsRef.current.forEach(el => { el.style.transition = ''; el.style.transform = '' })
    siblingsRef.current = []
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }

  useEffect(() => () => { resetDragStyles() }, [])

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

    // Use nodeDOM to get reliable PM-index-matched DOM elements (avoids decoration mismatches)
    const sectionNode = editor.state.doc.nodeAt(sectionPos)
    const siblings: HTMLElement[] = []
    if (sectionNode) {
      let off = sectionPos + 1
      for (let i = 0; i < sectionNode.childCount; i++) {
        const el = editor.view.nodeDOM(off) as HTMLElement | null
        siblings.push(el as HTMLElement)
        off += sectionNode.child(i).nodeSize
      }
    }
    const origEl = siblings[handle.childIdx] as HTMLElement | undefined

    if (origEl && cardRef.current) {
      const rect    = origEl.getBoundingClientRect()
      const cardRect2 = cardRef.current.getBoundingClientRect()
      cardTopRef.current = cardRect2.top

      // Slot height: distance to next sibling's top (includes gap), or own height
      const nextEl = siblings[handle.childIdx + 1]
      ghostHRef.current = nextEl
        ? nextEl.getBoundingClientRect().top - rect.top
        : rect.height
      siblingsRef.current = siblings.filter(Boolean) as HTMLElement[]

      // Transitions on siblings (not the dragged element)
      siblingsRef.current.forEach((el, i) => {
        if (i !== handle.childIdx) el.style.transition = 'transform 0.18s cubic-bezier(0.2,0,0,1)'
      })

      // Ghost: absolute inside card → inherits CSS variables, fonts, colors
      const ghost = document.createElement('div')
      ghost.style.cssText = [
        `position:absolute`,
        `left:${rect.left - cardRect2.left}px`,
        `top:${rect.top - cardRect2.top}px`,
        `width:${rect.width}px`,
        `background:var(--surface)`,
        `border-radius:10px`,
        `box-shadow:0 16px 48px rgba(0,0,0,0.24),0 0 0 1px var(--border)`,
        `transform:scale(1.02)`,
        `opacity:0.96`,
        `pointer-events:none`,
        `z-index:9999`,
      ].join(';')
      ghost.appendChild(origEl.cloneNode(true))
      cardRef.current.appendChild(ghost)

      ghostRef.current = ghost
      ghostOffY.current = e.clientY - rect.top
      origElRef.current = origEl

      // FLIP: record positions BEFORE origEl leaves flow
      const firstTops = siblings.map(el => el ? el.getBoundingClientRect().top : 0)

      // Pull origEl out of flow → siblings fill the gap immediately via CSS reflow
      origEl.style.position = 'absolute'
      origEl.style.top = `${rect.top - cardRect2.top}px`
      origEl.style.left = `${rect.left - cardRect2.left}px`
      origEl.style.width = `${rect.width}px`
      origEl.style.opacity = '0'
      origEl.style.pointerEvents = 'none'
      origEl.style.zIndex = '-1'

      // Read positions AFTER reflow (getBoundingClientRect forces it)
      const lastTops = siblings.map(el => el ? el.getBoundingClientRect().top : 0)

      // Invert: freeze visual positions instantly (no transition)
      siblings.forEach((el, i) => {
        if (!el || i === handle.childIdx) return
        const delta = firstTops[i] - lastTops[i]
        el.style.transition = 'none'
        el.style.transform = delta ? `translateY(${delta}px)` : 'translateY(0)'
      })

      // Play: animate to gap-at-origin state (dropIdx = fromIdx initially)
      const fromIdxForPlay = handle.childIdx
      const ghHForPlay = ghostHRef.current
      requestAnimationFrame(() => {
        siblings.forEach((el, i) => {
          if (!el || i === fromIdxForPlay) return
          el.style.transition = 'transform 0.18s cubic-bezier(0.2,0,0,1)'
          el.style.transform = i >= fromIdxForPlay ? `translateY(${ghHForPlay}px)` : 'translateY(0)'
        })
      })

      // Slot indicator: shows landing zone, animates to follow dropIdx
      const slot = document.createElement('div')
      const slotLeft = rect.left - cardRect2.left
      const slotRight = cardRect2.right - rect.right
      slot.style.cssText = [
        `position:absolute`,
        `left:${slotLeft}px`,
        `right:${slotRight}px`,
        `top:${rect.top - cardRect2.top}px`,
        `height:${ghostHRef.current}px`,
        `border-radius:8px`,
        `background:rgba(0,153,85,0.06)`,
        `border:1.5px solid rgba(0,153,85,0.3)`,
        `pointer-events:none`,
        `z-index:8`,
        `transition:top 0.18s cubic-bezier(0.2,0,0,1)`,
      ].join(';')
      cardRef.current.appendChild(slot)
      slotRef.current = slot
    }

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
      if (ghostRef.current) {
        // Position ghost relative to card (absolute inside card)
        ghostRef.current.style.top = `${ev.clientY - ghostOffY.current - cardTopRef.current}px`
      }

      const fromIdx = dragRef.current.childIdx
      const relY = ev.clientY - dragRef.current.cardTop
      let dropIdx = 0
      for (let i = 0; i < dragRef.current.elBounds.length; i++) {
        if (relY >= dragRef.current.elBounds[i].mid) dropIdx = i + 1
      }
      dragRef.current.dropIdx = dropIdx

      // Shift siblings: origEl is out of flow, so all elements >= dropIdx shift down by ghH
      // to open a gap at the drop position; elements below dropIdx stay at natural (gap closed)
      const ghH = ghostHRef.current
      siblingsRef.current.forEach((el, i) => {
        if (i === fromIdx) return
        el.style.transform = i >= dropIdx ? `translateY(${ghH}px)` : 'translateY(0)'
      })

      // Animate slot indicator to the landing zone
      if (slotRef.current) {
        const bounds = dragRef.current.elBounds
        let slotTop: number
        if (dropIdx === fromIdx || dropIdx === fromIdx + 1) {
          slotTop = bounds[fromIdx]?.top ?? 0
        } else if (dropIdx < fromIdx) {
          slotTop = bounds[dropIdx]?.top ?? 0
        } else {
          // dropIdx > fromIdx + 1: gap opens after the last shifted element
          const prev = bounds[dropIdx - 1]
          slotTop = prev ? prev.bottom - ghH : (bounds[fromIdx]?.top ?? 0)
        }
        slotRef.current.style.top = `${slotTop}px`
      }
    }

    function onUp() {
      const saved = dragRef.current ? { ...dragRef.current } : null
      dragRef.current = null
      resetDragStyles()
      setDrag(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (saved) moveElement(saved.childIdx, saved.childPos, saved.childSize, saved.dropIdx)
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
