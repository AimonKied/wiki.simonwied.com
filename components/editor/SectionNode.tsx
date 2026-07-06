'use client'

/* eslint-disable react-hooks/immutability */
import { Node, mergeAttributes, Editor } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Fragment } from '@tiptap/pm/model'
import type { Node as PMNode, Slice } from '@tiptap/pm/model'
import { Plugin, TextSelection } from '@tiptap/pm/state'
import { dropPoint } from '@tiptap/pm/transform'
import { useId, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { toggleJSON } from './ToggleNode'
import { ELEMENT_PALETTE } from './elementPalette'

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

function _mountedView(ed: Editor | null) {
  try {
    return ed?.view ?? null
  } catch {
    return null
  }
}

// ── Canvas snap helpers ────────────────────────────────────────────────────────
interface SnapLine { axis: 'x' | 'y'; pos: number; from: number; to: number }
let _snapLineEls: HTMLElement[] = []
const MIN_SECTION_W = 180
const MIN_SECTION_H = 136
const MAX_AUTO_SECTION_W = 960
const CANVAS_W = 9000
const CANVAS_H = 4000
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
  canvas.style.minHeight = `${CANVAS_H}px`
}

function _clampSectionBox(x: number, y: number, w: number, h: number) {
  const cw = Math.max(MIN_SECTION_W, Math.min(CANVAS_W, w))
  const ch = Math.max(MIN_SECTION_H, Math.min(CANVAS_H, h))
  return {
    x: Math.min(Math.max(0, x), Math.max(0, CANVAS_W - cw)),
    y: Math.min(Math.max(0, y), Math.max(0, CANVAS_H - ch)),
    w: cw,
    h: ch,
  }
}

function _clampResizeBox(dir: string, x: number, y: number, w: number, h: number) {
  let nx = x
  let ny = y
  let nw = Math.max(MIN_SECTION_W, w)
  let nh = Math.max(MIN_SECTION_H, h)

  if (nx < 0) {
    if (dir.includes('w')) nw = Math.max(MIN_SECTION_W, nw + nx)
    nx = 0
  }
  if (ny < 0) {
    if (dir.includes('n')) nh = Math.max(MIN_SECTION_H, nh + ny)
    ny = 0
  }
  if (nx + nw > CANVAS_W) {
    if (dir.includes('e')) nw = Math.max(MIN_SECTION_W, CANVAS_W - nx)
    else nx = Math.max(0, CANVAS_W - nw)
  }
  if (ny + nh > CANVAS_H) {
    if (dir.includes('s')) nh = Math.max(MIN_SECTION_H, CANVAS_H - ny)
    else ny = Math.max(0, CANVAS_H - nh)
  }

  return _clampSectionBox(nx, ny, nw, nh)
}

function _nextSectionZ(editor: Editor) {
  let maxZ = -1
  editor.state.doc.forEach(node => {
    if (node.type.name !== 'section') return
    maxZ = Math.max(maxZ, (node.attrs.z as number | null) ?? 0)
  })
  return maxZ + 1
}

let _globalHandlersInstalled = false
function _ensureGlobalHandlers() {
  if (_globalHandlersInstalled) return
  _globalHandlersInstalled = true

  // Deselect blocks on click outside any drag handle
  document.addEventListener('mousedown', (e) => {
    if (_selSet.size === 0) return
    if ((e.target as Element).closest('[data-section-drag-handle]')) return
    if ((e.target as Element).closest('[data-article-block-controls]')) return
    if ((e.target as Element).closest('[data-element-palette]')) return
    sectionSel.clear()
  })

	  document.addEventListener('keydown', (e) => {
	    if (e.key === 'Escape') { sectionSel.clear(); return }
	    const activeView = _mountedView(_activeEditor)

	    if ((e.key === 'Delete' || e.key === 'Backspace') && _selSet.size > 0) {
	      if (!activeView || !_activeEditor) return
	      if (window.getSelection()?.type === 'Range') return
	      e.preventDefault()
	      const doc = _activeEditor!.state.doc
	      const tr = _activeEditor!.state.tr
      const toDelete: { pos: number; size: number }[] = []
      doc.forEach((node: PMNode, offset: number) => {
        if (node.type.name !== 'section') return
	        const dom = activeView.nodeDOM(offset) as HTMLElement | null
	        const id = (dom?.querySelector('[data-section-card]') as HTMLElement | null)?.dataset.sectionId
	        if (id && _selSet.has(id)) toDelete.push({ pos: offset, size: node.nodeSize })
	      })
      toDelete.reverse().forEach(({ pos, size }) => {
        const mapped = tr.mapping.map(pos)
        tr.delete(mapped, mapped + size)
      })
	      activeView.dispatch(tr)
	      sectionSel.clear()
	      return
	    }

    const ctrl = e.ctrlKey || e.metaKey
    if (!ctrl) return

	    if (e.key === 'z' || e.key === 'y') {
	      if (!activeView) return
	      if (activeView?.hasFocus()) return
	      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); _activeEditor?.commands.undo(); return }
	      if (e.key === 'y' || e.shiftKey) { e.preventDefault(); _activeEditor?.commands.redo(); return }
	    }

	    // Ctrl+C / Ctrl+X: copy or cut selected sections (always takes priority when blocks are selected)
	    if ((e.key === 'c' || e.key === 'x') && _selSet.size > 0) {
	      if (!activeView || !_activeEditor) return
	      e.preventDefault()
	      const nodes: PMNode[] = []
	      _activeEditor?.state.doc.forEach((node: PMNode, offset: number) => {
	        if (node.type.name !== 'section') return
	        const dom = activeView.nodeDOM(offset) as HTMLElement | null
	        const id = (dom?.querySelector('[data-section-card]') as HTMLElement | null)?.dataset.sectionId
	        if (id && _selSet.has(id)) nodes.push(node)
	      })
      _sectionClipboard = nodes
      _elementClipboard = null

	      if (e.key === 'x') {
	        const doc = _activeEditor.state.doc
	        const tr = _activeEditor.state.tr
	        const toDelete: { pos: number; size: number }[] = []
	        doc.forEach((node: PMNode, offset: number) => {
	          if (node.type.name !== 'section') return
	          const dom = activeView.nodeDOM(offset) as HTMLElement | null
	          const id = (dom?.querySelector('[data-section-card]') as HTMLElement | null)?.dataset.sectionId
	          if (id && _selSet.has(id)) toDelete.push({ pos: offset, size: node.nodeSize })
	        })
        // Delete from end to start so positions remain valid
        toDelete.reverse().forEach(({ pos, size }) => {
          const mapped = tr.mapping.map(pos)
          tr.delete(mapped, mapped + size)
        })
	        activeView.dispatch(tr)
	        sectionSel.clear()
	      }
	    }

    // Ctrl+V: paste section clipboard (only when no text is selected in the editor)
    if (e.key === 'v' && _sectionClipboard.length > 0) {
      const textSelected = !!window.getSelection()?.toString()
	      if (textSelected) return  // let browser handle text paste
	      const ed = _activeEditor
	      const view = _mountedView(ed)
	      if (!ed || !view) return
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
	      view.dispatch(tr)
	    }
	  })
	}
// ─────────────────────────────────────────────────────────────────────────────

interface HandleInfo {
  top: number
  height: number
  childPos: number
  childSize: number
  childIdx: number
  togglePos?: number   // set when the child lives inside a toggle
}

interface ElBound { top: number; bottom: number; mid: number }

interface DragRefState {
  childIdx: number
  childPos: number
  childSize: number
  dropIdx: number
  elBounds: ElBound[]
  cardTop: number
  canvasZoom: number
  sourceSectionPos: number
  targetSectionPos: number
  targetDropIdx: number
  targetIsNewBlock: boolean
  slotLeft: number
  slotRight: number
  togglePos?: number   // set when dragging a child inside a toggle
}

const articleMenuButtonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '7px 9px',
  border: 0,
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 13,
}

const articleMenuRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  textAlign: 'left',
  padding: '7px 9px',
  border: 0,
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 13,
}

const articleMenuBackStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  textAlign: 'left',
  padding: '7px 9px',
  border: 0,
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--muted)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 700,
}

function SectionView({ editor, node, getPos, deleteNode }: NodeViewProps) {
  const sectionId = useId()
  const [isSelected, setIsSelected] = useState(false)
  const [isEditorActive, setIsEditorActive] = useState(false)
  const [cardHovered, setCardHovered] = useState(false)
  const [handle, setHandle] = useState<HandleInfo | null>(null)
  const [dragging, setDragging] = useState(false)
  const [sectionDragging, setSectionDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [activeResizeDir, setActiveResizeDir] = useState<string | null>(null)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [blockMenuOpen, setBlockMenuOpen] = useState(false)
  const [blockMenuPos, setBlockMenuPos] = useState<{ left?: number; right?: number; top: number; maxHeight: number; maxWidth: number } | null>(null)
  const [blockMenuView, setBlockMenuView] = useState<'main' | 'turn' | 'color'>('main')
  const dragHandleRef = useRef<HTMLDivElement>(null)
  const [imageInsertOpen, setImageInsertOpen] = useState(false)
  const [imageInsertAnchor, setImageInsertAnchor] = useState<{ left: number; top: number } | null>(null)
  const [elementDropTarget, setElementDropTarget] = useState(false)
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaUploading, setMediaUploading] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const mediaInsertPosRef = useRef<number | null>(null)
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
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

	  useEffect(() => {
	    function updateEditorActive() {
	      const sectionPos = typeof getPos === 'function' ? getPos() : undefined
	      const view = _mountedView(editor as unknown as Editor)
	      if (sectionPos === undefined || !view?.hasFocus()) {
	        setIsEditorActive(false)
	        return
	      }
      const currentNode = editor.state.doc.nodeAt(sectionPos)
      const cursorPos = editor.state.selection.from
      setIsEditorActive(!!currentNode && cursorPos > sectionPos && cursorPos < sectionPos + currentNode.nodeSize)
    }

    updateEditorActive()
    editor.on('selectionUpdate', updateEditorActive)
    editor.on('focus', updateEditorActive)
    editor.on('blur', updateEditorActive)
    editor.on('transaction', updateEditorActive)
    return () => {
      editor.off('selectionUpdate', updateEditorActive)
      editor.off('focus', updateEditorActive)
      editor.off('blur', updateEditorActive)
      editor.off('transaction', updateEditorActive)
    }
  }, [editor, getPos])

  // Element copy/cut/paste via Ctrl+C/X/V when element handle is visible
	  useEffect(() => {
	    if (!handle) return
	    function onKey(e: KeyboardEvent) {
	      const view = _mountedView(editor as unknown as Editor)
	      if (!view) return
	      const ctrl = e.ctrlKey || e.metaKey
	      if (!ctrl) return
	      if (window.getSelection()?.toString()) return
      if (_selSet.size > 0) return  // section clipboard takes priority

      const sectionPos = typeof getPos === 'function' ? getPos() : undefined
      if (sectionPos === undefined) return
      const sectionNode = editor.state.doc.nodeAt(sectionPos)
      if (!sectionNode || !handle) return

      const isToggle = handle.togglePos !== undefined
      const containerPos  = isToggle ? handle.togglePos! : sectionPos
      const containerNode = isToggle ? editor.state.doc.nodeAt(containerPos) : sectionNode
      if (!containerNode) return

      if (e.key === 'c') {
        e.preventDefault()
        _elementClipboard = containerNode.child(handle.childIdx)
        _sectionClipboard = []
      }

      if (e.key === 'x') {
        e.preventDefault()
        _elementClipboard = containerNode.child(handle.childIdx)
        _sectionClipboard = []
        const children: PMNode[] = []
        for (let i = 0; i < containerNode.childCount; i++) {
          if (i !== handle.childIdx) children.push(containerNode.child(i))
        }
        const content = children.length > 0
          ? Fragment.from(children)
          : Fragment.from(editor.state.schema.nodes.paragraph.create())
	        const tr = editor.state.tr
	        tr.replaceWith(containerPos + 1, containerPos + containerNode.nodeSize - 1, content)
	        view.dispatch(tr)
	      }

      if (e.key === 'v' && _elementClipboard) {
        e.preventDefault()
        const children: PMNode[] = []
        for (let i = 0; i < containerNode.childCount; i++) {
          children.push(containerNode.child(i))
          if (i === handle.childIdx) children.push(_elementClipboard.copy(_elementClipboard.content))
        }
	        const tr = editor.state.tr
	        tr.replaceWith(containerPos + 1, containerPos + containerNode.nodeSize - 1, Fragment.from(children))
	        view.dispatch(tr)
	      }
	    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [handle, getPos, editor])

  function calcElBounds(sectionPos: number, cardTop: number, canvasZoom: number): ElBound[] {
    const sectionNode = editor.state.doc.nodeAt(sectionPos)
    if (!sectionNode) return []
    const bounds: ElBound[] = []
    let offset = sectionPos + 1
    for (let i = 0; i < sectionNode.childCount; i++) {
      const child = sectionNode.child(i)
      try {
        let topY: number, bottomY: number
        const element = editor.view.nodeDOM(offset) as HTMLElement | null
        if (element?.getBoundingClientRect) {
          const rect = element.getBoundingClientRect()
          topY = rect.top
          bottomY = rect.bottom
        } else if (child.isLeaf) {
          const c = editor.view.coordsAtPos(offset, 1)
          topY = c.top; bottomY = c.bottom
        } else {
          topY    = editor.view.coordsAtPos(offset + 1).top
          bottomY = editor.view.coordsAtPos(offset + child.nodeSize - 1).bottom
        }
        bounds.push({
          top: (topY - cardTop) / canvasZoom,
          bottom: (bottomY - cardTop) / canvasZoom,
          mid: ((topY + bottomY) / 2 - cardTop) / canvasZoom,
        })
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
    const canvas = cardRef.current.closest('[data-editor-canvas]') as HTMLElement | null
    const canvasZoom = canvas ? _canvasZoom(canvas) : 1
    const sectionPos = getPos()
    if (sectionPos === undefined) return

    const sectionNode = editor.state.doc.nodeAt(sectionPos)
    if (!sectionNode) return

    let offset = sectionPos + 1
    for (let i = 0; i < sectionNode.childCount; i++) {
      const child = sectionNode.child(i)
      let topY: number, bottomY: number
      try {
        const element = editor.view.nodeDOM(offset) as HTMLElement | null
        if (element?.getBoundingClientRect) {
          const rect = element.getBoundingClientRect()
          topY = rect.top
          bottomY = rect.bottom
        } else if (child.isLeaf) {
          const c = editor.view.coordsAtPos(offset, 1)
          topY = c.top; bottomY = c.bottom
        } else {
          topY    = editor.view.coordsAtPos(offset + 1).top
          bottomY = editor.view.coordsAtPos(offset + child.nodeSize - 1).bottom
        }
      } catch { offset += child.nodeSize; continue }

      if (e.clientY >= topY - 4 && e.clientY <= bottomY + 4) {
        // If hovering inside an open toggle, find the specific toggle child
        if (child.type.name === 'toggle' && child.attrs.open !== false) {
          const toggleEl = editor.view.nodeDOM(offset) as HTMLElement | null
          const contentEl = toggleEl?.querySelector('.wiki-toggle-content') as HTMLElement | null
          if (contentEl) {
            const contentRect = contentEl.getBoundingClientRect()
            if (e.clientY >= contentRect.top && e.clientY <= contentRect.bottom) {
              let tOffset = offset + 1
              for (let j = 0; j < child.childCount; j++) {
                const tChild = child.child(j)
                let tTopY: number, tBottomY: number
                try {
                  const tEl = editor.view.nodeDOM(tOffset) as HTMLElement | null
                  if (tEl?.getBoundingClientRect) {
                    const tRect = tEl.getBoundingClientRect()
                    tTopY = tRect.top; tBottomY = tRect.bottom
                  } else if (tChild.isLeaf) {
                    const c = editor.view.coordsAtPos(tOffset, 1)
                    tTopY = c.top; tBottomY = c.bottom
                  } else {
                    tTopY    = editor.view.coordsAtPos(tOffset + 1).top
                    tBottomY = editor.view.coordsAtPos(tOffset + tChild.nodeSize - 1).bottom
                  }
                } catch { tOffset += tChild.nodeSize; continue }
                if (e.clientY >= tTopY - 4 && e.clientY <= tBottomY + 4) {
                  setHandle({
                    top: (tTopY - cardRect.top) / canvasZoom,
                    height: (tBottomY - tTopY) / canvasZoom,
                    childPos: tOffset,
                    childSize: tChild.nodeSize,
                    childIdx: j,
                    togglePos: offset,
                  })
                  return
                }
                tOffset += tChild.nodeSize
              }
            }
          }
        }

        setHandle({
          top: (topY - cardRect.top) / canvasZoom,
          height: (bottomY - topY) / canvasZoom,
          childPos: offset,
          childSize: child.nodeSize,
          childIdx: i,
        })
        return
      }
      offset += child.nodeSize
    }
    setHandle(null)
  }

  function startDrag(e: React.PointerEvent) {
    if (!handle || !cardRef.current || typeof getPos !== 'function') return
    e.preventDefault()
    e.stopPropagation()
    const targetEl = e.currentTarget as HTMLElement
    const pointerId = e.pointerId
    try { targetEl.setPointerCapture?.(pointerId) } catch {}

    const cardRect = cardRef.current.getBoundingClientRect()
    const canvas = cardRef.current.closest('[data-editor-canvas]') as HTMLElement | null
    const canvasZoom = canvas ? _canvasZoom(canvas) : 1
    const sectionPos = getPos()
    if (sectionPos === undefined) return

    const isToggleDrag = handle.togglePos !== undefined
    const containerPos  = isToggleDrag ? handle.togglePos! : sectionPos
    const elBounds = calcElBounds(containerPos, cardRect.top, canvasZoom)

    const containerNode = editor.state.doc.nodeAt(containerPos)
    const siblings: HTMLElement[] = []
    if (containerNode) {
      let off = containerPos + 1
      for (let i = 0; i < containerNode.childCount; i++) {
        const el = editor.view.nodeDOM(off) as HTMLElement | null
        siblings.push(el as HTMLElement)
        off += containerNode.child(i).nodeSize
      }
    }
    const origEl = siblings[handle.childIdx] as HTMLElement | undefined

    let slotLeft = 0, slotRight = 0

    if (origEl && cardRef.current) {
      const rect      = origEl.getBoundingClientRect()
      const cardRect2 = cardRef.current.getBoundingClientRect()
      cardTopRef.current = cardRect2.top

      slotLeft  = (rect.left - cardRect2.left) / canvasZoom
      slotRight = (cardRect2.right - rect.right) / canvasZoom

      const nextEl = siblings[handle.childIdx + 1]
      ghostHRef.current = nextEl
        ? (nextEl.getBoundingClientRect().top - rect.top) / canvasZoom
        : rect.height / canvasZoom
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
      canvasZoom,
      sourceSectionPos: sectionPos,
      targetSectionPos: sectionPos,
      targetDropIdx: handle.childIdx,
      targetIsNewBlock: false,
      slotLeft,
      slotRight,
      togglePos: handle.togglePos,
    }
    setDragging(true)
    setHandle(null)

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'

    function onMove(ev: PointerEvent) {
      const d = dragRef.current
      if (!d) return

      // Ghost follows cursor in viewport coords (position:fixed on body)
      if (ghostRef.current) {
        ghostRef.current.style.top = `${ev.clientY - ghostOffY.current}px`
      }

      const fromIdx = d.childIdx
      const ghH     = ghostHRef.current

      // Toggle-child drags: "Neuer Block" is not a valid drop target
      const newBlockBtn = d.togglePos === undefined
        ? document.querySelector('[data-new-block-btn]') as HTMLElement | null
        : null
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

      // Toggle-child drags stay within the toggle — ignore cross-section cursor movement
      if (d.togglePos !== undefined && cursorSectionPos !== d.sourceSectionPos) {
        if (slotRef.current) slotRef.current.style.display = 'none'
        siblingsRef.current.forEach((el, i) => { if (i !== fromIdx) el.style.transform = 'translateY(0)' })
        return
      }

      if (cursorSectionPos === d.sourceSectionPos) {
        // ─── SAME SECTION ──────────────────────────────────────────────
        // Restore source slot, remove any cross-slot
        if (slotRef.current) slotRef.current.style.display = ''
        if (crossSlotRef.current) {
          crossSlotRef.current.parentNode?.removeChild(crossSlotRef.current)
          crossSlotRef.current = null
        }
        d.targetSectionPos = d.sourceSectionPos

        const relY = (ev.clientY - d.cardTop) / d.canvasZoom
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
        const targetElBounds  = calcElBounds(cursorSectionPos, targetCardRect.top, d.canvasZoom)
        const relY            = (ev.clientY - targetCardRect.top) / d.canvasZoom
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
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      try { targetEl.releasePointerCapture?.(pointerId) } catch {}

      if (!d) return

      if (d.togglePos !== undefined) {
        moveToggleElement(d.togglePos, d.childIdx, d.dropIdx)
      } else if (d.targetIsNewBlock) {
        moveElementToNewSection(d.sourceSectionPos, d.childIdx)
      } else if (d.targetSectionPos === d.sourceSectionPos) {
        moveElement(d.childIdx, d.childPos, d.childSize, d.dropIdx)
      } else {
        moveElementCrossSection(d.sourceSectionPos, d.childIdx, d.targetSectionPos, d.targetDropIdx)
      }
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
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

  function moveToggleElement(togglePos: number, fromIdx: number, toInsertIdx: number) {
    if (!editor) return
    if (fromIdx === toInsertIdx || fromIdx + 1 === toInsertIdx) return
    const toggleNode = editor.state.doc.nodeAt(togglePos)
    if (!toggleNode) return

    const children: PMNode[] = []
    for (let i = 0; i < toggleNode.childCount; i++) children.push(toggleNode.child(i))
    const [moved] = children.splice(fromIdx, 1)
    const adjustedIdx = toInsertIdx > fromIdx ? toInsertIdx - 1 : toInsertIdx
    children.splice(adjustedIdx, 0, moved)

    const tr = editor.state.tr
    tr.replaceWith(togglePos + 1, togglePos + toggleNode.nodeSize - 1, Fragment.from(children))
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

    const newSection = editor.state.schema.nodes.section.create({ z: _nextSectionZ(editor) }, Fragment.from(movedNode))

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
      ? { ...sectionNode.attrs, x: (sectionNode.attrs.x as number) + 20, y: (sectionNode.attrs.y as number) + 20, z: _nextSectionZ(editor) }
      : { ...sectionNode.attrs, z: _nextSectionZ(editor) }
    const copy = editor.state.schema.nodes.section.create(newAttrs, sectionNode.content)
    const tr = editor.state.tr
    tr.insert(editor.state.doc.content.size, copy)
    editor.view.dispatch(tr)
  }

  function handleSectionDragDown(e: React.PointerEvent) {
    if (isCanvasBlock) startFreeMove(e)
    else startLinearReorder(e)
  }

  function startLinearReorder(e: React.PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const targetEl = e.currentTarget as HTMLElement
    const pointerId = e.pointerId
    try { targetEl.setPointerCapture?.(pointerId) } catch {}
    const nativeEvent = e.nativeEvent
    const downX = e.clientX
    const downY = e.clientY
    let didDrag = false
    let targetIdx = -1
    let indicator: HTMLDivElement | null = null

    function articleRoot() {
      return cardRef.current?.closest('[data-article-editor]') as HTMLElement | null
    }

    function sectionCards() {
      const root = articleRoot()
      if (!root) return []
      return Array.from(root.querySelectorAll<HTMLElement>('[data-section-card]'))
    }

    function ensureIndicator() {
      if (indicator) return indicator
      const root = articleRoot()
      if (!root) return null
      indicator = document.createElement('div')
      indicator.style.cssText = [
        'height:3px',
        'border-radius:999px',
        'background:var(--accent)',
        'box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 14%,transparent)',
        'margin:6px 0',
        'pointer-events:none',
      ].join(';')
      root.appendChild(indicator)
      return indicator
    }

    function updateTarget(clientY: number) {
      const cards = sectionCards()
      if (!cards.length) return
      const ownCard = cardRef.current
      let nextIdx = cards.length
      for (let i = 0; i < cards.length; i += 1) {
        const rect = cards[i].getBoundingClientRect()
        if (clientY < rect.top + rect.height / 2) {
          nextIdx = i
          break
        }
      }
      targetIdx = nextIdx

      const line = ensureIndicator()
      if (!line) return
      const beforeCard = cards[nextIdx]
      if (beforeCard) beforeCard.parentElement?.before(line)
      else cards[cards.length - 1].parentElement?.after(line)
      if (ownCard) ownCard.style.opacity = '0.45'
    }

    function beginDrag(ev: PointerEvent) {
      didDrag = true
      setSectionDragging(true)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'
      updateTarget(ev.clientY)
    }

    function onMove(ev: PointerEvent) {
      if (!didDrag) {
        if (Math.hypot(ev.clientX - downX, ev.clientY - downY) < 4) return
        beginDrag(ev)
        return
      }
      updateTarget(ev.clientY)
    }

    function onUp() {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      try { targetEl.releasePointerCapture?.(pointerId) } catch {}
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      cardRef.current?.style.removeProperty('opacity')
      indicator?.remove()
      indicator = null
      setSectionDragging(false)

      if (!didDrag) {
        // Article mode: plain click opens the block popover, shift-click selects.
        // Other modes keep the original select-on-click behaviour.
        if (isArticleMode && !nativeEvent.shiftKey) setBlockMenuOpen(o => !o)
        else sectionSel.toggle(sectionId, nativeEvent.shiftKey)
        return
      }

      if (targetIdx < 0) return
      const isMultiDrag = sectionSel.has(sectionId) && sectionSel.size() > 1
      if (isMultiDrag) moveSelectedSectionsTo(sectionId, targetIdx)
      else moveSectionTo(targetIdx)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
  }

  function startFreeMove(e: React.PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const targetEl = e.currentTarget as HTMLElement
    const pointerId = e.pointerId
    try { targetEl.setPointerCapture?.(pointerId) } catch {}
    const nativeEvent = e.nativeEvent
    let didDrag = false
    const downX = e.clientX, downY = e.clientY

    function onMM(ev: PointerEvent) {
      if (!didDrag && Math.hypot(ev.clientX - downX, ev.clientY - downY) > 4) {
        didDrag = true
        document.removeEventListener('pointermove', onMM)
        document.removeEventListener('pointerup',   onMU)
        document.removeEventListener('pointercancel', onMU)
        beginDrag()
      }
    }
    function onMU() {
      document.removeEventListener('pointermove', onMM)
      document.removeEventListener('pointerup',   onMU)
      document.removeEventListener('pointercancel', onMU)
      try { targetEl.releasePointerCapture?.(pointerId) } catch {}
      if (!didDrag) sectionSel.toggle(sectionId, nativeEvent.shiftKey)
    }
    document.addEventListener('pointermove', onMM)
    document.addEventListener('pointerup',   onMU)
    document.addEventListener('pointercancel', onMU)

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
      let multiMinX = startBX
      let multiMinY = startBY
      let multiMaxX = startBX + blockW
      let multiMaxY = startBY + blockH
      if (isMultiDrag) {
        sectionSel.setDrag(true)
        canvasEl.querySelectorAll<HTMLElement>('[data-section-card]').forEach(card => {
          const id = card.dataset.sectionId
          if (!id || !sectionSel.has(id)) return
          const wrap = card.parentElement as HTMLElement
          const wr = wrap.getBoundingClientRect()
          const bx = Math.round((wr.left - canvasRect.left) / zoom)
          const by = Math.round((wr.top  - canvasRect.top) / zoom)
          const bw = Math.round(wr.width / zoom)
          const bh = Math.round(wr.height / zoom)
          multiStarts.set(id, { el: wrap, bx, by, prevZ: wrap.style.zIndex })
          multiMinX = Math.min(multiMinX, bx)
          multiMinY = Math.min(multiMinY, by)
          multiMaxX = Math.max(multiMaxX, bx + bw)
          multiMaxY = Math.max(multiMaxY, by + bh)
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

      function onMove(ev: PointerEvent) {
        const dx = (ev.clientX - downX) / zoom
        const dy = (ev.clientY - downY) / zoom
        if (isMultiDrag) {
          const clampedDx = Math.min(CANVAS_W - multiMaxX, Math.max(-multiMinX, dx))
          const clampedDy = Math.min(CANVAS_H - multiMaxY, Math.max(-multiMinY, dy))
          multiStarts.forEach(({ el, bx, by }) => {
            el.style.left = (bx + clampedDx) + 'px'
            el.style.top = (by + clampedDy) + 'px'
          })
          _fitCanvasToSections(canvasEl)
        } else {
          const snap = _computeSnap(canvasEl, sectionId, startBX + dx, startBY + dy, blockW, blockH)
          const clamped = _clampSectionBox(snap.x, snap.y, blockW, blockH)
          wrapEl.style.left = clamped.x + 'px'
          wrapEl.style.top  = clamped.y + 'px'
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
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup',   onUp)
        document.removeEventListener('pointercancel', onUp)
        try { targetEl.releasePointerCapture?.(pointerId) } catch {}
      }

      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup',   onUp)
      document.addEventListener('pointercancel', onUp)
    }
  }

  function startResize(dir: string, e: React.PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const targetEl = e.currentTarget as HTMLElement
    const pointerId = e.pointerId
    try { targetEl.setPointerCapture?.(pointerId) } catch {}
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
    let latest: PointerEvent | null = null

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

    function applyResize(ev: PointerEvent) {
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
        const clamped = _clampResizeBox(dir, nx, ny, nw, nh)
        nx = clamped.x; ny = clamped.y; nw = clamped.w; nh = clamped.h
        current.set(id, { x: nx, y: ny, w: nw, h: nh })
        t.el.style.left = nx + 'px'
        t.el.style.top  = ny + 'px'
        if (resizesWidth)  t.el.style.width  = nw + 'px'
        if (resizesHeight) t.el.style.height = nh + 'px'
      })
      _fitCanvasToSections(canvasEl)
    }

    function onMove(ev: PointerEvent) {
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
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup',   onUp)
      document.removeEventListener('pointercancel', onUp)
      try { targetEl.releasePointerCapture?.(pointerId) } catch {}
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup',   onUp)
    document.addEventListener('pointercancel', onUp)
  }

  useEffect(() => {
    if (!colorPickerOpen) return
    const close = () => setColorPickerOpen(false)
    const id = window.setTimeout(() => document.addEventListener('click', close), 0)
    return () => { window.clearTimeout(id); document.removeEventListener('click', close) }
  }, [colorPickerOpen])

  useEffect(() => {
    if (!blockMenuOpen) return
    const close = () => setBlockMenuOpen(false)
    const id = window.setTimeout(() => document.addEventListener('click', close), 0)
    return () => { window.clearTimeout(id); document.removeEventListener('click', close) }
  }, [blockMenuOpen])

  useEffect(() => { if (!blockMenuOpen) setBlockMenuView('main') }, [blockMenuOpen])

  // Position the block popover like Notion: to the LEFT of the block, its right edge just
  // left of the ⠿ handle so it never overlaps. Anchoring by `right` keeps that true at any
  // width; falls back to the right side only when the left has no room. Height and width
  // are capped to the viewport so it always fits and scrolls internally.
  useLayoutEffect(() => {
    if (!blockMenuOpen) { setBlockMenuPos(null); return }
    function place() {
      const el = dragHandleRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const margin = 12
      const gap = 8
      const menuMinW = 232
      const top = Math.min(Math.max(margin, r.top), Math.max(margin, window.innerHeight - margin - 160))
      const maxHeight = window.innerHeight - top - margin
      const spaceLeft = r.left - gap - margin
      if (spaceLeft >= menuMinW) {
        setBlockMenuPos({ right: window.innerWidth - r.left + gap, top, maxHeight, maxWidth: spaceLeft })
      } else {
        const left = r.right + gap
        setBlockMenuPos({ left, top, maxHeight, maxWidth: window.innerWidth - left - margin })
      }
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [blockMenuOpen])

  function selectedArticleSections() {
    const selected: { node: PMNode; pos: number }[] = []
    const view = _mountedView(editor as unknown as Editor)
    if (!view || !isArticleMode) return selected
    editor.state.doc.forEach((sectionNode, offset) => {
      if (sectionNode.type.name !== 'section') return
      const dom = view.nodeDOM(offset) as HTMLElement | null
      const id = (dom?.querySelector('[data-section-card]') as HTMLElement | null)?.dataset.sectionId
      if (id && sectionSel.has(id)) selected.push({ node: sectionNode, pos: offset })
    })
    return selected
  }

  function articleSelectionOrSelf() {
    if (!isArticleMode || !sectionSel.has(sectionId) || sectionSel.size() <= 1) return null
    const selected = selectedArticleSections()
    return selected.length > 1 ? selected : null
  }

  function createArticleBlockNode(key: string, source?: PMNode | null) {
    const { schema } = editor.state
    const inlineContent = source?.isTextblock ? source.content : Fragment.empty
    if (key === 'paragraph') return schema.nodes.paragraph.create(null, inlineContent)
    if (key === 'h1') return schema.nodes.heading.create({ level: 1 }, inlineContent)
    if (key === 'h2') return schema.nodes.heading.create({ level: 2 }, inlineContent)
    if (key === 'h3') return schema.nodes.heading.create({ level: 3 }, inlineContent)
    if (key === 'blockquote') return schema.nodes.blockquote.create(null, schema.nodes.paragraph.create(null, inlineContent))
    if (key === 'bulletList' || key === 'orderedList') {
      const item = schema.nodes.listItem.create(null, schema.nodes.paragraph.create(null, inlineContent))
      return schema.nodes[key].create(null, item)
    }
    if (key === 'codeBlock') return schema.nodes.codeBlock.create({ language: null }, inlineContent)
    if (key === 'hr') return schema.nodes.horizontalRule.create()
    if (key === 'table') return schema.nodeFromJSON(createTableNode())
    if (key === 'toggle' || key === 'toggleH1' || key === 'toggleH2' || key === 'toggleH3') {
      if (!schema.nodes.toggle) return null
      const title =
        key === 'toggleH1' ? schema.nodes.heading.create({ level: 1 }, inlineContent) :
        key === 'toggleH2' ? schema.nodes.heading.create({ level: 2 }, inlineContent) :
        key === 'toggleH3' ? schema.nodes.heading.create({ level: 3 }, inlineContent) :
        schema.nodes.paragraph.create(null, inlineContent)
      return schema.nodes.toggle.create({ open: true }, title)
    }
    return null
  }

  function insertArticleSectionAfter(key = 'paragraph') {
    if (typeof getPos !== 'function') return
    const pos = getPos()
    if (pos === undefined) return
    const fresh = editor.state.doc.nodeAt(pos)
    if (!fresh) return
    const child = createArticleBlockNode(key)
    if (!child) return
    const section = editor.state.schema.nodes.section.create(null, Fragment.from(child))
    const insertPos = pos + fresh.nodeSize
    const tr = editor.state.tr.insert(insertPos, section)
    const nextSelection = Math.min(insertPos + 2, tr.doc.content.size)
    tr.setSelection(TextSelection.near(tr.doc.resolve(nextSelection)))
    editor.view.dispatch(tr.scrollIntoView())
    sectionSel.clear()
  }

  function convertArticleBlock(key: string) {
    if (key === 'image') {
      addElement('image')
      setBlockMenuOpen(false)
      return
    }
    const selected = articleSelectionOrSelf()
    const tr = editor.state.tr
    if (selected) {
      selected.forEach(({ node: sectionNode, pos }) => {
        const replacement = createArticleBlockNode(key, sectionNode.firstChild)
        if (!replacement) return
        tr.replaceWith(tr.mapping.map(pos + 1), tr.mapping.map(pos + sectionNode.nodeSize - 1), Fragment.from(replacement))
      })
      editor.view.dispatch(tr.scrollIntoView())
      setBlockMenuOpen(false)
      return
    }

    if (typeof getPos !== 'function') return
    const pos = getPos()
    if (pos === undefined) return
    const sectionNode = editor.state.doc.nodeAt(pos)
    if (!sectionNode) return
    const replacement = createArticleBlockNode(key, sectionNode.firstChild)
    if (!replacement) return
    tr.replaceWith(pos + 1, pos + sectionNode.nodeSize - 1, Fragment.from(replacement))
    editor.view.dispatch(tr.scrollIntoView())
    setBlockMenuOpen(false)
  }

  function deleteArticleBlocks() {
    const selected = articleSelectionOrSelf()
    if (selected) {
      const tr = editor.state.tr
      selected.reverse().forEach(({ node: sectionNode, pos }) => {
        const mapped = tr.mapping.map(pos)
        tr.delete(mapped, mapped + sectionNode.nodeSize)
      })
      if (tr.doc.childCount === 0) tr.insert(0, editor.state.schema.nodes.section.create(null, editor.state.schema.nodes.paragraph.create()))
      editor.view.dispatch(tr.scrollIntoView())
      sectionSel.clear()
      setBlockMenuOpen(false)
      return
    }
    deleteNode()
    setBlockMenuOpen(false)
  }

  function duplicateArticleBlocks() {
    const selected = articleSelectionOrSelf()
    if (selected) {
      const insertPos = selected.reduce((max, entry) => Math.max(max, entry.pos + entry.node.nodeSize), 0)
      const copies = selected.map(({ node: sectionNode }) => sectionNode.copy(sectionNode.content))
      const tr = editor.state.tr.insert(insertPos, Fragment.fromArray(copies))
      editor.view.dispatch(tr.scrollIntoView())
      sectionSel.clear()
      setBlockMenuOpen(false)
      return
    }
    duplicateSection()
    setBlockMenuOpen(false)
  }

  function setBlockColor(bgColor: string | null, borderColor: string | null) {
    if (typeof getPos !== 'function') return
    const selected = articleSelectionOrSelf()
    if (selected) {
      const tr = editor.state.tr
      selected.forEach(({ node: sectionNode, pos }) => {
        tr.setNodeMarkup(pos, undefined, { ...sectionNode.attrs, bgColor, borderColor })
      })
      editor.view.dispatch(tr)
      return
    }
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
    const card = cardRef.current
    const canvas = card?.closest('[data-editor-canvas]') as HTMLElement | null
    if (!card || !canvas) return
    const contentEl = card.querySelector('[data-node-view-content]') as HTMLElement | null
    const cardStyle = window.getComputedStyle(card)
    const padX = parseFloat(cardStyle.paddingLeft) + parseFloat(cardStyle.paddingRight)
    const padY = parseFloat(cardStyle.paddingTop) + parseFloat(cardStyle.paddingBottom)
    const borderX = parseFloat(cardStyle.borderLeftWidth) + parseFloat(cardStyle.borderRightWidth)
    const borderY = parseFloat(cardStyle.borderTopWidth) + parseFloat(cardStyle.borderBottomWidth)
    let contentW = 0
    let contentH = 0

    if (contentEl) {
      const contentRect = contentEl.getBoundingClientRect()
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      const includeRect = (r: DOMRect) => {
        if (!r.width && !r.height) return
        minX = Math.min(minX, r.left)
        minY = Math.min(minY, r.top)
        maxX = Math.max(maxX, r.right)
        maxY = Math.max(maxY, r.bottom)
      }

      const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
      let currentNode = walker.nextNode()
      while (currentNode) {
        if (currentNode.nodeType === globalThis.Node.TEXT_NODE && currentNode.textContent?.trim()) {
          const range = document.createRange()
          range.selectNodeContents(currentNode)
          const rects = range.getClientRects()
          for (let i = 0; i < rects.length; i += 1) includeRect(rects[i])
          range.detach()
        } else if (currentNode instanceof HTMLElement) {
          const tag = currentNode.tagName.toLowerCase()
          const isFilledWidget = ['img', 'table', 'hr', 'iframe', 'canvas', 'svg'].includes(tag)
          const isFilledControl = ['input', 'textarea', 'select', 'button'].includes(tag)
          if (isFilledWidget || isFilledControl) {
            includeRect(currentNode.getBoundingClientRect())
          }
        }
        currentNode = walker.nextNode()
      }

      if (Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)) {
        contentW = maxX - contentRect.left
        contentH = maxY - contentRect.top
      }
    }

    const nextW = Math.ceil(contentW + padX + borderX + 32)
    const nextH = Math.ceil(contentH + padY + borderY)
    const current = _clampSectionBox(
      (freshNode.attrs.x as number | null) ?? 0,
      (freshNode.attrs.y as number | null) ?? 0,
      nextW,
      nextH
    )
    const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
      ...freshNode.attrs,
      x: current.x,
      y: current.y,
      w: current.w,
      h: current.h,
    })
    editor.view.dispatch(tr)
    window.requestAnimationFrame(() => {
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
    const { childPos, childSize, togglePos } = handle

    if (togglePos !== undefined) {
      const toggleNode = editor.state.doc.nodeAt(togglePos)
      if (!toggleNode) return
      if (toggleNode.childCount <= 1) {
        // Replace last block with empty paragraph so the toggle stays valid
        const tr = editor.state.tr
        tr.replaceWith(childPos, childPos + childSize, editor.state.schema.nodes.paragraph.create())
        editor.view.dispatch(tr.scrollIntoView())
      } else {
        editor.chain().focus().deleteRange({ from: childPos, to: childPos + childSize }).run()
      }
      return
    }

    const $pos = editor.state.doc.resolve(childPos)
    const parent = $pos.parent
    if (parent.type.name === 'section' && parent.childCount === 1) {
      const sectionStart = childPos - $pos.parentOffset - 1
      editor.chain().focus().deleteRange({ from: sectionStart, to: sectionStart + parent.nodeSize }).run()
    } else {
      editor.chain().focus().deleteRange({ from: childPos, to: childPos + childSize }).run()
    }
  }

  function sectionChildBoundaryFor(sectionPos: number, sectionNode: typeof node, requestedInsertPos?: number) {
    const sectionEnd = sectionPos + sectionNode.nodeSize - 1
    if (typeof requestedInsertPos !== 'number' || requestedInsertPos <= sectionPos || requestedInsertPos >= sectionEnd) {
      return sectionEnd
    }

    let childPos = sectionPos + 1
    for (let i = 0; i < sectionNode.childCount; i++) {
      const child = sectionNode.child(i)
      const childEnd = childPos + child.nodeSize
      if (requestedInsertPos <= childPos) return childPos
      if (requestedInsertPos < childEnd) return childEnd
      childPos = childEnd
    }
    return sectionEnd
  }

  function createTableNode(rows = 3, cols = 3) {
    return {
      type: 'table',
      content: Array.from({ length: rows }, (_, rowIndex) => ({
        type: 'tableRow',
        content: Array.from({ length: cols }, () => ({
          type: rowIndex === 0 ? 'tableHeader' : 'tableCell',
          content: [{ type: 'paragraph' }],
        })),
      })),
    }
  }

  function addElement(key: string, requestedInsertPos?: number) {
    if (!editor || typeof getPos !== 'function') return
    const sectionPos = getPos()
    if (sectionPos === undefined) return
    const freshNode = editor.state.doc.nodeAt(sectionPos)
    if (!freshNode) return
    let elementInsertPos = sectionChildBoundaryFor(sectionPos, freshNode, requestedInsertPos)

    // If the active position (explicit drop target or cursor) is inside a toggle within
    // this section, insert after the current block in that toggle instead of at section level
    const activePos = requestedInsertPos ?? editor.state.selection.$from.pos
    if (activePos > sectionPos && activePos < sectionPos + freshNode.nodeSize) {
      try {
        const $active = editor.state.doc.resolve(activePos)
        for (let d = $active.depth; d >= 1; d--) {
          if ($active.node(d).type.name === 'toggle') {
            elementInsertPos = $active.after(d + 1)
            break
          }
          if ($active.node(d).type.name === 'section') break
        }
      } catch { /* ignore */ }
    }
    if (key === 'image') {
      mediaInsertPosRef.current = elementInsertPos
      setImageInsertAnchor(getImageInsertAnchor(elementInsertPos))
      setMediaUrl('')
      setMediaError(null)
      setImageInsertOpen(true)
      return
    }
    if (key === 'hr') {
      editor.chain().focus().insertContentAt(elementInsertPos, { type: 'horizontalRule' }).run()
      return
    }
    if (key === 'table') {
      editor.chain().focus().insertContentAt(elementInsertPos, createTableNode()).run()
      return
    }
    const nodes: Record<string, object> = {
      paragraph:   { type: 'paragraph' },
      h1:          { type: 'heading', attrs: { level: 1 } },
      h2:          { type: 'heading', attrs: { level: 2 } },
      h3:          { type: 'heading', attrs: { level: 3 } },
      bulletList:  { type: 'bulletList',  content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      orderedList: { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      taskList:    { type: 'taskList',    content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
      codeBlock:   { type: 'codeBlock',   attrs: { language: null } },
      blockquote:  { type: 'blockquote',  content: [{ type: 'paragraph' }] },
      callout:     { type: 'callout',     attrs: { emoji: '💡', color: 'yellow' }, content: [{ type: 'paragraph' }] },
      toggle:      toggleJSON('default'),
      toggleH1:    toggleJSON('h1'),
      toggleH2:    toggleJSON('h2'),
      toggleH3:    toggleJSON('h3'),
    }
    const n = nodes[key]
    if (n) editor.chain().focus().insertContentAt(elementInsertPos, n).run()
  }

  useEffect(() => {
    function onAddElement(e: Event) {
      const detail = (e as CustomEvent<{ key?: string; targetPos?: number }>).detail
      if (!detail?.key) return
      const sectionPos = typeof getPos === 'function' ? getPos() : undefined
      const targetsThisSection = typeof detail.targetPos === 'number' && sectionPos !== undefined
        && detail.targetPos > sectionPos && detail.targetPos < sectionPos + node.nodeSize
      if (!sectionSel.has(sectionId) && !targetsThisSection) return
      addElement(detail.key, targetsThisSection ? detail.targetPos : undefined)
    }
    document.addEventListener('wiki-editor-add-element', onAddElement)
    return () => document.removeEventListener('wiki-editor-add-element', onAddElement)
  }, [sectionId, getPos, node.nodeSize])

  function isElementDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes('application/x-wiki-element')
  }

  function hideDropCursor() {
    editor.view.dom.dispatchEvent(new Event('drop'))
  }

  function getImageInsertAnchor(insertPos: number) {
    const card = cardRef.current
    if (!card) return null
    try {
      const coords = editor.view.coordsAtPos(insertPos)
      const rect = card.getBoundingClientRect()
      const top = Math.min(Math.max(coords.top - rect.top - 8, 12), Math.max(12, rect.height - 48))
      return { left: 16, top }
    } catch {
      return null
    }
  }

  function onElementDragOver(e: React.DragEvent) {
    if (!isElementDrag(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setElementDropTarget(true)
  }

  function onElementDragLeave() {
    setElementDropTarget(false)
    hideDropCursor()
  }

  function onElementDrop(e: React.DragEvent) {
    if (!isElementDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
    const key = e.dataTransfer.getData('application/x-wiki-element')
    setElementDropTarget(false)
    hideDropCursor()
    const dropPos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos
    if (key) addElement(key, dropPos)
    window.requestAnimationFrame(hideDropCursor)
  }

  function resolveMediaInsertPos() {
    if (!editor || typeof getPos !== 'function') return null
    const sectionPos = getPos()
    if (sectionPos === undefined) return null
    const freshNode = editor.state.doc.nodeAt(sectionPos)
    const sectionEnd = freshNode ? sectionPos + freshNode.nodeSize - 1 : sectionPos + node.nodeSize - 1
    const req = mediaInsertPosRef.current
    return typeof req === 'number' && req > sectionPos && req < sectionEnd ? req : sectionEnd
  }

  function insertMediaFromUrl() {
    if (!editor || !mediaUrl.trim()) return
    const insertPos = resolveMediaInsertPos()
    if (insertPos === null) return
    editor.chain().focus()
      .insertContentAt(insertPos, { type: 'image', attrs: { src: mediaUrl.trim(), align: 'center' } })
      .run()
    mediaInsertPosRef.current = null
    setImageInsertAnchor(null)
    setMediaUrl('')
    setImageInsertOpen(false)
  }

  const handleMediaFileUpload = useCallback(async (file: File) => {
    setMediaError(null)
    setMediaUploading(true)
    try {
      const { uploadMedia: upload } = await import('@/lib/supabase/storage')
      const url = await upload(file)
      const insertPos = resolveMediaInsertPos()
      if (insertPos === null || !editor) return
      editor.chain().focus()
        .insertContentAt(insertPos, { type: 'image', attrs: { src: url, align: 'center' } })
        .run()
      mediaInsertPosRef.current = null
      setImageInsertAnchor(null)
      setImageInsertOpen(false)
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
    } finally {
      setMediaUploading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

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
  const isArticleMode = editor.state.doc.attrs.wikiMode === 'article'

  useEffect(() => {
    const canvas = document.querySelector('[data-editor-canvas]') as HTMLElement | null
    if (canvas) _fitCanvasToSections(canvas)
  }, [canvasX, canvasY, canvasW, canvasH])

  return (
    <NodeViewWrapper
      style={isCanvasBlock ? {
        position: 'absolute',
        top: 0, right: 0, bottom: 0, left: 0,
        pointerEvents: 'none',
        margin: 0,
      } : {
        position: 'relative',
        margin: isArticleMode ? 0 : '0 0 12px',
      }}
    >
      <div
        style={isCanvasBlock ? {
          position: 'absolute',
          pointerEvents: 'auto',
          margin: 0,
          left: canvasX !== null ? `${canvasX}px` : undefined,
          top: canvasY !== null ? `${canvasY}px` : undefined,
          width: canvasW !== null ? `${canvasW}px` : 'fit-content',
          height: canvasH !== null ? `${canvasH}px` : undefined,
          zIndex: imageInsertOpen || colorPickerOpen || sectionDragging || resizing ? 100 : (canvasZ ?? undefined),
        } : {}}
      >
      <div
        ref={cardRef}
        data-section-card="true"
        data-section-id={sectionId}
        onMouseEnter={() => setCardHovered(true)}
        onMouseMove={onMouseMove}
        onMouseLeave={() => { setCardHovered(false); if (!dragRef.current) setHandle(null) }}
        onDragOver={onElementDragOver}
        onDragLeave={onElementDragLeave}
        onDrop={onElementDrop}
        style={{
          background: isArticleMode ? (bgColor ?? 'transparent') : (bgColor ?? 'var(--surface)'),
          border: isArticleMode ? `1px solid ${borderColor ?? 'transparent'}` : `1px solid ${borderColor ?? 'var(--border)'}`,
          borderRadius: isArticleMode ? 0 : '12px',
          padding: isArticleMode ? (editable ? '3px 0 3px 44px' : '3px 0') : (editable ? '42px 28px 16px 44px' : '20px 28px 16px 44px'),
          position: 'relative',
          width: isArticleMode ? '100%' : (canvasW === null && isCanvasBlock ? 'fit-content' : undefined),
          minWidth: isArticleMode ? 0 : `${MIN_SECTION_W}px`,
          maxWidth: canvasW === null && isCanvasBlock ? `${MAX_AUTO_SECTION_W}px` : undefined,
          height: canvasH !== null ? '100%' : undefined,
          minHeight: isArticleMode ? 0 : `${MIN_SECTION_H}px`,
          boxSizing: 'border-box',
          overflow: 'visible',
          display: canvasH !== null ? 'flex' : undefined,
          flexDirection: canvasH !== null ? 'column' : undefined,
          outline: elementDropTarget
            ? '2px solid var(--accent)'
            : (!isArticleMode && (isSelected || isEditorActive) ? '2px solid var(--accent)' : 'none'),
          outlineOffset: isArticleMode ? '0' : (elementDropTarget ? '4px' : '2px'),
          boxShadow: elementDropTarget
            ? '0 18px 42px rgba(0,0,0,0.16), 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent)'
            : (!isArticleMode && isEditorActive)
              ? '0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent)'
              : undefined,
          cursor: resizing ? 'inherit' : (dragging ? 'grabbing' : undefined),
          transition: sectionDragging || resizing ? undefined : 'outline 0.1s, box-shadow 0.12s',
        }}
      >
        {/* Handle buttons: ⠿ drag + ✕ delete.
            In article mode each section holds a single block, so the section-level
            controls already cover move/delete — only show the per-element handle for
            toggle children (multi-child container) to avoid duplicate ⠿ icons. */}
        {editable && handle && !dragging && (!isArticleMode || handle.togglePos !== undefined) && (
          <div style={{
            position: 'absolute',
            left: 4, top: handle.top, height: handle.height,
            display: 'flex', alignItems: 'center', gap: '1px', zIndex: 10,
          }}>
            <div
              title="Verschieben"
              onPointerDown={startDrag}
              style={{ cursor: 'grab', color: 'var(--muted)', fontSize: '13px', padding: '3px 2px', borderRadius: '3px', lineHeight: 1, userSelect: 'none', touchAction: 'none' }}
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

        {/* Section / article block controls */}
        {editable && (
          <div
            className="wiki-section-delete"
            data-article-block-controls="true"
            style={{
              position: 'absolute',
              // Callout boxes have border + inner padding, so their first text line
              // sits lower than a plain block's — shift the controls down to match.
              top: isArticleMode ? (node.childCount > 0 && node.child(0).type.name === 'callout' ? 19 : 3) : 8,
              right: isArticleMode ? undefined : 8,
              left: isArticleMode ? 2 : undefined,
              display: 'flex',
              alignItems: 'center',
              gap: '1px',
              opacity: cardHovered || colorPickerOpen || blockMenuOpen ? 1 : 0,
              transition: 'opacity 0.1s',
            }}
          >
            {isArticleMode && (
              <button
                title="Block darunter einfügen"
                onMouseDown={e => e.preventDefault()}
                onClick={e => { e.stopPropagation(); insertArticleSectionAfter() }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: '16px',
                  width: '20px', height: '24px', borderRadius: '5px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'inherit', lineHeight: 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)' }}
              >
                +
              </button>
            )}

            {/* Drag handle — drag to move, click opens the block popover (article) */}
            <div style={{ position: 'relative' }}>
              <div
                ref={dragHandleRef}
                data-section-drag-handle="true"
                title={isArticleMode ? 'Ziehen zum Verschieben · Klick für Menü · Shift-Klick zum Auswählen' : 'Block verschieben / klicken zum Auswählen'}
                onPointerDown={handleSectionDragDown}
                onClick={e => e.stopPropagation()}
                style={{
                  cursor: 'grab', color: 'var(--muted)', fontSize: '14px',
                  width: isArticleMode ? '20px' : '26px',
                  height: isArticleMode ? '24px' : '26px',
                  borderRadius: '5px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  userSelect: 'none', lineHeight: 1, touchAction: 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)' }}
              >
                {/* Braille glyph only fills the upper part of its em box (dots 7/8
                    empty) and looks too high next to “+” — nudge it down optically. */}
                <span style={{ display: 'block', transform: 'translateY(1.5px)' }}>⠿</span>
              </div>

              {isArticleMode && blockMenuOpen && blockMenuPos && createPortal(
                <div
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                  style={{
                    position: 'fixed',
                    left: blockMenuPos.left,
                    right: blockMenuPos.right,
                    top: blockMenuPos.top,
                    zIndex: 360,
                    minWidth: 220,
                    maxWidth: blockMenuPos.maxWidth,
                    maxHeight: blockMenuPos.maxHeight,
                    overflowY: 'auto',
                    padding: 6,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
                  }}
                >
                  {blockMenuView === 'main' && (
                    <>
                      <button type="button" style={articleMenuRowStyle} onClick={() => setBlockMenuView('turn')}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <span style={{ width: 20, color: 'var(--accent)', fontWeight: 800 }}>⇄</span>
                        Umwandeln in
                        <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>›</span>
                      </button>
                      <button type="button" style={articleMenuRowStyle} onClick={() => setBlockMenuView('color')}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <span style={{
                          width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
                          backgroundColor: bgColor === 'transparent' ? 'transparent' : (bgColor ?? 'var(--surface)'),
                          border: `2.5px solid ${borderColor === 'transparent' ? 'transparent' : (borderColor ?? 'var(--border)')}`,
                          outline: '1.5px solid var(--border)', outlineOffset: '1px', marginLeft: 3, marginRight: 3,
                        }} />
                        Farbe
                        <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>›</span>
                      </button>
                      <div style={{ height: 1, margin: '6px 0', background: 'var(--border)' }} />
                      <button type="button" onClick={duplicateArticleBlocks} style={articleMenuButtonStyle}>Duplizieren</button>
                      <button type="button" onClick={deleteArticleBlocks} style={{ ...articleMenuButtonStyle, color: 'var(--accent2)' }}>Loeschen</button>
                    </>
                  )}

                  {blockMenuView === 'turn' && (
                    <>
                      <button type="button" style={articleMenuBackStyle} onClick={() => setBlockMenuView('main')}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <span style={{ color: 'var(--muted)' }}>‹</span> Umwandeln in
                      </button>
                      <div style={{ height: 1, margin: '4px 0 2px', background: 'var(--border)' }} />
                      {ELEMENT_PALETTE.map((item, index) => (
                        <div key={item.key}>
                          {(index === 0 || ELEMENT_PALETTE[index - 1].group !== item.group) && (
                            <div style={{ padding: '5px 7px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0 }}>{item.group}</div>
                          )}
                          <button
                            type="button"
                            onClick={() => convertArticleBlock(item.key)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              width: '100%', textAlign: 'left', padding: '7px 9px',
                              border: 0, borderRadius: 6, background: 'transparent',
                              color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          >
                            <span style={{ width: 28, color: 'var(--accent)', fontWeight: 800, fontSize: item.icon.length > 2 ? 9 : 11 }}>{item.icon}</span>
                            {item.label}
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {blockMenuView === 'color' && (
                    <>
                      <button type="button" style={articleMenuBackStyle} onClick={() => setBlockMenuView('main')}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <span style={{ color: 'var(--muted)' }}>‹</span> Farbe
                      </button>
                      <div style={{ height: 1, margin: '4px 0 2px', background: 'var(--border)' }} />
                      <div style={{ padding: '2px 7px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0 }}>HINTERGRUND</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '0 7px 6px' }}>
                        {/* In article mode the default (Standard/null) already renders transparent,
                            so the explicit Transparent swatch would be a duplicate — drop it. */}
                        {BG_COLORS.filter(c => c.value !== 'transparent').map(c => (
                          <button
                            key={c.label}
                            title={c.label}
                            onClick={() => setBlockColor(c.value, borderColor)}
                            style={{
                              width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer',
                              backgroundColor: c.style, border: '2px solid',
                              borderColor: bgColor === c.value ? 'var(--accent)' : (c.value === null || c.value === 'transparent' ? 'var(--border)' : 'transparent'),
                              outline: bgColor === c.value ? '2px solid var(--accent)' : 'none',
                              outlineOffset: '1px', padding: 0, boxSizing: 'border-box',
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ padding: '2px 7px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0 }}>RAHMEN</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '0 7px 6px' }}>
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
                              outlineOffset: '1px', padding: 0, boxSizing: 'border-box',
                            }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>,
                document.body
              )}
            </div>

            {/* Color picker toggle (canvas only; article folds colour into the ⠿ menu) */}
            {!isArticleMode && (
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
                  backgroundColor: bgColor === 'transparent' ? 'transparent' : (bgColor ?? 'var(--surface)'),
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
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: isArticleMode ? undefined : 0,
                    left: isArticleMode ? 0 : undefined,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '10px', padding: '10px 12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    zIndex: 300, minWidth: '200px',
                  }}
                >
                  <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--muted)', letterSpacing: 0, marginBottom: '6px' }}>HINTERGRUND</div>
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
                  <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--muted)', letterSpacing: 0, marginBottom: '6px' }}>RAHMEN</div>
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
            )}

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
                title="Größe an Inhalt anpassen"
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

            {/* Delete */}
            {!isArticleMode && (
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
            )}
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
                touchAction: 'none',
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
                  onPointerDown={e => startResize(dir, e)}
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

        {editable && imageInsertOpen && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            ...(imageInsertAnchor
              ? {
                  position: 'absolute' as const,
                  top: imageInsertAnchor.top,
                  left: imageInsertAnchor.left,
                  right: 16,
                  zIndex: 420,
                  padding: '8px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
                }
              : { marginTop: '12px', flexShrink: 0 })}}
          >
            {/* Hidden file input */}
            <input
              ref={mediaFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaFileUpload(f); e.target.value = '' }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                autoFocus
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') insertMediaFromUrl(); if (e.key === 'Escape') { mediaInsertPosRef.current = null; setImageInsertAnchor(null); setImageInsertOpen(false) } }}
                placeholder="Bild-URL oder Datei wählen"
                style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit', outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
              />
              <button
                onClick={() => mediaFileInputRef.current?.click()}
                disabled={mediaUploading}
                title="Vom Gerät hochladen"
                style={{ padding: '6px 10px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {mediaUploading ? '…' : '↑ Hochladen'}
              </button>
              <button onClick={insertMediaFromUrl} disabled={!mediaUrl.trim()} style={{ padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 }}>OK</button>
              <button onClick={() => { mediaInsertPosRef.current = null; setImageInsertAnchor(null); setImageInsertOpen(false); setMediaError(null) }} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>
            {mediaError && <div style={{ fontSize: '11px', color: '#ef4444' }}>{mediaError}</div>}
          </div>
        )}
      </div>

      </div>
    </NodeViewWrapper>
  )
}

export { sectionSel }

export const SectionExtension = Node.create({
  name: 'section',
  priority: 1000,
  group: 'block',
  content: 'block+',
  defining: true,

  addProseMirrorPlugins() {
    let draggedTextSelection: { from: number; to: number; slice: Slice } | null = null

    return [
      new Plugin({
        props: {
          dragCopies: () => false,
          handleDOMEvents: {
            dragstart(view, event) {
              const dragEvent = event as DragEvent
              if (Array.from(dragEvent.dataTransfer?.types ?? []).includes('application/x-wiki-element')) return false
              const { selection } = view.state
              if (!(selection instanceof TextSelection) || selection.empty) {
                draggedTextSelection = null
                return false
              }
              draggedTextSelection = {
                from: selection.from,
                to: selection.to,
                slice: selection.content(),
              }
              return false
            },
            dragend() {
              draggedTextSelection = null
              return false
            },
            drop(view, event) {
              const dragEvent = event as DragEvent
              if (!Number.isFinite(dragEvent.clientX) || !Number.isFinite(dragEvent.clientY)) {
                dragEvent.preventDefault()
                return true
              }
              if (!draggedTextSelection) return false
              if (Array.from(dragEvent.dataTransfer?.types ?? []).includes('application/x-wiki-element')) return false
              const eventPos = view.posAtCoords({ left: dragEvent.clientX, top: dragEvent.clientY })
              if (!eventPos) return false

              const { from, to, slice } = draggedTextSelection
              draggedTextSelection = null
              const rawInsertPos = dropPoint(view.state.doc, eventPos.pos, slice) ?? eventPos.pos
              if (rawInsertPos >= from && rawInsertPos <= to) {
                dragEvent.preventDefault()
                return true
              }

              dragEvent.preventDefault()
              const tr = view.state.tr
              tr.delete(from, to)
              const insertPos = tr.mapping.map(rawInsertPos, -1)
              tr.replaceRange(insertPos, insertPos, slice)
              view.dispatch(tr.scrollIntoView())
              return true
            },
          },
        },
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      'Shift-Enter': () => {
        const isArticleMode = this.editor.state.doc.attrs.wikiMode === 'article'
        if (!isArticleMode) return false
        return this.editor.commands.setHardBreak()
      },
      Backspace: () => {
        if (this.editor.state.doc.attrs.wikiMode !== 'article') return false
        const { state, view } = this.editor
        const { $from, empty } = state.selection
        if (!empty || !$from.parent.isTextblock || $from.parentOffset !== 0) return false
        const sectionDepth = $from.depth - 1
        if (sectionDepth < 0 || $from.node(sectionDepth).type.name !== 'section') return false
        const sectionPos = $from.before(sectionDepth)
        const sectionNode = state.doc.nodeAt(sectionPos)
        if (!sectionNode) return false

        // for-Schleife statt doc.forEach: Zuweisungen in Callbacks verfolgt
        // TS nicht, previous waere nach dem null-Check sonst `never`
        let previous: { node: PMNode; pos: number } | null = null
        for (let i = 0, offset = 0; i < state.doc.childCount; i++) {
          const candidate = state.doc.child(i)
          if (candidate.type.name === 'section' && offset < sectionPos) previous = { node: candidate, pos: offset }
          offset += candidate.nodeSize
        }
        if (!previous) return false

        const tr = state.tr
        if ($from.parent.textContent === '' && sectionNode.childCount === 1) {
          tr.delete(sectionPos, sectionPos + sectionNode.nodeSize)
          tr.setSelection(TextSelection.near(tr.doc.resolve(Math.max(1, tr.mapping.map(previous.pos + previous.node.nodeSize - 1))), -1))
          view.dispatch(tr.scrollIntoView())
          return true
        }

        const mergedChildren: PMNode[] = []
        previous.node.forEach(child => mergedChildren.push(child))
        sectionNode.forEach(child => mergedChildren.push(child))
        tr.replaceWith(previous.pos + 1, previous.pos + previous.node.nodeSize - 1, Fragment.fromArray(mergedChildren))
        const mappedSectionPos = tr.mapping.map(sectionPos)
        tr.delete(mappedSectionPos, mappedSectionPos + sectionNode.nodeSize)
        tr.setSelection(TextSelection.near(tr.doc.resolve(Math.max(1, tr.mapping.map(previous.pos + previous.node.nodeSize - 1))), -1))
        view.dispatch(tr.scrollIntoView())
        return true
      },
      Enter: () => {
        const { $from } = this.editor.state.selection
        const parentType = $from.parent.type.name
        // Only intercept Enter when the cursor's textblock is a DIRECT child of a
        // section — not when it's nested inside a toggle, blockquote, list, etc.
        const immediateContainer = $from.depth > 0 ? $from.node($from.depth - 1) : null

        if (
          !$from.parent.isTextblock ||
          parentType === 'codeBlock' ||
          !immediateContainer ||
          immediateContainer.type.name !== 'section'
        ) return false

        if (this.editor.state.doc.attrs.wikiMode === 'article') {
          const { state, view } = this.editor
          const sectionPos = $from.before($from.depth - 1)
          const sectionNode = state.doc.nodeAt(sectionPos)
          if (!sectionNode) return false
          const nextSection = state.schema.nodes.section.create(null, state.schema.nodes.paragraph.create())
          const insertPos = sectionPos + sectionNode.nodeSize
          const tr = state.tr.insert(insertPos, nextSection)
          tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(insertPos + 2, tr.doc.content.size))))
          view.dispatch(tr.scrollIntoView())
          return true
        }

        if (!this.editor.commands.setHardBreak()) return false

        // Copy the carried text-style marks onto the break node itself: stored
        // marks die with the next click, but marks on the hardBreak keep feeding
        // $from.marks() whenever the cursor returns to the new line.
        {
          const { state, view } = this.editor
          const $from = state.selection.$from
          const brPos = $from.pos - 1
          const brNode = brPos >= 0 ? state.doc.nodeAt(brPos) : null
          const marks = state.storedMarks ?? $from.marks()
          if (brNode?.type.name === 'hardBreak' && marks.length) {
            view.dispatch(marks.reduce((tr, mark) => tr.addMark(brPos, brPos + 1, mark), state.tr))
          }
        }

        const { state, view } = this.editor
        const currentFrom = state.selection.$from
        for (let depth = currentFrom.depth; depth >= 0; depth--) {
          const section = currentFrom.node(depth)
          if (section.type.name !== 'section' || section.attrs.h === null) continue
          const sectionPos = currentFrom.before(depth)
          view.dispatch(state.tr.setNodeMarkup(sectionPos, undefined, { ...section.attrs, h: null }))
          break
        }
        return true
      },
    }
  },

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
