'use client'

/* eslint-disable react-hooks/immutability */
import { Node, mergeAttributes, Editor } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Fragment } from '@tiptap/pm/model'
import type { Node as PMNode } from '@tiptap/pm/model'
import { useId, useState, useRef, useEffect } from 'react'

// ── Module-level section selection store ──────────────────────────────────────
const _selSet = new Set<string>()
const _selCbs = new Set<() => void>()
let _selDragging = false
function _fireSel() { _selCbs.forEach(f => f()) }

const sectionSel = {
  has:      (id: string) => _selSet.has(id),
  size:     () => _selSet.size,
  ids:      () => new Set(_selSet),
  dragging: () => _selDragging,
  add:      (id: string) => { if (!_selSet.has(id)) { _selSet.add(id); _fireSel() } },
  setExact: (ids: string[]) => { _selSet.clear(); ids.forEach(id => _selSet.add(id)); _fireSel() },
  toggle:   (id: string, additive: boolean) => {
    if (!additive) {
      const onlyThis = _selSet.size === 1 && _selSet.has(id)
      _selSet.clear()
      if (!onlyThis) _selSet.add(id)
    } else {
      if (_selSet.has(id)) _selSet.delete(id)
      else _selSet.add(id)
    }
    _fireSel()
  },
  clear:    () => { if (_selSet.size > 0) { _selSet.clear(); _fireSel() } },
  setDrag:  (v: boolean) => { _selDragging = v; _fireSel() },
  sub:      (fn: () => void) => { _selCbs.add(fn); return () => _selCbs.delete(fn) },
}

let _activeEditor: Editor | null = null
let _sectionClipboard: PMNode[] = []
let _elementClipboard: PMNode | null = null

// ── Canvas snap helpers ────────────────────────────────────────────────────────
interface SnapLine { axis: 'x' | 'y'; pos: number; from: number; to: number }
let _snapLineEls: HTMLElement[] = []
const MIN_SECTION_W = 180
const MIN_SECTION_H = 96
const MAX_AUTO_SECTION_W = 960
function _canvasZoom(canvas: HTMLElement) {
  const raw = canvas.dataset.editorZoom
  const zoom = raw ? Number(raw) : 1
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1
}
function _clearSnapLines() {
  _snapLineEls.forEach(el => el.parentNode?.removeChild(el))
  _snapLineEls = []
}
function _showSnapLines(canvas: HTMLElement, lines: SnapLine[]) {
  _clearSnapLines()
  lines.forEach(line => {
    const el = document.createElement('div')
    const isX = line.axis === 'x'
    el.style.cssText = `position:absolute;pointer-events:none;z-index:9998;background:var(--accent);${
      isX
        ? `left:${line.pos}px;top:${line.from}px;width:1px;height:${line.to - line.from}px`
        : `top:${line.pos}px;left:${line.from}px;height:1px;width:${line.to - line.from}px`
    }`
    canvas.appendChild(el)
    _snapLineEls.push(el)
  })
}
function _computeSnap(canvas: HTMLElement, selfId: string, x: number, y: number, w: number, h: number): { x: number; y: number; lines: SnapLine[] } {
  const T = 8
  const cr = canvas.getBoundingClientRect()
  const zoom = _canvasZoom(canvas)
  let sx = x, sy = y
  const lines: SnapLine[] = []
  const myR = x + w, myB = y + h
  canvas.querySelectorAll<HTMLElement>('[data-section-card]').forEach(card => {
    if (card.dataset.sectionId === selfId) return
    const wr = (card.parentElement as HTMLElement).getBoundingClientRect()
    const oL = (wr.left - cr.left) / zoom, oR = (wr.right  - cr.left) / zoom
    const oT = (wr.top  - cr.top) / zoom,  oB = (wr.bottom - cr.top) / zoom
    const ext = (a: number, b: number, c: number, d: number) => ({ from: Math.min(a, c) - 20, to: Math.max(b, d) + 20 })
    if      (Math.abs(x   - oL) < T) { sx = oL;     lines.push({ axis: 'x', pos: oL, ...ext(y, myB, oT, oB) }) }
    else if (Math.abs(x   - oR) < T) { sx = oR;     lines.push({ axis: 'x', pos: oR, ...ext(y, myB, oT, oB) }) }
    else if (Math.abs(myR - oR) < T) { sx = oR - w; lines.push({ axis: 'x', pos: oR, ...ext(y, myB, oT, oB) }) }
    else if (Math.abs(myR - oL) < T) { sx = oL - w; lines.push({ axis: 'x', pos: oL, ...ext(y, myB, oT, oB) }) }
    if      (Math.abs(y   - oT) < T) { sy = oT;     lines.push({ axis: 'y', pos: oT, ...ext(x, myR, oL, oR) }) }
    else if (Math.abs(y   - oB) < T) { sy = oB;     lines.push({ axis: 'y', pos: oB, ...ext(x, myR, oL, oR) }) }
    else if (Math.abs(myB - oT) < T) { sy = oT - h; lines.push({ axis: 'y', pos: oT, ...ext(x, myR, oL, oR) }) }
    else if (Math.abs(myB - oB) < T) { sy = oB - h; lines.push({ axis: 'y', pos: oB, ...ext(x, myR, oL, oR) }) }
  })
  return { x: sx, y: sy, lines }
}

function _computeResizeSnap(canvas: HTMLElement, selfId: string, dir: string, x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number; lines: SnapLine[] } {
  const T = 8
  const cr = canvas.getBoundingClientRect()
  const zoom = _canvasZoom(canvas)
  let sx = x, sy = y, sw = w, sh = h
  const lines: SnapLine[] = []
  const right = () => sx + sw
  const bottom = () => sy + sh
  canvas.querySelectorAll<HTMLElement>('[data-section-card]').forEach(card => {
    if (card.dataset.sectionId === selfId) return
    const wr = (card.parentElement as HTMLElement).getBoundingClientRect()
    const oL = (wr.left - cr.left) / zoom, oR = (wr.right - cr.left) / zoom
    const oT = (wr.top - cr.top) / zoom, oB = (wr.bottom - cr.top) / zoom
    const yExt = (pos: number) => ({ axis: 'x' as const, pos, from: Math.min(sy, oT) - 20, to: Math.max(bottom(), oB) + 20 })
    const xExt = (pos: number) => ({ axis: 'y' as const, pos, from: Math.min(sx, oL) - 20, to: Math.max(right(), oR) + 20 })
    ;[oL, oR].some(edge => {
      if (dir.includes('e') && Math.abs(right() - edge) < T) {
        sw = Math.max(MIN_SECTION_W, edge - sx)
        lines.push(yExt(edge))
        return true
      }
      if (dir.includes('w') && Math.abs(sx - edge) < T) {
        const fixedRight = right()
        sx = Math.min(edge, fixedRight - MIN_SECTION_W)
        sw = fixedRight - sx
        lines.push(yExt(edge))
        return true
      }
      return false
    })
    ;[oT, oB].some(edge => {
      if (dir.includes('s') && Math.abs(bottom() - edge) < T) {
        sh = Math.max(MIN_SECTION_H, edge - sy)
        lines.push(xExt(edge))
        return true
      }
      if (dir.includes('n') && Math.abs(sy - edge) < T) {
        const fixedBottom = bottom()
        sy = Math.min(edge, fixedBottom - MIN_SECTION_H)
        sh = fixedBottom - sy
        lines.push(xExt(edge))
        return true
      }
      return false
    })
  })
  return { x: sx, y: sy, w: sw, h: sh, lines }
}

function _fitCanvasToSections(canvas: HTMLElement) {
  let maxBottom = 4000
  const zoom = _canvasZoom(canvas)
  canvas.querySelectorAll<HTMLElement>('[data-section-card]').forEach(card => {
    const wrap = card.parentElement as HTMLElement | null
    if (!wrap) return
    const y = parseFloat(wrap.style.top || '0')
    const h = wrap.getBoundingClientRect().height / zoom
    if (Number.isFinite(y) && Number.isFinite(h)) maxBottom = Math.max(maxBottom, y + h + 48)
  })
  canvas.style.minHeight = `${Math.ceil(maxBottom)}px`
}

let _globalHandlersInstalled = false
function _ensureGlobalHandlers() {
  if (_globalHandlersInstalled) return
  _globalHandlersInstalled = true

  // Deselect blocks on click outside any drag handle
  document.addEventListener('mousedown', (e) => {
    if (_selSet.size === 0) return
    if ((e.target as Element).closest('[data-section-drag-handle]')) return
    if ((e.target as Element).closest('[data-element-palette]')) return
    sectionSel.clear()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { sectionSel.clear(); return }

    if ((e.key === 'Delete' || e.key === 'Backspace') && _selSet.size > 0) {
      if (window.getSelection()?.type === 'Range') return
      e.preventDefault()
      const doc = _activeEditor!.state.doc
      const tr = _activeEditor!.state.tr
      const toDelete: { pos: number; size: number }[] = []
      doc.forEach((node: PMNode, offset: number) => {
        if (node.type.name !== 'section') return
        const dom = _activeEditor!.view.nodeDOM(offset) as HTMLElement | null
        const id = (dom?.querySelector('[data-section-card]') as HTMLElement | null)?.dataset.sectionId
        if (id && _selSet.has(id)) toDelete.push({ pos: offset, size: node.nodeSize })
      })
      toDelete.reverse().forEach(({ pos, size }) => {
        const mapped = tr.mapping.map(pos)
        tr.delete(mapped, mapped + size)
      })
      _activeEditor!.view.dispatch(tr)
      sectionSel.clear()
      return
    }

    const ctrl = e.ctrlKey || e.metaKey
    if (!ctrl) return

    if (e.key === 'z' || e.key === 'y') {
      if (_activeEditor?.view.hasFocus()) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); _activeEditor?.commands.undo(); return }
      if (e.key === 'y' || e.shiftKey) { e.preventDefault(); _activeEditor?.commands.redo(); return }
    }

    // Ctrl+C / Ctrl+X: copy or cut selected sections (always takes priority when blocks are selected)
    if ((e.key === 'c' || e.key === 'x') && _selSet.size > 0) {
      e.preventDefault()
      const nodes: PMNode[] = []
      _activeEditor?.state.doc.forEach((node: PMNode, offset: number) => {
        if (node.type.name !== 'section') return
        const dom = _activeEditor!.view.nodeDOM(offset) as HTMLElement | null
        const id = (dom?.querySelector('[data-section-card]') as HTMLElement | null)?.dataset.sectionId
        if (id && _selSet.has(id)) nodes.push(node)
      })
      _sectionClipboard = nodes
      _elementClipboard = null

      if (e.key === 'x') {
        const doc = _activeEditor!.state.doc
        const tr = _activeEditor!.state.tr
        const toDelete: { pos: number; size: number }[] = []
        doc.forEach((node: PMNode, offset: number) => {
          if (node.type.name !== 'section') return
          const dom = _activeEditor!.view.nodeDOM(offset) as HTMLElement | null
          const id = (dom?.querySelector('[data-section-card]') as HTMLElement | null)?.dataset.sectionId
          if (id && _selSet.has(id)) toDelete.push({ pos: offset, size: node.nodeSize })
        })
        // Delete from end to start so positions remain valid
        toDelete.reverse().forEach(({ pos, size }) => {
          const mapped = tr.mapping.map(pos)
          tr.delete(mapped, mapped + size)
        })
        _activeEditor!.view.dispatch(tr)
        sectionSel.clear()
      }
    }

    // Ctrl+V: paste section clipboard (only when no text is selected in the editor)
    if (e.key === 'v' && _sectionClipboard.length > 0) {
      const textSelected = !!window.getSelection()?.toString()
      if (textSelected) return  // let browser handle text paste
      const ed = _activeEditor
      if (!ed) return
      const { from } = ed.state.selection
      let pastePos = ed.state.doc.content.size
      try {
        const $from = ed.state.doc.resolve(from)
        for (let d = $from.depth; d >= 0; d--) {
          if ($from.node(d).type.name === 'section') { pastePos = $from.after(d); break }
        }
      } catch { /* ignore */ }
      e.preventDefault()
      const tr = ed.state.tr
      _sectionClipboard.forEach(n => tr.insert(tr.mapping.map(pastePos), n.copy(n.content)))
      ed.view.dispatch(tr)
    }
  })
}
// ─────────────────────────────────────────────────────────────────────────────

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

interface DragRefState {
  childIdx: number
  childPos: number
  childSize: number
  dropIdx: number
  elBounds: ElBound[]
  cardTop: number
  sourceSectionPos: number
  targetSectionPos: number
  targetDropIdx: number
  targetIsNewBlock: boolean
  slotLeft: number
  slotRight: number
}

function SectionView({ editor, node, getPos, deleteNode }: NodeViewProps) {
  const sectionId = useId()
  const [isSelected, setIsSelected] = useState(false)
  const [handle, setHandle] = useState<HandleInfo | null>(null)
  const [dragging, setDragging] = useState(false)
  const [sectionDragging, setSectionDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [activeResizeDir, setActiveResizeDir] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [imageMode, setImageMode] = useState(false)
  const [elementDropTarget, setElementDropTarget] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragRefState | null>(null)
  const ghostRef = useRef<HTMLElement | null>(null)
  const origElRef = useRef<HTMLElement | null>(null)
  const ghostOffY = useRef<number>(0)
  const siblingsRef = useRef<HTMLElement[]>([])
  const ghostHRef = useRef<number>(0)
  const cardTopRef = useRef<number>(0)
  const slotRef = useRef<HTMLElement | null>(null)
  const crossSlotRef = useRef<HTMLElement | null>(null)

  function resetDragStyles() {
    if (ghostRef.current) { ghostRef.current.parentNode?.removeChild(ghostRef.current); ghostRef.current = null }
    if (slotRef.current) { slotRef.current.parentNode?.removeChild(slotRef.current); slotRef.current = null }
    if (crossSlotRef.current) { crossSlotRef.current.parentNode?.removeChild(crossSlotRef.current); crossSlotRef.current = null }
    if (origElRef.current) {
      const el = origElRef.current
      el.style.position = ''; el.style.top = ''; el.style.left = ''
      el.style.width = ''; el.style.opacity = ''; el.style.pointerEvents = ''
      el.style.zIndex = ''
      origElRef.current = null
    }
    siblingsRef.current.forEach(el => { el.style.transition = ''; el.style.transform = '' })
    siblingsRef.current = []
    // Reset "Neuer Block" button highlight
    const newBlockBtn = document.querySelector('[data-new-block-btn]') as HTMLElement | null
    if (newBlockBtn) {
      newBlockBtn.style.borderColor = ''
      newBlockBtn.style.background = ''
      newBlockBtn.style.color = ''
    }
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }

  useEffect(() => () => { resetDragStyles() }, [])

  useEffect(() => {
    _ensureGlobalHandlers()
    _activeEditor = editor as unknown as Editor
    const unsub = sectionSel.sub(() => {
      setIsSelected(sectionSel.has(sectionId))
      if (!sectionSel.has(sectionId) || !sectionSel.dragging()) setSectionDragging(false)
    })
    return () => { unsub() }
  }, [sectionId, editor])

  // Element copy/cut/paste via Ctrl+C/X/V when element handle is visible
  useEffect(() => {
    if (!handle) return
    function onKey(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      if (window.getSelection()?.toString()) return
      if (_selSet.size > 0) return  // section clipboard takes priority

      const sectionPos = typeof getPos === 'function' ? getPos() : undefined
      if (sectionPos === undefined) return
      const sectionNode = editor.state.doc.nodeAt(sectionPos)
      if (!sectionNode || !handle) return

      if (e.key === 'c') {
        e.preventDefault()
        _elementClipboard = sectionNode.child(handle.childIdx)
        _sectionClipboard = []
      }

      if (e.key === 'x') {
        e.preventDefault()
        _elementClipboard = sectionNode.child(handle.childIdx)
        _sectionClipboard = []
        const children: PMNode[] = []
        for (let i = 0; i < sectionNode.childCount; i++) {
          if (i !== handle.childIdx) children.push(sectionNode.child(i))
        }
        const content = children.length > 0
          ? Fragment.from(children)
          : Fragment.from(editor.state.schema.nodes.paragraph.create())
        const tr = editor.state.tr
        tr.replaceWith(sectionPos + 1, sectionPos + sectionNode.nodeSize - 1, content)
        editor.view.dispatch(tr)
      }

      if (e.key === 'v' && _elementClipboard) {
        e.preventDefault()
        const children: PMNode[] = []
        for (let i = 0; i < sectionNode.childCount; i++) {
          children.push(sectionNode.child(i))
          if (i === handle.childIdx) children.push(_elementClipboard.copy(_elementClipboard.content))
        }
        const tr = editor.state.tr
        tr.replaceWith(sectionPos + 1, sectionPos + sectionNode.nodeSize - 1, Fragment.from(children))
        editor.view.dispatch(tr)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [handle, getPos, editor])

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
    if (resizing) return
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

    let slotLeft = 0, slotRight = 0

    if (origEl && cardRef.current) {
      const rect      = origEl.getBoundingClientRect()
      const cardRect2 = cardRef.current.getBoundingClientRect()
      cardTopRef.current = cardRect2.top

      slotLeft  = rect.left - cardRect2.left
      slotRight = cardRect2.right - rect.right

      const nextEl = siblings[handle.childIdx + 1]
      ghostHRef.current = nextEl
        ? nextEl.getBoundingClientRect().top - rect.top
        : rect.height
      siblingsRef.current = siblings.filter(Boolean) as HTMLElement[]

      siblingsRef.current.forEach((el, i) => {
        if (i !== handle.childIdx) el.style.transition = 'transform 0.18s cubic-bezier(0.2,0,0,1)'
      })

      // Ghost: fixed on body so it never covers origEl inside the card
      const ghost = document.createElement('div')
      ghost.style.cssText = [
        `position:fixed`,
        `left:${rect.left}px`,
        `top:${rect.top}px`,
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
      document.body.appendChild(ghost)

      ghostRef.current = ghost
      ghostOffY.current = e.clientY - rect.top
      origElRef.current = origEl

      // Fade origEl in place — stays in flow, no position change
      origEl.style.opacity     = '0.08'
      origEl.style.pointerEvents = 'none'

      // Source slot indicator (hidden until user moves to a different target)
      const slot = document.createElement('div')
      slot.style.cssText = [
        `position:absolute`,
        `left:${slotLeft}px`,
        `right:${slotRight}px`,
        `height:${ghostHRef.current}px`,
        `border-radius:8px`,
        `background:rgba(0,153,85,0.05)`,
        `border:2px dashed rgba(0,153,85,0.4)`,
        `pointer-events:none`,
        `z-index:8`,
        `transition:top 0.18s cubic-bezier(0.2,0,0,1)`,
        `box-sizing:border-box`,
        `display:none`,
      ].join(';')
      cardRef.current.appendChild(slot)
      slotRef.current = slot
    }

    dragRef.current = {
      childIdx: handle.childIdx,
      childPos: handle.childPos,
      childSize: handle.childSize,
      dropIdx: handle.childIdx,
      elBounds,
      cardTop: cardRect.top,
      sourceSectionPos: sectionPos,
      targetSectionPos: sectionPos,
      targetDropIdx: handle.childIdx,
      targetIsNewBlock: false,
      slotLeft,
      slotRight,
    }
    setDragging(true)
    setHandle(null)

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'

    function onMove(ev: MouseEvent) {
      const d = dragRef.current
      if (!d) return

      // Ghost follows cursor in viewport coords (position:fixed on body)
      if (ghostRef.current) {
        ghostRef.current.style.top = `${ev.clientY - ghostOffY.current}px`
      }

      const fromIdx = d.childIdx
      const ghH     = ghostHRef.current

      // Check if cursor is over the "Neuer Block" drop target
      const newBlockBtn = document.querySelector('[data-new-block-btn]') as HTMLElement | null
      if (newBlockBtn) {
        const r = newBlockBtn.getBoundingClientRect()
        const isOver = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom
        if (isOver) {
          if (!d.targetIsNewBlock) {
            d.targetIsNewBlock = true
            // Highlight button as drop zone
            newBlockBtn.style.borderColor = 'var(--accent)'
            newBlockBtn.style.background  = 'rgba(0,153,85,0.08)'
            newBlockBtn.style.color       = 'var(--accent)'
            // Hide all slot indicators, close source gap
            if (slotRef.current) slotRef.current.style.display = 'none'
            if (crossSlotRef.current) { crossSlotRef.current.parentNode?.removeChild(crossSlotRef.current); crossSlotRef.current = null }
            siblingsRef.current.forEach((el, i) => { if (i !== fromIdx) el.style.transform = 'translateY(0)' })
          }
          return
        } else if (d.targetIsNewBlock) {
          // Left the button — reset highlight
          d.targetIsNewBlock = false
          newBlockBtn.style.borderColor = ''
          newBlockBtn.style.background  = ''
          newBlockBtn.style.color       = ''
          if (slotRef.current) slotRef.current.style.display = ''
        }
      }

      // Determine which section the cursor is over
      const posResult = editor.view.posAtCoords({ left: ev.clientX, top: ev.clientY })
      if (!posResult) return

      let cursorSectionPos: number | null = null
      try {
        const $cursor = editor.state.doc.resolve(posResult.pos)
        for (let depth = $cursor.depth; depth >= 0; depth--) {
          if ($cursor.node(depth).type.name === 'section') {
            cursorSectionPos = $cursor.before(depth)
            break
          }
        }
      } catch { return }

      if (cursorSectionPos === null) return

      if (cursorSectionPos === d.sourceSectionPos) {
        // ─── SAME SECTION ──────────────────────────────────────────────
        // Restore source slot, remove any cross-slot
        if (slotRef.current) slotRef.current.style.display = ''
        if (crossSlotRef.current) {
          crossSlotRef.current.parentNode?.removeChild(crossSlotRef.current)
          crossSlotRef.current = null
        }
        d.targetSectionPos = d.sourceSectionPos

        const relY = ev.clientY - d.cardTop
        let dropIdx = 0
        for (let i = 0; i < d.elBounds.length; i++) {
          if (relY >= d.elBounds[i].mid) dropIdx = i + 1
        }
        d.dropIdx       = dropIdx
        d.targetDropIdx = dropIdx

        // Shift siblings to open gap at dropIdx (origEl stays in flow, so only shift the range between source and target)
        siblingsRef.current.forEach((el, i) => {
          if (i === fromIdx) return
          let shift = 0
          if (dropIdx <= fromIdx) {
            if (i >= dropIdx && i < fromIdx) shift = ghH
          } else {
            if (i > fromIdx && i < dropIdx) shift = -ghH
          }
          el.style.transform = shift ? `translateY(${shift}px)` : 'translateY(0)'
        })

        // Move source slot to the landing zone
        if (slotRef.current) {
          const bounds = d.elBounds
          let slotTop: number
          if (dropIdx === fromIdx || dropIdx === fromIdx + 1) {
            slotTop = bounds[fromIdx]?.top ?? 0
          } else if (dropIdx < fromIdx) {
            slotTop = bounds[dropIdx]?.top ?? 0
          } else {
            const prev = bounds[dropIdx - 1]
            slotTop = prev ? prev.bottom - ghH : (bounds[fromIdx]?.top ?? 0)
          }
          slotRef.current.style.top = `${slotTop}px`
        }

      } else {
        // ─── CROSS SECTION ─────────────────────────────────────────────
        // Hide source slot, close source gap
        if (slotRef.current) slotRef.current.style.display = 'none'
        siblingsRef.current.forEach((el, i) => {
          if (i !== fromIdx) el.style.transform = 'translateY(0)'
        })

        d.targetSectionPos = cursorSectionPos

        // Find the target card DOM via the section's NodeViewWrapper
        const targetSectionDOM = editor.view.nodeDOM(cursorSectionPos) as HTMLElement | null
        const targetCardDiv    = targetSectionDOM?.querySelector('[data-section-card]') as HTMLElement | null
        if (!targetCardDiv) return

        // Create or re-create cross-slot when entering a new target card
        if (crossSlotRef.current?.parentElement !== targetCardDiv) {
          if (crossSlotRef.current) {
            crossSlotRef.current.parentNode?.removeChild(crossSlotRef.current)
            crossSlotRef.current = null
          }
          const xSlot = document.createElement('div')
          xSlot.style.cssText = [
            `position:absolute`,
            `left:${d.slotLeft}px`,
            `right:${d.slotRight}px`,
            `height:${ghH}px`,
            `border-radius:8px`,
            `background:rgba(0,153,85,0.05)`,
            `border:2px dashed rgba(0,153,85,0.4)`,
            `pointer-events:none`,
            `z-index:8`,
            `transition:top 0.18s cubic-bezier(0.2,0,0,1)`,
            `box-sizing:border-box`,
          ].join(';')
          targetCardDiv.appendChild(xSlot)
          crossSlotRef.current = xSlot
        }

        // Compute drop index in target section based on cursor Y
        const targetCardRect  = targetCardDiv.getBoundingClientRect()
        const targetElBounds  = calcElBounds(cursorSectionPos, targetCardRect.top)
        const relY            = ev.clientY - targetCardRect.top
        let targetDropIdx     = 0
        for (let i = 0; i < targetElBounds.length; i++) {
          if (relY >= targetElBounds[i].mid) targetDropIdx = i + 1
        }
        d.targetDropIdx = targetDropIdx

        // Position cross-slot at the landing zone in the target card
        let targetSlotTop: number
        if (targetDropIdx < targetElBounds.length) {
          targetSlotTop = targetElBounds[targetDropIdx].top
        } else if (targetElBounds.length > 0) {
          targetSlotTop = targetElBounds[targetElBounds.length - 1].bottom + 4
        } else {
          targetSlotTop = 0
        }
        if (crossSlotRef.current) crossSlotRef.current.style.top = `${targetSlotTop}px`
      }
    }

    function onUp() {
      const d = dragRef.current ? { ...dragRef.current } : null
      dragRef.current = null
      resetDragStyles()
      setDragging(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)

      if (!d) return

      if (d.targetIsNewBlock) {
        moveElementToNewSection(d.sourceSectionPos, d.childIdx)
      } else if (d.targetSectionPos === d.sourceSectionPos) {
        moveElement(d.childIdx, d.childPos, d.childSize, d.dropIdx)
      } else {
        moveElementCrossSection(d.sourceSectionPos, d.childIdx, d.targetSectionPos, d.targetDropIdx)
      }
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

  function moveElementCrossSection(
    sourceSectionPos: number,
    fromIdx: number,
    targetSectionPos: number,
    toInsertIdx: number
  ) {
    if (!editor) return

    const sourceNode = editor.state.doc.nodeAt(sourceSectionPos)
    const targetNode = editor.state.doc.nodeAt(targetSectionPos)
    if (!sourceNode || !targetNode) return

    const movedNode = sourceNode.child(fromIdx)

    // Build source content without the moved child
    const sourceChildren: PMNode[] = []
    for (let i = 0; i < sourceNode.childCount; i++) {
      if (i !== fromIdx) sourceChildren.push(sourceNode.child(i))
    }

    // Build target content with the moved child inserted at toInsertIdx
    const targetChildren: PMNode[] = []
    for (let i = 0; i < targetNode.childCount; i++) {
      if (i === toInsertIdx) targetChildren.push(movedNode)
      targetChildren.push(targetNode.child(i))
    }
    if (toInsertIdx >= targetNode.childCount) targetChildren.push(movedNode)

    const tr = editor.state.tr

    // Keep source section alive (section requires at least one block child)
    const sourceContent = sourceChildren.length > 0
      ? Fragment.from(sourceChildren)
      : Fragment.from(editor.state.schema.nodes.paragraph.create())

    tr.replaceWith(sourceSectionPos + 1, sourceSectionPos + sourceNode.nodeSize - 1, sourceContent)

    // Map target positions through the first operation's changes
    const mappedTargetStart = tr.mapping.map(targetSectionPos + 1)
    const mappedTargetEnd   = tr.mapping.map(targetSectionPos + targetNode.nodeSize - 1)
    tr.replaceWith(mappedTargetStart, mappedTargetEnd, Fragment.from(targetChildren))

    editor.view.dispatch(tr)
  }

  function moveElementToNewSection(sourceSectionPos: number, fromIdx: number) {
    if (!editor) return

    const sourceNode = editor.state.doc.nodeAt(sourceSectionPos)
    if (!sourceNode) return

    const movedNode = sourceNode.child(fromIdx)

    const sourceChildren: PMNode[] = []
    for (let i = 0; i < sourceNode.childCount; i++) {
      if (i !== fromIdx) sourceChildren.push(sourceNode.child(i))
    }

    const sourceContent = sourceChildren.length > 0
      ? Fragment.from(sourceChildren)
      : Fragment.from(editor.state.schema.nodes.paragraph.create())

    const newSection = editor.state.schema.nodes.section.create(null, Fragment.from(movedNode))

    const tr = editor.state.tr
    tr.replaceWith(sourceSectionPos + 1, sourceSectionPos + sourceNode.nodeSize - 1, sourceContent)
    tr.insert(tr.mapping.map(editor.state.doc.content.size), newSection)
    editor.view.dispatch(tr)
  }

  function moveSectionTo(targetIdx: number) {
    if (!editor || typeof getPos !== 'function') return
    const sectionPos = getPos()
    if (sectionPos === undefined) return

    const sectionPositions: number[] = []
    editor.state.doc.forEach((n, offset) => {
      if (n.type.name === 'section') sectionPositions.push(offset)
    })

    const currentIdx = sectionPositions.indexOf(sectionPos)
    if (currentIdx === -1 || targetIdx === currentIdx || targetIdx === currentIdx + 1) return

    const sections: PMNode[] = []
    editor.state.doc.forEach(n => { if (n.type.name === 'section') sections.push(n) })

    const [moved] = sections.splice(currentIdx, 1)
    sections.splice(targetIdx > currentIdx ? targetIdx - 1 : targetIdx, 0, moved)

    const tr = editor.state.tr
    tr.replaceWith(0, editor.state.doc.content.size, Fragment.from(sections))
    editor.view.dispatch(tr)
  }

  function moveSelectedSectionsTo(_draggedId: string, targetIdx: number) {
    if (!editor) return
    const allNodes: PMNode[] = []
    const selectedIndices = new Set<number>()
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name !== 'section') return
      const dom = editor.view.nodeDOM(offset) as HTMLElement | null
      const id = (dom?.querySelector('[data-section-card]') as HTMLElement | null)?.dataset.sectionId
      if (id && sectionSel.has(id)) selectedIndices.add(allNodes.length)
      allNodes.push(node)
    })

    const selected = allNodes.filter((_, i) => selectedIndices.has(i))
    const rest = allNodes.filter((_, i) => !selectedIndices.has(i))
    const selectedBefore = [...selectedIndices].filter(i => i < targetIdx).length
    const insertAt = Math.max(0, Math.min(targetIdx - selectedBefore, rest.length))
    rest.splice(insertAt, 0, ...selected)

    const tr = editor.state.tr
    tr.replaceWith(0, editor.state.doc.content.size, Fragment.from(rest))
    editor.view.dispatch(tr)
  }

  function duplicateSection() {
    if (!editor || typeof getPos !== 'function') return
    const sectionPos = getPos()
    if (sectionPos === undefined) return
    const sectionNode = editor.state.doc.nodeAt(sectionPos)
    if (!sectionNode) return
    const newAttrs = sectionNode.attrs.x !== null
      ? { ...sectionNode.attrs, x: (sectionNode.attrs.x as number) + 20, y: (sectionNode.attrs.y as number) + 20 }
      : sectionNode.attrs
    const copy = editor.state.schema.nodes.section.create(newAttrs, sectionNode.content)
    const tr = editor.state.tr
    tr.insert(editor.state.doc.content.size, copy)
    editor.view.dispatch(tr)
  }

  function handleSectionDragDown(e: React.MouseEvent) {
    startFreeMove(e)
  }

  function startFreeMove(e: React.MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const nativeEvent = e.nativeEvent
    let didDrag = false
    const downX = e.clientX, downY = e.clientY

    function onMM(ev: MouseEvent) {
      if (!didDrag && Math.hypot(ev.clientX - downX, ev.clientY - downY) > 4) {
        didDrag = true
        document.removeEventListener('mousemove', onMM)
        document.removeEventListener('mouseup',   onMU)
        beginDrag()
      }
    }
    function onMU() {
      document.removeEventListener('mousemove', onMM)
      document.removeEventListener('mouseup',   onMU)
      if (!didDrag) sectionSel.toggle(sectionId, nativeEvent.shiftKey)
    }
    document.addEventListener('mousemove', onMM)
    document.addEventListener('mouseup',   onMU)

    function beginDrag() {
      if (typeof getPos !== 'function') return
      const docPos  = getPos() as number
      const canvas  = document.querySelector('[data-editor-canvas]') as HTMLElement | null
      const maybeWrap = cardRef.current?.parentElement
      if (!canvas || !maybeWrap) return
      const canvasEl = canvas
      const wrapEl = maybeWrap as HTMLElement
      const canvasRect = canvasEl.getBoundingClientRect()
      const zoom = _canvasZoom(canvasEl)

      // First drag ever: snapshot flow positions as absolute for all unpositioned sections
      if (node.attrs.x === null) {
        const tr = editor.state.tr
        editor.state.doc.forEach((sNode, offset) => {
          if (sNode.type.name !== 'section' || sNode.attrs.x !== null) return
          const dom = editor.view.nodeDOM(offset) as HTMLElement | null
          if (!dom) return
          const r = dom.getBoundingClientRect()
          tr.setNodeMarkup(offset, undefined, {
            ...sNode.attrs,
            x: Math.round((r.left - canvasRect.left) / zoom),
            y: Math.round((r.top  - canvasRect.top) / zoom),
            w: Math.round(r.width / zoom),
          })
        })
        editor.view.dispatch(tr)
      }

      const wrapRect = wrapEl.getBoundingClientRect()
      const startBX = Math.round((wrapRect.left - canvasRect.left) / zoom)
      const startBY = Math.round((wrapRect.top  - canvasRect.top) / zoom)
      const blockW  = Math.round(wrapRect.width / zoom)
      const blockH  = Math.round(wrapRect.height / zoom)

      // React owns these styles — capture and restore them after the drag,
      // otherwise the inline overrides shadow attr-driven values (z-layer, width)
      const prevZ = wrapEl.style.zIndex
      const prevW = wrapEl.style.width

      wrapEl.style.position = 'absolute'
      wrapEl.style.margin   = '0'
      wrapEl.style.zIndex   = '10'
      wrapEl.style.left     = startBX + 'px'
      wrapEl.style.top      = startBY + 'px'
      wrapEl.style.width    = blockW  + 'px'

      const isMultiDrag = sectionSel.has(sectionId) && sectionSel.size() > 1
      const multiStarts = new Map<string, { el: HTMLElement; bx: number; by: number; prevZ: string }>()
      if (isMultiDrag) {
        sectionSel.setDrag(true)
        canvasEl.querySelectorAll<HTMLElement>('[data-section-card]').forEach(card => {
          const id = card.dataset.sectionId
          if (!id || !sectionSel.has(id)) return
          const wrap = card.parentElement as HTMLElement
          const wr = wrap.getBoundingClientRect()
          const bx = Math.round((wr.left - canvasRect.left) / zoom)
          const by = Math.round((wr.top  - canvasRect.top) / zoom)
          multiStarts.set(id, { el: wrap, bx, by, prevZ: wrap.style.zIndex })
          wrap.style.position = 'absolute'
          wrap.style.margin   = '0'
          wrap.style.zIndex   = '10'
          wrap.style.left     = bx + 'px'
          wrap.style.top      = by + 'px'
        })
      }

      setSectionDragging(true)
      document.body.style.userSelect = 'none'
      document.body.style.cursor     = 'grabbing'

      function onMove(ev: MouseEvent) {
        const dx = (ev.clientX - downX) / zoom
        const dy = (ev.clientY - downY) / zoom
        if (isMultiDrag) {
          multiStarts.forEach(({ el, bx, by }) => { el.style.left = (bx + dx) + 'px'; el.style.top = (by + dy) + 'px' })
          _fitCanvasToSections(canvasEl)
        } else {
          const snap = _computeSnap(canvasEl, sectionId, startBX + dx, startBY + dy, blockW, blockH)
          wrapEl.style.left = snap.x + 'px'
          wrapEl.style.top  = snap.y + 'px'
          _showSnapLines(canvasEl, snap.lines)
          _fitCanvasToSections(canvasEl)
        }
      }

      function onUp() {
        _clearSnapLines()
        setSectionDragging(false)
        if (isMultiDrag) sectionSel.setDrag(false)
        document.body.style.userSelect = ''
        document.body.style.cursor     = ''

        const tr = editor.state.tr
        if (isMultiDrag) {
          editor.state.doc.forEach((sNode, offset) => {
            if (sNode.type.name !== 'section') return
            const dom = editor.view.nodeDOM(offset) as HTMLElement | null
            const id = (dom?.querySelector('[data-section-card]') as HTMLElement | null)?.dataset.sectionId
            if (!id || !sectionSel.has(id)) return
            const start = multiStarts.get(id)
            if (!start) return
            tr.setNodeMarkup(offset, undefined, { ...sNode.attrs, x: Math.round(parseFloat(start.el.style.left)), y: Math.round(parseFloat(start.el.style.top)) })
          })
        } else {
          const freshNode = editor.state.doc.nodeAt(docPos)
          if (freshNode) tr.setNodeMarkup(docPos, undefined, { ...freshNode.attrs, x: Math.round(parseFloat(wrapEl.style.left)), y: Math.round(parseFloat(wrapEl.style.top)) })
        }
        editor.view.dispatch(tr)
        wrapEl.style.zIndex = prevZ
        wrapEl.style.width  = prevW
        if (isMultiDrag) multiStarts.forEach(s => { s.el.style.zIndex = s.prevZ })
        _fitCanvasToSections(canvasEl)
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup',   onUp)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup',   onUp)
    }
  }

  function startResize(dir: string, e: React.MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const canvas    = document.querySelector('[data-editor-canvas]') as HTMLElement | null
    const maybeWrap = cardRef.current?.parentElement
    if (!canvas || !maybeWrap) return
    const canvasEl = canvas
    const wrapEl = maybeWrap as HTMLElement
    const canvasRect = canvasEl.getBoundingClientRect()
    const zoom = _canvasZoom(canvasEl)
    const startMX = e.clientX, startMY = e.clientY
    const resizesWidth = dir.includes('e') || dir.includes('w')
    const resizesHeight = dir.includes('n') || dir.includes('s')
    let frame = 0
    let latest: MouseEvent | null = null

    // Multi-resize: same delta on every selected block when this block is part of the selection
    const isMulti = sectionSel.has(sectionId) && sectionSel.size() > 1
    const targets = new Map<string, { el: HTMLElement; bx: number; by: number; w: number; h: number; prevZ: string }>()
    if (isMulti) {
      canvasEl.querySelectorAll<HTMLElement>('[data-section-card]').forEach(card => {
        const id = card.dataset.sectionId
        if (!id || !sectionSel.has(id)) return
        const wrap = card.parentElement as HTMLElement
        const wr = wrap.getBoundingClientRect()
        targets.set(id, {
          el: wrap,
          bx: Math.round((wr.left - canvasRect.left) / zoom),
          by: Math.round((wr.top  - canvasRect.top) / zoom),
          w:  Math.round(wr.width / zoom),
          h:  Math.round(wr.height / zoom),
          prevZ: wrap.style.zIndex,
        })
      })
    } else {
      const wrapRect = wrapEl.getBoundingClientRect()
      targets.set(sectionId, {
        el: wrapEl,
        bx: Math.round((wrapRect.left - canvasRect.left) / zoom),
        by: Math.round((wrapRect.top  - canvasRect.top) / zoom),
        w:  Math.round(wrapRect.width / zoom),
        h:  Math.round(wrapRect.height / zoom),
        prevZ: wrapEl.style.zIndex,
      })
    }
    const current = new Map<string, { x: number; y: number; w: number; h: number }>()
    targets.forEach((t, id) => current.set(id, { x: t.bx, y: t.by, w: t.w, h: t.h }))

    setResizing(true)
    setActiveResizeDir(dir)
    document.body.style.cursor     = dir + '-resize'
    document.body.style.userSelect = 'none'
    targets.forEach(t => {
      t.el.style.willChange = 'left, top, width, height'
      t.el.style.zIndex = '120'
    })

    function applyResize(ev: MouseEvent) {
      const dx = (ev.clientX - startMX) / zoom
      const dy = (ev.clientY - startMY) / zoom
      targets.forEach((t, id) => {
        let nx = t.bx, ny = t.by, nw = t.w, nh = t.h
        if (dir.includes('e')) nw = Math.max(MIN_SECTION_W, t.w + dx)
        if (dir.includes('w')) { nw = Math.max(MIN_SECTION_W, t.w - dx); nx = t.bx + t.w - nw }
        if (dir.includes('s')) nh = Math.max(MIN_SECTION_H, t.h + dy)
        if (dir.includes('n')) { nh = Math.max(MIN_SECTION_H, t.h - dy); ny = t.by + t.h - nh }
        // Snapping only for single resize — with several moving blocks the lines would fight each other
        if (!isMulti) {
          const snap = _computeResizeSnap(canvasEl, id, dir, nx, ny, nw, nh)
          nx = snap.x; ny = snap.y; nw = snap.w; nh = snap.h
          _showSnapLines(canvasEl, snap.lines)
        }
        current.set(id, { x: nx, y: ny, w: nw, h: nh })
        t.el.style.left = nx + 'px'
        t.el.style.top  = ny + 'px'
        if (resizesWidth)  t.el.style.width  = nw + 'px'
        if (resizesHeight) t.el.style.height = nh + 'px'
      })
      _fitCanvasToSections(canvasEl)
    }

    function onMove(ev: MouseEvent) {
      latest = ev
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        if (latest) applyResize(latest)
      })
    }

    function onUp() {
      if (frame) {
        window.cancelAnimationFrame(frame)
        frame = 0
      }
      if (latest) applyResize(latest)
      setResizing(false)
      setActiveResizeDir(null)
      _clearSnapLines()
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
      targets.forEach(t => { t.el.style.willChange = ''; t.el.style.zIndex = t.prevZ })
      if (latest) {
        const tr = editor.state.tr
        editor.state.doc.forEach((sNode, offset) => {
          if (sNode.type.name !== 'section') return
          const dom = editor.view.nodeDOM(offset) as HTMLElement | null
          const id = (dom?.querySelector('[data-section-card]') as HTMLElement | null)?.dataset.sectionId
          if (!id) return
          const cur = current.get(id)
          if (!cur) return
          tr.setNodeMarkup(offset, undefined, {
            ...sNode.attrs,
            x: Math.round(cur.x),
            y: Math.round(cur.y),
            w: resizesWidth  ? Math.round(cur.w) : sNode.attrs.w,
            h: resizesHeight ? Math.round(cur.h) : sNode.attrs.h,
          })
        })
        editor.view.dispatch(tr)
      }
      _fitCanvasToSections(canvasEl)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }

  useEffect(() => {
    if (!colorPickerOpen) return
    const close = () => setColorPickerOpen(false)
    const id = window.setTimeout(() => document.addEventListener('click', close), 0)
    return () => { window.clearTimeout(id); document.removeEventListener('click', close) }
  }, [colorPickerOpen])

  function setBlockColor(bgColor: string | null, borderColor: string | null) {
    if (typeof getPos !== 'function') return
    const pos = getPos()
    if (pos === undefined) return
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, bgColor, borderColor })
    )
  }

  function setAutoSize() {
    if (typeof getPos !== 'function') return
    const pos = getPos()
    if (pos === undefined) return
    const freshNode = editor.state.doc.nodeAt(pos)
    if (!freshNode) return
    const tr = editor.state.tr.setNodeMarkup(pos, undefined, { ...freshNode.attrs, w: null, h: null })
    editor.view.dispatch(tr)
    window.requestAnimationFrame(() => {
      const canvas = document.querySelector('[data-editor-canvas]') as HTMLElement | null
      if (canvas) _fitCanvasToSections(canvas)
    })
  }

  function bringToLayer(front: boolean) {
    if (typeof getPos !== 'function') return
    const pos = getPos()
    if (pos === undefined) return
    const fresh = editor.state.doc.nodeAt(pos)
    if (!fresh) return
    let minZ = Infinity, maxZ = -Infinity
    editor.state.doc.forEach((n, offset) => {
      if (n.type.name !== 'section' || offset === pos) return
      const z = (n.attrs.z as number | null) ?? 0
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    })
    if (!Number.isFinite(minZ)) return  // only one section, nothing to stack against
    const currentZ = (fresh.attrs.z as number | null) ?? 0
    if (front && currentZ > maxZ) return
    if (!front && currentZ < minZ) return
    const target = front ? maxZ + 1 : minZ - 1
    const tr = editor.state.tr
    if (target < 0) {
      // Negative z-index paints the block behind the editor surface where the mouse
      // can't reach it — push all other blocks up instead and keep 0 as the floor
      const shift = -target
      editor.state.doc.forEach((n, offset) => {
        if (n.type.name !== 'section' || offset === pos) return
        tr.setNodeMarkup(offset, undefined, { ...n.attrs, z: ((n.attrs.z as number | null) ?? 0) + shift })
      })
      tr.setNodeMarkup(pos, undefined, { ...fresh.attrs, z: 0 })
    } else {
      tr.setNodeMarkup(pos, undefined, { ...fresh.attrs, z: target })
    }
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
    const freshNode = editor.state.doc.nodeAt(sectionPos)
    if (!freshNode) return
    const insertPos = sectionPos + freshNode.nodeSize - 1
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

  useEffect(() => {
    function onAddElement(e: Event) {
      const detail = (e as CustomEvent<{ key?: string }>).detail
      if (!detail?.key || !sectionSel.has(sectionId)) return
      addElement(detail.key)
    }
    document.addEventListener('wiki-editor-add-element', onAddElement)
    return () => document.removeEventListener('wiki-editor-add-element', onAddElement)
  }, [sectionId])

  function isElementDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes('application/x-wiki-element')
  }

  function onElementDragOver(e: React.DragEvent) {
    if (!isElementDrag(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setElementDropTarget(true)
  }

  function onElementDrop(e: React.DragEvent) {
    if (!isElementDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
    const key = e.dataTransfer.getData('application/x-wiki-element')
    setElementDropTarget(false)
    if (key) addElement(key)
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

  const BG_COLORS = [
    { label: 'Transparent',  value: 'transparent',  style: 'transparent' },
    { label: 'Standard',     value: null,           style: 'var(--surface)' },
    { label: 'Weiß',         value: '#ffffff',       style: '#ffffff' },
    { label: 'Rot',       value: '#fef2f2',  style: '#fef2f2' },
    { label: 'Orange',    value: '#fff7ed',  style: '#fff7ed' },
    { label: 'Gelb',      value: '#fefce8',  style: '#fefce8' },
    { label: 'Grün',      value: '#f0fdf4',  style: '#f0fdf4' },
    { label: 'Blau',      value: '#eff6ff',  style: '#eff6ff' },
    { label: 'Lila',      value: '#f5f3ff',  style: '#f5f3ff' },
    { label: 'Pink',      value: '#fdf4ff',  style: '#fdf4ff' },
    { label: 'Grau',      value: '#f8fafc',  style: '#f8fafc' },
    { label: 'Dunkel',    value: '#1e293b',  style: '#1e293b' },
    { label: 'Schwarz',   value: '#0f172a',  style: '#0f172a' },
  ]
  const BORDER_COLORS = [
    { label: 'Transparent', value: 'transparent', style: 'transparent' },
    { label: 'Standard', value: null,       style: 'var(--border)' },
    { label: 'Grau',     value: '#d1d5db',  style: '#d1d5db' },
    { label: 'Rot',      value: '#f87171',  style: '#f87171' },
    { label: 'Orange',   value: '#fb923c',  style: '#fb923c' },
    { label: 'Gelb',     value: '#facc15',  style: '#facc15' },
    { label: 'Grün',     value: '#4ade80',  style: '#4ade80' },
    { label: 'Blau',     value: '#60a5fa',  style: '#60a5fa' },
    { label: 'Lila',     value: '#a78bfa',  style: '#a78bfa' },
    { label: 'Pink',     value: '#f472b6',  style: '#f472b6' },
    { label: 'Akzent',   value: '#009955',  style: '#009955' },
    { label: 'Alarm',    value: '#dd2244',  style: '#dd2244' },
    { label: 'Schwarz',  value: '#0f172a',  style: '#0f172a' },
  ]

  const bgColor     = node.attrs.bgColor     as string | null
  const borderColor = node.attrs.borderColor as string | null
  const canvasX = node.attrs.x as number | null
  const canvasY = node.attrs.y as number | null
  const canvasW = node.attrs.w as number | null
  const canvasH = node.attrs.h as number | null
  const canvasZ = node.attrs.z as number | null
  const isCanvasBlock = canvasX !== null && canvasY !== null

  useEffect(() => {
    const canvas = document.querySelector('[data-editor-canvas]') as HTMLElement | null
    if (canvas) _fitCanvasToSections(canvas)
  }, [canvasX, canvasY, canvasW, canvasH])

  return (
    <NodeViewWrapper
      style={{
        margin: isCanvasBlock ? 0 : '0 0 12px',
        position: isCanvasBlock ? 'absolute' : 'relative',
        left: isCanvasBlock ? `${canvasX}px` : undefined,
        top: isCanvasBlock ? `${canvasY}px` : undefined,
        width: canvasW !== null ? `${canvasW}px` : (isCanvasBlock ? 'fit-content' : undefined),
        height: canvasH !== null ? `${canvasH}px` : undefined,
        zIndex: pickerOpen || imageMode || colorPickerOpen || sectionDragging || resizing ? 100 : (canvasZ ?? undefined),
      }}
    >
      <div
        ref={cardRef}
        data-section-card="true"
        data-section-id={sectionId}
        onMouseMove={onMouseMove}
        onMouseLeave={() => { if (!dragRef.current) setHandle(null) }}
        onDragOver={onElementDragOver}
        onDragLeave={() => setElementDropTarget(false)}
        onDrop={onElementDrop}
        style={{
          background: bgColor ?? 'var(--surface)',
          border: `1px solid ${borderColor ?? 'var(--border)'}`,
          borderRadius: '12px',
          padding: '20px 28px 16px 44px',
          position: 'relative',
          width: canvasW === null && isCanvasBlock ? 'fit-content' : undefined,
          minWidth: `${MIN_SECTION_W}px`,
          maxWidth: canvasW === null && isCanvasBlock ? `${MAX_AUTO_SECTION_W}px` : undefined,
          height: canvasH !== null ? '100%' : undefined,
          minHeight: `${MIN_SECTION_H}px`,
          boxSizing: 'border-box',
          overflow: 'visible',
          display: canvasH !== null ? 'flex' : undefined,
          flexDirection: canvasH !== null ? 'column' : undefined,
          outline: isSelected || elementDropTarget ? '2px solid var(--accent)' : 'none',
          outlineOffset: elementDropTarget ? '4px' : '2px',
          boxShadow: elementDropTarget ? '0 18px 42px rgba(0,0,0,0.16), 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent)' : undefined,
          cursor: resizing ? 'inherit' : (dragging ? 'grabbing' : undefined),
          transition: sectionDragging || resizing ? undefined : 'outline 0.1s, box-shadow 0.12s',
        }}
      >
        {/* Handle buttons: ⠿ drag + ✕ delete */}
        {editable && handle && !dragging && (
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

        {/* Top-right controls: color picker + drag + delete */}
        {editable && (
          <div className="wiki-section-delete" style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: '1px' }}>

            {/* Color picker toggle */}
            <div style={{ position: 'relative' }}>
              <button
                title="Farbe anpassen"
                onClick={e => { e.stopPropagation(); setColorPickerOpen(o => !o) }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  width: '26px', height: '26px', borderRadius: '5px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                <span style={{
                  display: 'inline-block', width: '13px', height: '13px', borderRadius: '50%',
                  background: bgColor === 'transparent' ? 'transparent' : (bgColor ?? 'var(--surface)'),
                  border: `2.5px solid ${borderColor === 'transparent' ? 'transparent' : (borderColor ?? 'var(--border)')}`,
                  outline: '1.5px solid var(--border)',
                  outlineOffset: '1px',
                  flexShrink: 0,
                  backgroundImage: bgColor === 'transparent'
                    ? 'linear-gradient(to top right, transparent calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1px)), linear-gradient(to top left, transparent calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1px))'
                    : undefined,
                }} />
              </button>

              {colorPickerOpen && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '10px', padding: '10px 12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    zIndex: 300, minWidth: '200px',
                  }}
                >
                  <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: '6px' }}>HINTERGRUND</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                    {BG_COLORS.map(c => (
                      <button
                        key={c.label}
                        title={c.label}
                        onClick={() => setBlockColor(c.value, borderColor)}
                        style={{
                          width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer',
                          backgroundColor: c.style, border: '2px solid',
                          borderColor: bgColor === c.value ? 'var(--accent)' : (c.value === null || c.value === 'transparent' ? 'var(--border)' : 'transparent'),
                          outline: bgColor === c.value ? '2px solid var(--accent)' : 'none',
                          outlineOffset: '1px',
                          padding: 0,
                          boxSizing: 'border-box',
                          backgroundImage: c.value === 'transparent'
                            ? 'linear-gradient(to top right, transparent calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1px)), linear-gradient(to top left, transparent calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1px))'
                            : undefined,
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ height: '1px', background: 'var(--border)', margin: '2px 0 8px' }} />
                  <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: '6px' }}>RAHMEN</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {BORDER_COLORS.map(c => (
                      <button
                        key={c.label}
                        title={c.label}
                        onClick={() => setBlockColor(bgColor, c.value)}
                        style={{
                          width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer',
                          backgroundColor: c.style, border: '2px solid',
                          borderColor: borderColor === c.value ? 'var(--text)' : (c.value === null || c.value === 'transparent' ? 'var(--border)' : 'transparent'),
                          outline: borderColor === c.value ? '2px solid var(--text)' : 'none',
                          outlineOffset: '1px',
                          padding: 0,
                          boxSizing: 'border-box',
                          backgroundImage: c.value === 'transparent'
                            ? 'linear-gradient(to top right, transparent calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1px)), linear-gradient(to top left, transparent calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1px))'
                            : undefined,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Layer: bring to front / send to back */}
            {isCanvasBlock && (
              <>
                <button
                  title="In den Vordergrund"
                  onClick={e => { e.stopPropagation(); bringToLayer(true) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)', fontSize: '13px',
                    width: '26px', height: '26px', borderRadius: '5px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'inherit', lineHeight: 1,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)' }}
                >
                  ⤒
                </button>
                <button
                  title="In den Hintergrund"
                  onClick={e => { e.stopPropagation(); bringToLayer(false) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)', fontSize: '13px',
                    width: '26px', height: '26px', borderRadius: '5px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'inherit', lineHeight: 1,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)' }}
                >
                  ⤓
                </button>
              </>
            )}

            {/* Auto size */}
            {(canvasW !== null || canvasH !== null) && (
              <button
                title="Groesse automatisch an Inhalt anpassen"
                onClick={e => { e.stopPropagation(); setAutoSize() }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: '10px', fontWeight: 700,
                  width: '38px', height: '26px', borderRadius: '5px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'inherit', lineHeight: 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)' }}
              >
                Auto
              </button>
            )}

            {/* Drag handle */}
            <div
              data-section-drag-handle="true"
              title="Block verschieben / klicken zum Auswählen"
              onMouseDown={handleSectionDragDown}
              style={{
                cursor: 'grab', color: 'var(--muted)', fontSize: '14px',
                width: '26px', height: '26px', borderRadius: '5px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                userSelect: 'none', lineHeight: 1,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)' }}
            >
              ⠿
            </div>

            {/* Delete */}
            <button
              title="Block löschen"
              onClick={() => deleteNode()}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: '12px',
                width: '26px', height: '26px', borderRadius: '5px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'inherit', lineHeight: 1,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fff0f2' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none' }}
            >
              ✕
            </button>
          </div>
        )}

        {editable && isCanvasBlock && (
          <>
            {(['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'] as const).map(dir => {
              const isCorner = dir.length === 2
              const cursor = `${dir}-resize`
              const showHandle = isSelected || resizing
              const isActiveCorner = dir.length === 2 && activeResizeDir === dir
              const style = {
                position: 'absolute' as const,
                zIndex: 20,
                background: isCorner && showHandle ? 'var(--accent)' : 'transparent',
                border: isCorner && showHandle ? '1px solid #fff' : undefined,
                boxShadow: isCorner && showHandle
                  ? (isActiveCorner ? '0 0 0 2px var(--accent), 0 0 0 5px color-mix(in srgb, var(--accent) 18%, transparent)' : '0 0 0 1px var(--accent)')
                  : undefined,
                opacity: isCorner && showHandle ? 1 : 0,
                transition: resizing ? undefined : 'opacity 0.1s',
                cursor,
                ...(dir === 'n' ? { left: 12, right: 12, top: -7, height: 14, borderRadius: 7 } : {}),
                ...(dir === 's' ? { left: 12, right: 12, bottom: -7, height: 14, borderRadius: 7 } : {}),
                ...(dir === 'e' ? { top: 12, right: -7, bottom: 12, width: 14, borderRadius: 7 } : {}),
                ...(dir === 'w' ? { top: 12, left: -7, bottom: 12, width: 14, borderRadius: 7 } : {}),
                ...(dir === 'ne' ? { top: -8, right: -8, width: isActiveCorner ? 18 : 14, height: isActiveCorner ? 18 : 14, borderRadius: 9 } : {}),
                ...(dir === 'se' ? { right: -8, bottom: -8, width: isActiveCorner ? 18 : 14, height: isActiveCorner ? 18 : 14, borderRadius: 9 } : {}),
                ...(dir === 'sw' ? { left: -8, bottom: -8, width: isActiveCorner ? 18 : 14, height: isActiveCorner ? 18 : 14, borderRadius: 9 } : {}),
                ...(dir === 'nw' ? { top: -8, left: -8, width: isActiveCorner ? 18 : 14, height: isActiveCorner ? 18 : 14, borderRadius: 9 } : {}),
              }
              return (
                <div
                  key={dir}
                  data-section-resize-handle="true"
                  title="Größe ändern"
                  onMouseDown={e => startResize(dir, e)}
                  style={style}
                />
              )
            })}
          </>
        )}

        <NodeViewContent
          style={{
            minHeight: 0,
            flex: canvasH !== null ? '1 1 auto' : undefined,
            overflow: canvasH !== null ? 'auto' : undefined,
          }}
        />

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
                display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '3px',
                zIndex: 200, width: '360px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
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

export { sectionSel }

export const SectionExtension = Node.create({
  name: 'section',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      bgColor:     { default: null, parseHTML: el => el.getAttribute('data-bg')     || null },
      borderColor: { default: null, parseHTML: el => el.getAttribute('data-border') || null },
      x: { default: null, parseHTML: el => el.hasAttribute('data-x') ? Number(el.getAttribute('data-x')) : null },
      y: { default: null, parseHTML: el => el.hasAttribute('data-y') ? Number(el.getAttribute('data-y')) : null },
      w: { default: null, parseHTML: el => el.hasAttribute('data-w') ? Number(el.getAttribute('data-w')) : null },
      h: { default: null, parseHTML: el => el.hasAttribute('data-h') ? Number(el.getAttribute('data-h')) : null },
      z: { default: null, parseHTML: el => el.hasAttribute('data-z') ? Number(el.getAttribute('data-z')) : null },
    }
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs: Record<string, string> = {}
    if (node.attrs.bgColor)     attrs['data-bg']     = node.attrs.bgColor
    if (node.attrs.borderColor) attrs['data-border'] = node.attrs.borderColor
    if (node.attrs.x !== null) attrs['data-x'] = String(node.attrs.x)
    if (node.attrs.y !== null) attrs['data-y'] = String(node.attrs.y)
    if (node.attrs.w !== null) attrs['data-w'] = String(node.attrs.w)
    if (node.attrs.h !== null) attrs['data-h'] = String(node.attrs.h)
    if (node.attrs.z !== null) attrs['data-z'] = String(node.attrs.z)
    return ['section', mergeAttributes(HTMLAttributes, attrs), 0]
  },

  parseHTML() {
    return [{ tag: 'section' }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SectionView)
  },
})
