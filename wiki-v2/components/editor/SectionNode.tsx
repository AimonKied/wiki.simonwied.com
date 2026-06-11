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
  const [handle, setHandle] = useState<HandleInfo | null>(null)
  const [dragging, setDragging] = useState(false)
  const [sectionDragging, setSectionDragging] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [imageMode, setImageMode] = useState(false)
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

      origEl.style.position    = 'absolute'
      origEl.style.top         = `${rect.top - cardRect2.top}px`
      origEl.style.left        = `${rect.left - cardRect2.left}px`
      origEl.style.width       = `${rect.width}px`
      origEl.style.opacity     = '0'
      origEl.style.pointerEvents = 'none'
      origEl.style.zIndex      = '-1'

      const lastTops = siblings.map(el => el ? el.getBoundingClientRect().top : 0)
      siblings.forEach((el, i) => {
        if (!el || i === handle.childIdx) return
        const delta = firstTops[i] - lastTops[i]
        el.style.transition = 'none'
        el.style.transform  = delta ? `translateY(${delta}px)` : 'translateY(0)'
      })

      const fromIdxForPlay = handle.childIdx
      const ghHForPlay     = ghostHRef.current
      requestAnimationFrame(() => {
        siblings.forEach((el, i) => {
          if (!el || i === fromIdxForPlay) return
          el.style.transition = 'transform 0.18s cubic-bezier(0.2,0,0,1)'
          el.style.transform  = i >= fromIdxForPlay ? `translateY(${ghHForPlay}px)` : 'translateY(0)'
        })
      })

      // Source slot indicator
      const slot = document.createElement('div')
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

      // Ghost always follows cursor — position:absolute inside source card, no overflow clipping
      if (ghostRef.current) {
        ghostRef.current.style.top = `${ev.clientY - ghostOffY.current - cardTopRef.current}px`
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

        // Shift siblings to open gap at dropIdx
        siblingsRef.current.forEach((el, i) => {
          if (i === fromIdx) return
          el.style.transform = i >= dropIdx ? `translateY(${ghH}px)` : 'translateY(0)'
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
            `background:rgba(0,153,85,0.06)`,
            `border:1.5px solid rgba(0,153,85,0.3)`,
            `pointer-events:none`,
            `z-index:8`,
            `transition:top 0.18s cubic-bezier(0.2,0,0,1)`,
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

  function startSectionDrag(e: React.MouseEvent) {
    if (!cardRef.current || typeof getPos !== 'function') return
    e.preventDefault()
    e.stopPropagation()

    const sectionPos = getPos() as number
    if (!editor.state.doc.nodeAt(sectionPos)) return

    const cardEl = cardRef.current
    const cardRect = cardEl.getBoundingClientRect()
    const offsetY = e.clientY - cardRect.top

    // All section cards and their NodeViewWrapper parents
    const allCardEls = Array.from(document.querySelectorAll('[data-section-card]')) as HTMLElement[]
    const allWrappers = allCardEls.map(c => c.parentElement as HTMLElement)
    const sourceIdx = allCardEls.indexOf(cardEl)
    if (sourceIdx === -1) return

    // Snapshot rects before any DOM changes
    const initialRects = allWrappers.map(w => w.getBoundingClientRect())

    // Height of source slot = distance from this wrapper top to next wrapper top
    const slotHeight = sourceIdx < allWrappers.length - 1
      ? initialRects[sourceIdx + 1].top - initialRects[sourceIdx].top
      : initialRects[sourceIdx].height + 12

    // Enable transitions on all non-source wrappers
    allWrappers.forEach((w, i) => {
      if (i !== sourceIdx) w.style.transition = 'transform 0.18s cubic-bezier(0.2,0,0,1)'
    })

    // Ghost: fixed clone following cursor
    const ghost = cardEl.cloneNode(true) as HTMLElement
    ghost.style.cssText = [
      `position:fixed`,
      `top:${cardRect.top}px`,
      `left:${cardRect.left}px`,
      `width:${cardRect.width}px`,
      `opacity:0.92`,
      `pointer-events:none`,
      `z-index:9999`,
      `box-shadow:0 16px 48px rgba(0,0,0,0.24),0 0 0 1px var(--border)`,
      `transform:scale(1.02)`,
      `border-radius:12px`,
    ].join(';')
    document.body.appendChild(ghost)

    // Slot: green outlined box at drop target position
    const slot = document.createElement('div')
    slot.style.cssText = [
      `position:fixed`,
      `left:${cardRect.left}px`,
      `width:${cardRect.width}px`,
      `height:${cardRect.height}px`,
      `border-radius:12px`,
      `background:rgba(0,153,85,0.05)`,
      `border:2px dashed rgba(0,153,85,0.4)`,
      `pointer-events:none`,
      `z-index:9997`,
      `display:none`,
      `transition:top 0.18s cubic-bezier(0.2,0,0,1)`,
      `box-sizing:border-box`,
    ].join(';')
    document.body.appendChild(slot)

    setSectionDragging(true)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'

    let dropBeforeIdx = -1
    let lastDropIdx = -2 // force first evaluation

    function applyShifts(dropIdx: number) {
      allWrappers.forEach((wrapper, i) => {
        if (i === sourceIdx) return
        let shift = 0
        if (dropIdx <= sourceIdx) {
          if (i >= dropIdx && i < sourceIdx) shift = slotHeight
        } else {
          if (i > sourceIdx && i < dropIdx) shift = -slotHeight
        }
        wrapper.style.transform = shift ? `translateY(${shift}px)` : 'translateY(0)'
      })

      // Calculate slot top in viewport coords
      let slotTop: number
      if (dropIdx <= sourceIdx) {
        slotTop = initialRects[dropIdx].top
      } else {
        const prevIdx = dropIdx - 1
        const prevShift = prevIdx > sourceIdx ? -slotHeight : 0
        slotTop = initialRects[prevIdx].bottom + prevShift
      }
      slot.style.display = 'block'
      slot.style.top = `${slotTop}px`
    }

    function resetShifts() {
      allWrappers.forEach((w, i) => {
        if (i !== sourceIdx) w.style.transform = 'translateY(0)'
      })
      slot.style.display = 'none'
    }

    function onMove(ev: MouseEvent) {
      ghost.style.top = `${ev.clientY - offsetY}px`

      let newDropIdx = allCardEls.length
      for (let i = 0; i < allCardEls.length; i++) {
        if (ev.clientY < initialRects[i].top + initialRects[i].height / 2) {
          newDropIdx = i
          break
        }
      }

      if (newDropIdx === lastDropIdx) return
      lastDropIdx = newDropIdx

      if (newDropIdx === sourceIdx || newDropIdx === sourceIdx + 1) {
        resetShifts()
        dropBeforeIdx = -1
      } else {
        applyShifts(newDropIdx)
        dropBeforeIdx = newDropIdx
      }
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      ghost.parentNode?.removeChild(ghost)
      slot.parentNode?.removeChild(slot)
      allWrappers.forEach(w => { w.style.transform = ''; w.style.transition = '' })
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      setSectionDragging(false)
      if (dropBeforeIdx >= 0) moveSectionTo(dropBeforeIdx)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
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

  return (
    <NodeViewWrapper style={{ margin: '0 0 12px', position: 'relative', zIndex: pickerOpen || imageMode || colorPickerOpen ? 100 : undefined }}>
      <div
        ref={cardRef}
        data-section-card="true"
        onMouseMove={onMouseMove}
        onMouseLeave={() => { if (!dragRef.current) setHandle(null) }}
        style={{
          background: bgColor ?? 'var(--surface)',
          border: `1px solid ${borderColor ?? 'var(--border)'}`,
          borderRadius: '12px',
          padding: '20px 28px 16px 44px',
          position: 'relative',
          outline: 'none',
          cursor: dragging ? 'grabbing' : undefined,
          opacity: sectionDragging ? 0.08 : undefined,
          transition: sectionDragging ? undefined : 'opacity 0.15s',
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
                          background: c.style, border: '2px solid',
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
                          background: c.style, border: '2px solid',
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

            {/* Drag handle */}
            <div
              title="Block verschieben"
              onMouseDown={startSectionDrag}
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

export const SectionExtension = Node.create({
  name: 'section',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      bgColor:     { default: null, parseHTML: el => el.getAttribute('data-bg')     || null },
      borderColor: { default: null, parseHTML: el => el.getAttribute('data-border') || null },
    }
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs: Record<string, string> = {}
    if (node.attrs.bgColor)     attrs['data-bg']     = node.attrs.bgColor
    if (node.attrs.borderColor) attrs['data-border'] = node.attrs.borderColor
    return ['section', mergeAttributes(HTMLAttributes, attrs), 0]
  },

  parseHTML() {
    return [{ tag: 'section' }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SectionView)
  },
})
