'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import React, { useState, useEffect, useRef } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { Mark, mergeAttributes } from '@tiptap/core'
import { Fragment } from '@tiptap/pm/model'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import Document from '@tiptap/extension-document'
import ImageExt from '@tiptap/extension-image'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import { createLowlight } from 'lowlight'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import sql from 'highlight.js/lib/languages/sql'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import java from 'highlight.js/lib/languages/java'
import markdown from 'highlight.js/lib/languages/markdown'
import { SectionExtension, sectionSel } from './SectionNode'

const lowlight = createLowlight()
lowlight.register({ javascript, typescript, python, bash, css, xml, json, sql, go, rust, java, markdown })

const SectionDocument = Document.extend({
  content: 'section+',
})

const TEXT_STYLE_MARK = 'wikiTextStyle'
const EDITOR_SCHEMA_VERSION = 2

const TextStyle = Mark.create({
  name: TEXT_STYLE_MARK,

  addAttributes() {
    return {
      fontFamily: { default: null, parseHTML: element => element.style.fontFamily || null },
      fontSize: { default: null, parseHTML: element => element.style.fontSize || null },
      color: { default: null, parseHTML: element => element.style.color || null },
      backgroundColor: { default: null, parseHTML: element => element.style.backgroundColor || null },
    }
  },

  parseHTML() {
    return [{ tag: 'span[style]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { fontFamily, fontSize, color, backgroundColor, ...attributes } = HTMLAttributes
    const styles = [
      fontFamily && `font-family:${fontFamily}`,
      fontSize && `font-size:${fontSize}`,
      color && `color:${color}`,
      backgroundColor && `background-color:${backgroundColor}`,
    ].filter(Boolean).join(';')
    return ['span', mergeAttributes(attributes, { style: styles }), 0]
  },
})

const FONT_FAMILIES = [
  { label: 'Standard', value: null },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times', value: '"Times New Roman", serif' },
  { label: 'Monospace', value: 'monospace' },
]

const FONT_SIZES = ['12px', '14px', '15px', '16px', '18px', '19px', '24px', '26px', '32px', '40px', '48px']

const ELEMENT_PALETTE = [
  { key: 'paragraph',   label: 'Text',          icon: '¶',   description: 'Normaler Text' },
  { key: 'h1',          label: 'Überschrift 1', icon: 'H1',  description: 'Große Überschrift' },
  { key: 'h2',          label: 'Überschrift 2', icon: 'H2',  description: 'Mittlere Überschrift' },
  { key: 'h3',          label: 'Überschrift 3', icon: 'H3',  description: 'Kleine Überschrift' },
  { key: 'bulletList',  label: 'Liste',         icon: '•',   description: 'Aufzählung' },
  { key: 'orderedList', label: 'Nummeriert',    icon: '1.',  description: 'Nummerierte Liste' },
  { key: 'codeBlock',   label: 'Code',          icon: '</>', description: 'Codeblock' },
  { key: 'blockquote',  label: 'Zitat',         icon: '"',   description: 'Hervorgehobenes Zitat' },
  { key: 'hr',          label: 'Trennlinie',    icon: '—',   description: 'Horizontale Linie' },
  { key: 'table',       label: 'Tabelle',       icon: '⊞',   description: 'Tabelle mit 3 × 3 Zellen' },
  { key: 'image',       label: 'Bild',          icon: '▧',   description: 'Bild über URL' },
]

interface SlashMenuState {
  from: number
  to: number
  query: string
  left: number
  top: number
  selected: number
}

interface MinimapBlock {
  id: string
  x: number
  y: number
  w: number
  h: number
}

interface MinimapViewport {
  w: number
  h: number
}

interface MinimapBounds {
  x: number
  y: number
  w: number
  h: number
}

interface MinimapDragState {
  grabOffsetX: number
  grabOffsetY: number
}

const CANVAS_W = 9000
const CANVAS_H = 4000
const CANVAS_CENTER_X = CANVAS_W / 2
const CANVAS_CENTER_Y = CANVAS_H / 2
const MINIMAP_PADDING = 420

function getSlashItems(query: string) {
  const normalized = query.trim().toLocaleLowerCase('de')
  if (!normalized) return ELEMENT_PALETTE
  return ELEMENT_PALETTE.filter(item =>
    `${item.label} ${item.description} ${item.key}`.toLocaleLowerCase('de').includes(normalized)
  )
}

// Wrap flat content (old notes) in a section so it renders as a card.
// Sections without stored position render in normal flow first; the layout-pass
// effect below converts them to canvas coordinates once real heights are known.
function ensureSections(content: object | null | undefined): object | string {
  if (!content || typeof content !== 'object') return ''
  const doc = content as { type?: string; content?: Array<{ type: string }> }
  if (!doc.content?.length) return ''
  if (doc.content.every(n => n.type === 'section')) return content

  const sections: Array<{ type: string; content?: Array<{ type: string }> }> = []
  let looseBlocks: Array<{ type: string }> = []
  const flushLooseBlocks = () => {
    if (!looseBlocks.length) return
    sections.push({ type: 'section', content: looseBlocks })
    looseBlocks = []
  }

  doc.content.forEach(node => {
    if (node.type === 'section') {
      flushLooseBlocks()
      sections.push(node)
    } else {
      looseBlocks.push(node)
    }
  })
  flushLooseBlocks()
  return { ...doc, content: sections }
}

function nextSectionZ(editor: TiptapEditor) {
  let maxZ = -1
  editor.state.doc.forEach(node => {
    if (node.type.name !== 'section') return
    maxZ = Math.max(maxZ, (node.attrs.z as number | null) ?? 0)
  })
  return maxZ + 1
}

function addSection(editor: TiptapEditor, attrs: Record<string, number | null> = {}) {
  editor.chain().focus()
    .insertContentAt(editor.state.doc.content.size, {
      type: 'section',
      attrs: { ...attrs, z: attrs.z ?? nextSectionZ(editor) },
      content: [{ type: 'paragraph' }],
    })
    .run()
}

function createLineElement(editor: TiptapEditor, key: string, content: Fragment): PMNode | null {
  const { schema } = editor.state
  if (key === 'paragraph') return schema.nodes.paragraph.create(null, content)
  if (key === 'h1') return schema.nodes.heading.create({ level: 1 }, content)
  if (key === 'h2') return schema.nodes.heading.create({ level: 2 }, content)
  if (key === 'h3') return schema.nodes.heading.create({ level: 3 }, content)
  if (key === 'codeBlock') return schema.nodes.codeBlock.create({ language: null }, content)
  if (key === 'blockquote') return schema.nodes.blockquote.create(null, schema.nodes.paragraph.create(null, content))
  if (key === 'bulletList' || key === 'orderedList') {
    const paragraph = schema.nodes.paragraph.create(null, content)
    const item = schema.nodes.listItem.create(null, paragraph)
    return schema.nodes[key].create(null, item)
  }
  if (key === 'hr') return schema.nodes.horizontalRule.create()
  if (key === 'table') {
    const cell = () => schema.nodes.tableCell.create(null, schema.nodes.paragraph.create())
    const row = () => schema.nodes.tableRow.create(null, [cell(), cell(), cell()])
    return schema.nodes.table.create(null, [row(), row(), row()])
  }
  return null
}

function transformVisualLine(editor: TiptapEditor, key: string, deleteRange?: { from: number; to: number }) {
  const position = deleteRange?.from ?? editor.state.selection.from
  const $pos = editor.state.doc.resolve(position)
  const parentDepth = $pos.depth
  if (!$pos.parent.isTextblock || parentDepth < 1 || $pos.node(parentDepth - 1).type.name !== 'section') return false

  const parent = $pos.parent
  const parentPos = $pos.before(parentDepth)
  const parentStart = $pos.start(parentDepth)
  const relativePos = position - parentStart
  let previousBreak = -1
  let nextBreak = parent.content.size
  let nextBreakSize = 0

  parent.forEach((child, offset) => {
    if (child.type.name !== 'hardBreak') return
    if (offset < relativePos) previousBreak = offset
    else if (nextBreak === parent.content.size) {
      nextBreak = offset
      nextBreakSize = child.nodeSize
    }
  })

  const lineStart = previousBreak < 0 ? 0 : previousBreak + 1
  const lineEnd = nextBreak
  let lineContent = parent.content.cut(lineStart, lineEnd)
  if (deleteRange) {
    const deleteFrom = Math.max(lineStart, deleteRange.from - parentStart)
    const deleteTo = Math.min(lineEnd, deleteRange.to - parentStart)
    lineContent = parent.content.cut(lineStart, deleteFrom).append(parent.content.cut(deleteTo, lineEnd))
  }

  const target = createLineElement(editor, key, lineContent)
  if (!target) return false

  const replacement: PMNode[] = []
  const beforeContent = parent.content.cut(0, previousBreak < 0 ? 0 : previousBreak)
  if (beforeContent.size) replacement.push(parent.copy(beforeContent))
  const targetIndex = replacement.length
  replacement.push(target)
  const afterStart = nextBreak < parent.content.size ? nextBreak + nextBreakSize : parent.content.size
  const afterContent = parent.content.cut(afterStart)
  if (afterContent.size) replacement.push(parent.copy(afterContent))

  const tr = editor.state.tr.replaceWith(parentPos, parentPos + parent.nodeSize, Fragment.fromArray(replacement))
  const targetPos = parentPos + replacement.slice(0, targetIndex).reduce((sum, node) => sum + node.nodeSize, 0)
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(targetPos + 1, tr.doc.content.size))))
  editor.view.dispatch(tr.scrollIntoView())
  return true
}

interface EditorProps {
  content?: object | null
  onChange?: (json: object) => void
  editable?: boolean
}

export default function Editor({ content, onChange, editable = true }: EditorProps) {
  const initialContent = ensureSections(content)
  const [tableMenuOpen, setTableMenuOpen] = useState(false)
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState(false)
  const [, refreshTextToolbar] = useState(0)
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const [spacePanVisible, setSpacePanVisible] = useState(false)
  const [panMode, setPanMode] = useState(false)
  const [minimapBlocks, setMinimapBlocks] = useState<MinimapBlock[]>([])
  const [minimapViewport, setMinimapViewport] = useState<MinimapViewport>({ w: 1200, h: 700 })
  const [minimapBounds, setMinimapBounds] = useState<MinimapBounds>({
    x: CANVAS_CENTER_X - 1000,
    y: CANVAS_CENTER_Y - 700,
    w: 2000,
    h: 1400,
  })
  const [minimapHovered, setMinimapHovered] = useState(false)
  const slashMenuRef = useRef<SlashMenuState | null>(null)
  const slashMenuListRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ x: 80, y: 48, zoom: 1 })
  const viewportRef = useRef(viewport)
  const spaceDownRef = useRef(false)
  const panModeRef = useRef(false)
  const lastPointerPanAtRef = useRef(0)
  const latePanRef = useRef<{ x: number; y: number } | null>(null)
  const minimapDragRef = useRef<MinimapDragState | null>(null)
  const legacyTopLeftMigratedRef = useRef(false)
  const initialContentCenteredRef = useRef(false)

  const minimapVisible = editable && panMode
  const minimapSize = { w: 188, h: 112 }
  const minimapScale = Math.min(minimapSize.w / minimapBounds.w, minimapSize.h / minimapBounds.h)
  const minimapContent = {
    w: minimapBounds.w * minimapScale,
    h: minimapBounds.h * minimapScale,
    x: (minimapSize.w - minimapBounds.w * minimapScale) / 2,
    y: (minimapSize.h - minimapBounds.h * minimapScale) / 2,
  }
  const minimapView = {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    w: minimapViewport.w / viewport.zoom,
    h: minimapViewport.h / viewport.zoom,
  }

  function clampViewportPosition(x: number, y: number, zoom: number) {
    const workspace = document.querySelector('[data-editor-workspace]') as HTMLElement | null
    if (!workspace) return { x, y }
    const rect = workspace.getBoundingClientRect()
    const scaledW = CANVAS_W * zoom
    const scaledH = CANVAS_H * zoom
    const clampedX = scaledW <= rect.width
      ? (rect.width - scaledW) / 2
      : Math.min(0, Math.max(rect.width - scaledW, x))
    const clampedY = scaledH <= rect.height
      ? (rect.height - scaledH) / 2
      : Math.min(0, Math.max(rect.height - scaledH, y))
    return { x: clampedX, y: clampedY }
  }

  function refreshMinimapBlocks() {
    const canvas = document.querySelector('[data-editor-canvas]') as HTMLElement | null
    const workspace = document.querySelector('[data-editor-workspace]') as HTMLElement | null
    if (!canvas) return
    if (workspace) {
      const rect = workspace.getBoundingClientRect()
      setMinimapViewport({ w: rect.width, h: rect.height })
    }
    const canvasRect = canvas.getBoundingClientRect()
    const zoomRaw = Number(canvas.dataset.editorZoom)
    const zoom = Number.isFinite(zoomRaw) && zoomRaw > 0 ? zoomRaw : 1
    const blocks: MinimapBlock[] = []
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    const currentView = viewportRef.current
    if (workspace) {
      const rect = workspace.getBoundingClientRect()
      const viewX = -currentView.x / currentView.zoom
      const viewY = -currentView.y / currentView.zoom
      minX = Math.min(minX, viewX)
      minY = Math.min(minY, viewY)
      maxX = Math.max(maxX, viewX + rect.width / currentView.zoom)
      maxY = Math.max(maxY, viewY + rect.height / currentView.zoom)
    }
    canvas.querySelectorAll<HTMLElement>('[data-section-card]').forEach(card => {
      const id = card.dataset.sectionId
      const wrap = card.parentElement as HTMLElement | null
      if (!id || !wrap) return
      const rect = wrap.getBoundingClientRect()
      const x = (rect.left - canvasRect.left) / zoom
      const y = (rect.top - canvasRect.top) / zoom
      const w = rect.width / zoom
      const h = rect.height / zoom
      if (![x, y, w, h].every(Number.isFinite)) return
      blocks.push({ id, x, y, w, h })
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + w)
      maxY = Math.max(maxY, y + h)
    })
    setMinimapBlocks(blocks)
    if (Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)) {
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2
      const w = Math.min(CANVAS_W, Math.max(600, maxX - minX + MINIMAP_PADDING * 2))
      const h = Math.min(CANVAS_H, Math.max(420, maxY - minY + MINIMAP_PADDING * 2))
      const x = Math.min(Math.max(0, centerX - w / 2), Math.max(0, CANVAS_W - w))
      const y = Math.min(Math.max(0, centerY - h / 2), Math.max(0, CANVAS_H - h))
      setMinimapBounds({ x, y, w, h })
    }
  }

  function panMinimapTo(clientX: number, clientY: number, minimapEl: HTMLElement, dragState: MinimapDragState) {
    const workspace = document.querySelector('[data-editor-workspace]') as HTMLElement | null
    if (!workspace) return
    const rect = minimapEl.getBoundingClientRect()
    const maxWorldX = Math.max(minimapBounds.x, minimapBounds.x + minimapBounds.w - minimapView.w)
    const maxWorldY = Math.max(minimapBounds.y, minimapBounds.y + minimapBounds.h - minimapView.h)
    const worldX = Math.max(
      minimapBounds.x,
      Math.min(
        maxWorldX,
        minimapBounds.x + (clientX - rect.left - minimapContent.x) / minimapScale - dragState.grabOffsetX
      )
    )
    const worldY = Math.max(
      minimapBounds.y,
      Math.min(
        maxWorldY,
        minimapBounds.y + (clientY - rect.top - minimapContent.y) / minimapScale - dragState.grabOffsetY
      )
    )
    setViewport(v => ({
      ...v,
      ...clampViewportPosition(-worldX * v.zoom, -worldY * v.zoom, v.zoom),
    }))
  }

  function syncSlashMenu(editor: TiptapEditor) {
    const { selection } = editor.state
    if (!selection.empty || !editor.isEditable) {
      setSlashMenu(null)
      return
    }

    const { $from } = selection
    if (!$from.parent.isTextblock) {
      setSlashMenu(null)
      return
    }

    const textBefore = $from.parent.textBetween(
      0,
      $from.parentOffset,
      undefined,
      node => node.type.name === 'hardBreak' ? '\n' : '\ufffc',
    )
    const currentLine = textBefore.slice(textBefore.lastIndexOf('\n') + 1)
    const match = currentLine.match(/^\/([^\s/]*)$/)
    if (!match) {
      setSlashMenu(null)
      return
    }

    const query = match[1]
    const from = selection.from - query.length - 1
    try {
      const coords = editor.view.coordsAtPos(selection.from)
      setSlashMenu(previous => ({
        from,
        to: selection.from,
        query,
        left: coords.left,
        top: coords.bottom + 8,
        selected: previous?.query === query ? previous.selected : 0,
      }))
    } catch {
      setSlashMenu(null)
    }
  }

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  useEffect(() => {
    panModeRef.current = panMode
    if (panMode) {
      document.documentElement.style.cursor = 'grab'
      document.body.style.cursor = 'grab'
    } else if (!spaceDownRef.current) {
      document.documentElement.style.cursor = ''
      document.body.style.cursor = ''
    }
  }, [panMode])

  useEffect(() => {
    if (!minimapVisible) return
    const id = window.requestAnimationFrame(refreshMinimapBlocks)
    const interval = window.setInterval(refreshMinimapBlocks, 160)
    return () => {
      window.cancelAnimationFrame(id)
      window.clearInterval(interval)
    }
  }, [minimapVisible, viewport.x, viewport.y, viewport.zoom])

  const panFrameRef = useRef(0)

  function animateViewportTo(targetX: number, targetY: number) {
    window.cancelAnimationFrame(panFrameRef.current)
    const start = { ...viewportRef.current }
    const target = clampViewportPosition(targetX, targetY, start.zoom)
    const t0 = performance.now()
    const duration = 350
    function step(now: number) {
      const t = Math.min(1, (now - t0) / duration)
      const ease = 1 - Math.pow(1 - t, 3)
      setViewport(v => ({
        ...v,
        x: start.x + (target.x - start.x) * ease,
        y: start.y + (target.y - start.y) * ease,
      }))
      if (t < 1) panFrameRef.current = window.requestAnimationFrame(step)
    }
    panFrameRef.current = window.requestAnimationFrame(step)
  }

  function centerViewportOnRenderedContent() {
    const workspaceEl = document.querySelector('[data-editor-workspace]') as HTMLElement | null
    const canvasEl = document.querySelector('[data-editor-canvas]') as HTMLElement | null
    if (!workspaceEl || !canvasEl) return false

    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-section-card]'))
    if (!cards.length) return false

    const wsRect = workspaceEl.getBoundingClientRect()
    const canvasRect = canvasEl.getBoundingClientRect()
    const zoom = viewportRef.current.zoom
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    cards.forEach(card => {
      const wrap = card.parentElement as HTMLElement | null
      if (!wrap) return
      const rect = wrap.getBoundingClientRect()
      const x = (rect.left - canvasRect.left) / zoom
      const y = (rect.top - canvasRect.top) / zoom
      const w = rect.width / zoom
      const h = rect.height / zoom
      if (![x, y, w, h].every(Number.isFinite)) return
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + w)
      maxY = Math.max(maxY, y + h)
    })

    if (![minX, minY, maxX, maxY].every(Number.isFinite)) return false

    const contentCenterX = (minX + maxX) / 2
    const contentCenterY = (minY + maxY) / 2
    setViewport(v => ({
      ...v,
      ...clampViewportPosition(
        wsRect.width / 2 - contentCenterX * v.zoom,
        wsRect.height / 2 - contentCenterY * v.zoom,
        v.zoom
      ),
    }))
    return true
  }

  function zoomAt(clientX: number, clientY: number, nextZoom: number) {
    window.cancelAnimationFrame(panFrameRef.current)
    const viewportEl = document.querySelector('[data-editor-workspace]') as HTMLElement | null
    if (!viewportEl) {
      setViewport(v => {
        const zoom = Math.max(0.25, Math.min(2.5, nextZoom))
        return { ...v, ...clampViewportPosition(v.x, v.y, zoom), zoom }
      })
      return
    }
    const rect = viewportEl.getBoundingClientRect()
    setViewport(v => {
      const zoom = Math.max(0.25, Math.min(2.5, nextZoom))
      const worldX = (clientX - rect.left - v.x) / v.zoom
      const worldY = (clientY - rect.top - v.y) / v.zoom
      const next = clampViewportPosition(
        clientX - rect.left - worldX * zoom,
        clientY - rect.top - worldY * zoom,
        zoom
      )
      return {
        x: next.x,
        y: next.y,
        zoom,
      }
    })
  }

  useEffect(() => {
    if (!editable) return

    const lasso = document.createElement('div')
    lasso.style.cssText = [
      'display:none', 'position:fixed', 'pointer-events:none', 'z-index:9999',
      'border:1px solid var(--accent)', 'border-radius:3px',
      'background:color-mix(in srgb,var(--accent) 10%,transparent)',
    ].join(';')
    document.body.appendChild(lasso)

    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Element
      if (!target.closest('[data-editor-workspace]')) return
      if (target.closest('[data-section-card]')) return
      if (spaceDownRef.current) return
      if (target.closest('button')) return
      if (target.closest('input') || target.closest('select') || target.closest('textarea')) return
      if (target.closest('a[href]')) return
      if (target.closest('[data-section-drag-handle]')) return
      if (target.closest('[data-section-resize-handle]')) return

      const startX = e.clientX, startY = e.clientY
      let lassoActive = false

      function onMove(ev: MouseEvent) {
        if (!lassoActive) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return
          lassoActive = true
          e.preventDefault()
          window.getSelection()?.removeAllRanges()
          sectionSel.clear()
          document.body.style.userSelect = 'none'
        }
        const x1 = Math.min(startX, ev.clientX)
        const y1 = Math.min(startY, ev.clientY)
        const w = Math.abs(ev.clientX - startX)
        const h = Math.abs(ev.clientY - startY)
        lasso.style.display = 'block'
        lasso.style.left = x1 + 'px'
        lasso.style.top = y1 + 'px'
        lasso.style.width = w + 'px'
        lasso.style.height = h + 'px'
        const intersecting: string[] = []
        document.querySelectorAll<HTMLElement>('[data-section-card]').forEach(card => {
          const r = card.getBoundingClientRect()
          const id = card.dataset.sectionId
          if (!id) return
          if (r.left < x1 + w && r.right > x1 && r.top < y1 + h && r.bottom > y1) intersecting.push(id)
        })
        sectionSel.setExact(intersecting)
      }

      function onUp() {
        lasso.style.display = 'none'
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }

    document.addEventListener('mousedown', onDocMouseDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.body.removeChild(lasso)
    }
  }, [editable])

  useEffect(() => {
    if (!editable) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      const target = e.target as HTMLElement | null
      const isTextInput = target?.closest('input, textarea, select, [contenteditable="true"]')
      if (isTextInput) return
      spaceDownRef.current = true
      setSpacePanVisible(true)
      document.documentElement.style.cursor = 'grab'
      document.body.style.cursor = 'grab'
      e.preventDefault()
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      spaceDownRef.current = false
      setSpacePanVisible(false)
      latePanRef.current = null
      document.documentElement.style.cursor = panModeRef.current ? 'grab' : ''
      document.body.style.cursor = panModeRef.current ? 'grab' : ''
    }

    function onBlur() {
      spaceDownRef.current = false
      setSpacePanVisible(false)
      latePanRef.current = null
      document.documentElement.style.cursor = panModeRef.current ? 'grab' : ''
      document.body.style.cursor = panModeRef.current ? 'grab' : ''
      document.body.style.userSelect = ''
    }

    function startPanDrag(
      e: MouseEvent | PointerEvent,
      addEndListeners: (onMove: (ev: MouseEvent | PointerEvent) => void, onUp: () => void) => void,
      removeEndListeners: (onMove: (ev: MouseEvent | PointerEvent) => void, onUp: () => void) => void,
      releasePointer?: () => void
    ) {
      e.preventDefault()
      window.cancelAnimationFrame(panFrameRef.current)
      const startX = e.clientX
      const startY = e.clientY
      const startView = viewportRef.current
      document.documentElement.style.cursor = 'grabbing'
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'

      function onMove(ev: MouseEvent | PointerEvent) {
        setViewport(v => ({
          ...v,
          ...clampViewportPosition(startView.x + ev.clientX - startX, startView.y + ev.clientY - startY, v.zoom),
        }))
      }

      function onUp() {
        releasePointer?.()
        const stillPanning = spaceDownRef.current || panModeRef.current
        document.documentElement.style.cursor = stillPanning ? 'grab' : ''
        document.body.style.cursor = stillPanning ? 'grab' : ''
        document.body.style.userSelect = ''
        removeEndListeners(onMove, onUp)
      }

      addEndListeners(onMove, onUp)
    }

    function onPointerDown(e: PointerEvent) {
      if (!(spaceDownRef.current || panModeRef.current) || e.button !== 0) return
      if (!e.isPrimary) return
      const target = e.target as Element
      if (target.closest('button, input, textarea, select, [data-element-palette], [data-editor-minimap]')) return
      const workspace = target.closest('[data-editor-workspace]') as HTMLElement | null
      if (!workspace) return
      lastPointerPanAtRef.current = Date.now()
      try { workspace.setPointerCapture?.(e.pointerId) } catch {}
      startPanDrag(
        e,
        (onMove, onUp) => {
          document.addEventListener('pointermove', onMove as (ev: PointerEvent) => void)
          document.addEventListener('pointerup', onUp)
          document.addEventListener('pointercancel', onUp)
        },
        (onMove, onUp) => {
          document.removeEventListener('pointermove', onMove as (ev: PointerEvent) => void)
          document.removeEventListener('pointerup', onUp)
          document.removeEventListener('pointercancel', onUp)
        },
        () => { try { workspace.releasePointerCapture?.(e.pointerId) } catch {} }
      )
    }

    function onMouseDown(e: MouseEvent) {
      if (!(spaceDownRef.current || panModeRef.current) || e.button !== 0) return
      if (Date.now() - lastPointerPanAtRef.current < 500) return
      const target = e.target as Element
      if (target.closest('button, input, textarea, select, [data-element-palette], [data-editor-minimap]')) return
      const workspace = target.closest('[data-editor-workspace]') as HTMLElement | null
      if (!workspace) return
      startPanDrag(
        e,
        (onMove, onUp) => {
          document.addEventListener('mousemove', onMove as (ev: MouseEvent) => void)
          document.addEventListener('mouseup', onUp)
        },
        (onMove, onUp) => {
          document.removeEventListener('mousemove', onMove as (ev: MouseEvent) => void)
          document.removeEventListener('mouseup', onUp)
        }
      )
    }

    function onLatePanMove(e: MouseEvent) {
      if (!(spaceDownRef.current || panModeRef.current) || e.buttons !== 1) {
        latePanRef.current = null
        return
      }

      const active = document.activeElement as HTMLElement | null
      if (active?.closest('[contenteditable="true"], input, textarea, select')) {
        latePanRef.current = null
        return
      }

      const target = e.target as Element
      if (target.closest('button, input, textarea, select, [data-element-palette], [data-editor-minimap]')) {
        latePanRef.current = null
        return
      }
      if (!target.closest('[data-editor-workspace]')) {
        latePanRef.current = null
        return
      }

      e.preventDefault()
      document.documentElement.style.cursor = 'grabbing'
      document.body.style.cursor = 'grabbing'

      const last = latePanRef.current
      latePanRef.current = { x: e.clientX, y: e.clientY }
      if (!last) return

      setViewport(v => ({
        ...v,
        ...clampViewportPosition(v.x + e.clientX - last.x, v.y + e.clientY - last.y, v.zoom),
      }))
    }

    function onWheel(e: WheelEvent) {
      const target = e.target as Element
      if (!target.closest('[data-editor-workspace]')) return
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const current = viewportRef.current.zoom
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      zoomAt(e.clientX, e.clientY, current * factor)
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onBlur)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('mousemove', onLatePanMove, true)
    document.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('mousedown', onMouseDown, true)
      document.removeEventListener('mousemove', onLatePanMove, true)
      document.removeEventListener('wheel', onWheel, true)
      document.documentElement.style.cursor = ''
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [editable])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        document: false,
        codeBlock: false,
        link: { openOnClick: !editable },
      }),
      SectionDocument,
      TextStyle,
      ImageExt,
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      SectionExtension,
    ],
    content: initialContent || {
      type: 'doc',
      content: [{ type: 'section', content: [{ type: 'paragraph' }] }],
    },
    editable,
    immediatelyRender: true,
    onUpdate({ editor }) {
      onChange?.(editor.getJSON())
      syncSlashMenu(editor)
      refreshTextToolbar(version => version + 1)
    },
    onSelectionUpdate({ editor }) {
      syncSlashMenu(editor)
      refreshTextToolbar(version => version + 1)
    },
    onBlur() {
      window.setTimeout(() => setSlashMenu(null), 120)
    },
  }, [editable, EDITOR_SCHEMA_VERSION])

  useEffect(() => {
    if (!editor || initialContentCenteredRef.current) return
    let frame = 0
    let attempts = 0
    const maxAttempts = 12

    function tryCenter() {
      frame = 0
      attempts += 1
      if (initialContentCenteredRef.current) return
      if (centerViewportOnRenderedContent()) {
        initialContentCenteredRef.current = true
        return
      }
      if (attempts < maxAttempts) frame = window.requestAnimationFrame(tryCenter)
    }

    frame = window.requestAnimationFrame(tryCenter)
    editor.on('update', tryCenter)
    return () => {
      editor.off('update', tryCenter)
      if (frame) window.cancelAnimationFrame(frame)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  useEffect(() => {
    if (!editor || !editable) return

    function leaveTextMode(e: MouseEvent) {
      const target = e.target as Element
      if (!target.closest('[data-editor-workspace]')) return
      if (target.closest('[data-section-card], [data-element-palette], button, input, select, textarea')) return
      editor.commands.blur()
      window.getSelection()?.removeAllRanges()
      setSlashMenu(null)
    }

    document.addEventListener('mousedown', leaveTextMode, true)
    return () => document.removeEventListener('mousedown', leaveTextMode, true)
  }, [editor, editable])

  useEffect(() => {
    slashMenuRef.current = slashMenu
  }, [slashMenu])

  useEffect(() => {
    if (!slashMenu) return
    const activeItem = slashMenuListRef.current?.querySelector<HTMLElement>('[data-slash-active="true"]')
    activeItem?.scrollIntoView({ block: 'nearest' })
  }, [slashMenu])

  useEffect(() => {
    function onSlashKeyDown(e: KeyboardEvent) {
      const menu = slashMenuRef.current
      if (!menu || !editor) return
      const items = getSlashItems(menu.query)

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setSlashMenu(null)
        return
      }
      if (!items.length) return
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        const direction = e.key === 'ArrowDown' ? 1 : -1
        setSlashMenu(current => current ? {
          ...current,
          selected: (current.selected + direction + items.length) % items.length,
        } : null)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        executeSlashCommand(items[Math.min(menu.selected, items.length - 1)].key, menu)
      }
    }

    document.addEventListener('keydown', onSlashKeyDown, true)
    return () => document.removeEventListener('keydown', onSlashKeyDown, true)
    // executeSlashCommand only closes over the current editor instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  function executeSlashCommand(key: string, menu: SlashMenuState) {
    if (!editor) return
    setSlashMenu(null)
    if (key === 'image') {
      transformVisualLine(editor, 'paragraph', { from: menu.from, to: menu.to })
      document.dispatchEvent(new CustomEvent('wiki-editor-add-element', {
        detail: { key: 'image', targetPos: editor.state.selection.from },
      }))
      return
    }
    if (transformVisualLine(editor, key, { from: menu.from, to: menu.to })) return

    const chain = editor.chain().focus().deleteRange({ from: menu.from, to: menu.to })

    if (key === 'paragraph') chain.setParagraph().run()
    else if (key === 'h1') chain.setHeading({ level: 1 }).run()
    else if (key === 'h2') chain.setHeading({ level: 2 }).run()
    else if (key === 'h3') chain.setHeading({ level: 3 }).run()
    else if (key === 'bulletList') chain.toggleBulletList().run()
    else if (key === 'orderedList') chain.toggleOrderedList().run()
    else if (key === 'codeBlock') chain.setCodeBlock().run()
    else if (key === 'blockquote') chain.toggleBlockquote().run()
    else if (key === 'hr') chain.setHorizontalRule().run()
    else if (key === 'table') chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  function changeSelectedLineType(key: 'paragraph' | 'h1' | 'h2' | 'h3') {
    if (transformVisualLine(editor, key)) return
    if (key === 'paragraph') {
      editor.chain().focus().setParagraph().run()
      return
    }
    const level = key === 'h1' ? 1 : key === 'h2' ? 2 : 3
    editor.chain().focus().toggleHeading({ level }).run()
  }

  useEffect(() => {
    if (!tableMenuOpen) return
    const close = () => setTableMenuOpen(false)
    // setTimeout(0): defer until after the current click event finishes propagating,
    // otherwise the click that opened the menu immediately triggers the listener
    const id = window.setTimeout(() => document.addEventListener('click', close), 0)
    return () => { window.clearTimeout(id); document.removeEventListener('click', close) }
  }, [tableMenuOpen])

  // Layout pass: sections without stored position rendered in flow get measured
  // after paint and converted to canvas coordinates — real heights, no overlap
  useEffect(() => {
    if (!editor || !editable) return
    const ed = editor
    let frame = 0

    function run() {
      frame = 0
      let hasUnpositioned = false
      let minZ = 0
      let sectionCount = 0
      let positionedCount = 0
      let boundsMinX = Infinity
      let boundsMinY = Infinity
      let boundsMaxX = -Infinity
      let boundsMaxY = -Infinity
      ed.state.doc.forEach(n => {
        if (n.type.name !== 'section') return
        sectionCount += 1
        if (n.attrs.x === null) hasUnpositioned = true
        else {
          positionedCount += 1
          const x = n.attrs.x as number
          const y = (n.attrs.y as number | null) ?? 0
          const w = (n.attrs.w as number | null) ?? 320
          const h = (n.attrs.h as number | null) ?? 220
          boundsMinX = Math.min(boundsMinX, x)
          boundsMinY = Math.min(boundsMinY, y)
          boundsMaxX = Math.max(boundsMaxX, x + w)
          boundsMaxY = Math.max(boundsMaxY, y + h)
        }
        const z = (n.attrs.z as number | null) ?? 0
        if (z < minZ) minZ = z
      })
      const shouldCenterLegacyTopLeft =
        !legacyTopLeftMigratedRef.current &&
        !hasUnpositioned &&
        sectionCount > 0 &&
        positionedCount === sectionCount &&
        Number.isFinite(boundsMinX) &&
        boundsMinX >= 0 &&
        boundsMinY >= 0 &&
        boundsMaxX < CANVAS_CENTER_X &&
        boundsMaxY < CANVAS_CENTER_Y
      if (!hasUnpositioned && minZ >= 0 && !shouldCenterLegacyTopLeft) return
      const canvas = document.querySelector('[data-editor-canvas]') as HTMLElement | null
      if (!canvas) return
      const zoomRaw = Number(canvas.dataset.editorZoom)
      const zoom = Number.isFinite(zoomRaw) && zoomRaw > 0 ? zoomRaw : 1
      // Negative layers paint behind the editor surface where the mouse can't
      // reach them — shift all stored layers up so the lowest one is 0
      const zShift = minZ < 0 ? -minZ : 0
      const tr = ed.state.tr
      const unpositionedLayouts = new Map<number, { x: number; y: number; w: number }>()
      if (hasUnpositioned) {
        const measured: Array<{ offset: number; w: number; h: number }> = []
        ed.state.doc.forEach((node, offset) => {
          if (node.type.name !== 'section' || node.attrs.x !== null) return
          const dom = ed.view.nodeDOM(offset)
          if (!(dom instanceof HTMLElement)) return
          const r = dom.getBoundingClientRect()
          measured.push({
            offset,
            w: Math.round(r.width / zoom),
            h: Math.round(r.height / zoom),
          })
        })
        const gap = 28
        const totalH = measured.reduce((sum, item, index) => sum + item.h + (index > 0 ? gap : 0), 0)
        let nextY = CANVAS_CENTER_Y - totalH / 2
        measured.forEach(item => {
          unpositionedLayouts.set(item.offset, {
            x: Math.round(CANVAS_CENTER_X - item.w / 2),
            y: Math.round(nextY),
            w: item.w,
          })
          nextY += item.h + gap
        })
      }
      let legacyShiftX = 0
      let legacyShiftY = 0
      if (shouldCenterLegacyTopLeft) {
        const boundsW = boundsMaxX - boundsMinX
        const boundsH = boundsMaxY - boundsMinY
        const targetMinX = Math.min(Math.max(0, CANVAS_CENTER_X - boundsW / 2), Math.max(0, CANVAS_W - boundsW))
        const targetMinY = Math.min(Math.max(0, CANVAS_CENTER_Y - boundsH / 2), Math.max(0, CANVAS_H - boundsH))
        legacyShiftX = Math.round(targetMinX - boundsMinX)
        legacyShiftY = Math.round(targetMinY - boundsMinY)
      }
      ed.state.doc.forEach((node, offset) => {
        if (node.type.name !== 'section') return
        const attrs = { ...node.attrs }
        let changed = false
        if (zShift && node.attrs.z !== null) {
          attrs.z = (node.attrs.z as number) + zShift
          changed = true
        }
        if (node.attrs.x === null) {
          const layout = unpositionedLayouts.get(offset)
          if (layout) {
            attrs.x = layout.x
            attrs.y = layout.y
            attrs.w = layout.w
            changed = true
          }
        }
        if (shouldCenterLegacyTopLeft && node.attrs.x !== null) {
          attrs.x = Math.round((node.attrs.x as number) + legacyShiftX)
          attrs.y = Math.round(((node.attrs.y as number | null) ?? 0) + legacyShiftY)
          changed = true
        }
        if (changed) tr.setNodeMarkup(offset, undefined, attrs)
      })
      if (!tr.steps.length) return
      // Migration, not a user action — must not land on the undo stack
      tr.setMeta('addToHistory', false)
      ed.view.dispatch(tr)
      if (shouldCenterLegacyTopLeft) legacyTopLeftMigratedRef.current = true
      if (hasUnpositioned || shouldCenterLegacyTopLeft) {
        const workspace = document.querySelector('[data-editor-workspace]') as HTMLElement | null
        const rect = workspace?.getBoundingClientRect()
        if (rect) {
          setViewport(v => ({
            ...v,
            ...clampViewportPosition(
              rect.width / 2 - CANVAS_CENTER_X * v.zoom,
              rect.height / 2 - CANVAS_CENTER_Y * v.zoom,
              v.zoom
            ),
          }))
        }
      }
    }

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(run)
    }

    schedule()
    ed.on('update', schedule)
    return () => {
      ed.off('update', schedule)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [editor, editable])

  // Center a section in the workspace when the outline sidebar asks for it
  useEffect(() => {
    function onFocusSection(e: Event) {
      const idx = (e as CustomEvent<{ idx?: number }>).detail?.idx
      if (typeof idx !== 'number') return
      const workspaceEl = document.querySelector('[data-editor-workspace]') as HTMLElement | null
      const canvasEl = document.querySelector('[data-editor-canvas]') as HTMLElement | null
      const card = document.querySelectorAll<HTMLElement>('[data-section-card]')[idx]
      if (!workspaceEl || !canvasEl || !card) return
      const wsRect = workspaceEl.getBoundingClientRect()
      const canvasRect = canvasEl.getBoundingClientRect()
      const cardRect = card.getBoundingClientRect()
      const zoom = viewportRef.current.zoom
      // Card center in world (unscaled canvas) coordinates, then pan so it lands mid-workspace
      const worldCX = (cardRect.left + cardRect.width / 2 - canvasRect.left) / zoom
      const worldCY = (cardRect.top + cardRect.height / 2 - canvasRect.top) / zoom
      animateViewportTo(wsRect.width / 2 - worldCX * zoom, wsRect.height / 2 - worldCY * zoom)
    }
    document.addEventListener('wiki-editor-focus-section', onFocusSection)
    return () => document.removeEventListener('wiki-editor-focus-section', onFocusSection)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!editor) return null
  const slashItems = slashMenu ? getSlashItems(slashMenu.query) : []

  function addSectionAtViewportCenter() {
    const viewportEl = document.querySelector('[data-editor-workspace]') as HTMLElement | null
    const rect = viewportEl?.getBoundingClientRect()
    const x = rect ? (rect.width / 2 - viewport.x) / viewport.zoom - 120 : 0
    const y = rect ? (rect.height / 2 - viewport.y) / viewport.zoom - 80 : 0
    addSection(editor, { x: Math.round(x), y: Math.round(y), w: null, h: null })
  }

  function addElementToSelectedSection(key: string) {
    document.dispatchEvent(new CustomEvent('wiki-editor-add-element', { detail: { key } }))
  }

  function startPaletteDrag(e: React.DragEvent, key: string) {
    e.dataTransfer.setData('application/x-wiki-element', key)
    e.dataTransfer.effectAllowed = 'copy'
  }

  function startBlockDrag(e: React.DragEvent) {
    e.dataTransfer.setData('application/x-wiki-section', 'new')
    e.dataTransfer.effectAllowed = 'copy'
  }

  function onWorkspaceDragOver(e: React.DragEvent) {
    if (!Array.from(e.dataTransfer.types).includes('application/x-wiki-section')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function onWorkspaceDrop(e: React.DragEvent) {
    if (!Array.from(e.dataTransfer.types).includes('application/x-wiki-section')) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left - viewport.x) / viewport.zoom - 120
    const y = (e.clientY - rect.top - viewport.y) / viewport.zoom - 80
    addSection(editor, { x: Math.round(x), y: Math.round(y), w: null, h: null })
  }

  const getTableRect = () => {
    try {
      const { node } = editor.view.domAtPos(editor.state.selection.from)
      let el: Element | null = node instanceof Element ? node : (node as Node).parentElement
      while (el && el.tagName !== 'TABLE') el = el.parentElement
      if (el) return el.getBoundingClientRect()
    } catch {}
    return editor.view.dom.getBoundingClientRect()
  }

  const menuItem = (label: string, onClick: () => void, destructive = false) => (
    <button
      key={label}
      onClick={() => { onClick(); setTableMenuOpen(false) }}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '6px 10px', background: 'none', border: 'none',
        borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: '13px', color: destructive ? 'var(--accent2)' : 'var(--text)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = destructive ? '#fff0f2' : 'var(--surface2)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
    >{label}</button>
  )

  const bBtn = (active: boolean, extra?: React.CSSProperties) => ({
    padding: '4px 9px',
    borderRadius: '5px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'inherit',
    fontWeight: active ? 700 : 400,
    background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
    color: '#e8e8f0',
    transition: 'background 0.1s',
    ...extra,
  } as React.CSSProperties)

  const textStyleAttributes = editor.schema.marks[TEXT_STYLE_MARK]
    ? editor.getAttributes(TEXT_STYLE_MARK)
    : {}
  const effectiveFontSize = (textStyleAttributes.fontSize as string | null)
    ?? (editor.isActive('heading', { level: 1 }) ? '26px'
      : editor.isActive('heading', { level: 2 }) ? '19px'
        : editor.isActive('heading', { level: 3 }) ? '15px'
          : '14px')
  const setTextStyle = (attributes: Record<string, string | null>) => {
    if (!editor.schema.marks[TEXT_STYLE_MARK]) return
    editor.chain().focus().setMark(TEXT_STYLE_MARK, attributes).run()
  }
  const closeTextToolbar = () => {
    editor.commands.setTextSelection(editor.state.selection.to)
    editor.commands.blur()
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {slashMenu && (
        <div
          ref={slashMenuListRef}
          onMouseDown={e => e.preventDefault()}
          style={{
            position: 'fixed', left: slashMenu.left, top: slashMenu.top,
            zIndex: 100001, width: 280, maxHeight: 330, overflowY: 'auto',
            padding: 6, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: '0 12px 36px rgba(0,0,0,0.22)',
          }}
        >
          {slashItems.length ? slashItems.map((item, index) => (
            <button
              key={item.key}
              type="button"
              data-slash-active={index === slashMenu.selected ? 'true' : undefined}
              onMouseEnter={() => setSlashMenu(current => current ? { ...current, selected: index } : null)}
              onClick={() => executeSlashCommand(item.key, slashMenu)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 9px', border: 'none', borderRadius: 7,
                background: index === slashMenu.selected ? 'var(--surface2)' : 'transparent',
                color: 'var(--text)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <span style={{
                width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 6,
                fontSize: item.icon.length > 2 ? 10 : 13, fontWeight: 700,
              }}>
                {item.icon}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{item.label}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{item.description}</span>
              </span>
            </button>
          )) : (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Kein Element gefunden</div>
          )}
        </div>
      )}

      {/* Floating format menu on text selection */}
      {editable && (
        <BubbleMenu
          editor={editor}
          pluginKey="text-format-menu"
          appendTo={() => document.body}
          options={{ strategy: 'fixed', placement: 'top', offset: 10, flip: true, shift: { padding: 8 } }}
          shouldShow={({ editor, from, to }) => editor.isEditable && from !== to}
          style={{ zIndex: 100000 }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            flexWrap: 'wrap',
            maxWidth: 'min(720px, calc(100vw - 24px))',
            background: '#1a1a2a',
            border: '1px solid #2e2e42',
            borderRadius: '8px',
            padding: '4px 6px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            position: 'relative',
            zIndex: 100000,
          }}>
            <select
              title="Schriftfamilie"
              value={(textStyleAttributes.fontFamily as string | null) ?? ''}
              onChange={e => setTextStyle({ fontFamily: e.target.value || null })}
              style={{ ...bBtn(false), padding: '4px 6px', maxWidth: 112, background: '#242438', colorScheme: 'dark' }}
            >
              {FONT_FAMILIES.map(font => <option key={font.label} value={font.value ?? ''} style={{ background: '#242438', color: '#f4f4f8' }}>{font.label}</option>)}
            </select>
            <div
              title="Schriftgröße"
              style={{
                position: 'relative', display: 'inline-flex', alignItems: 'stretch',
                height: 26, background: '#242438', borderRadius: 5,
              }}
            >
              <input
                key={effectiveFontSize}
                type="text"
                inputMode="numeric"
                defaultValue={parseFloat(effectiveFontSize)}
                onFocus={e => e.currentTarget.select()}
                onInput={e => {
                  const size = Number(e.currentTarget.value)
                  if (Number.isFinite(size) && size >= 6 && size <= 200) setTextStyle({ fontSize: `${size}px` })
                }}
                onBlur={e => {
                  const size = Number(e.currentTarget.value)
                  if (!Number.isFinite(size) || size < 6 || size > 200) {
                    e.currentTarget.value = String(parseFloat(effectiveFontSize))
                  }
                }}
                style={{
                  width: 34, padding: '4px 2px 4px 7px', border: 0, outline: 'none',
                  background: 'transparent', color: '#e8e8f0', fontFamily: 'inherit', fontSize: 12,
                }}
              />
              <button
                type="button"
                aria-label="Schriftgrößen anzeigen"
                aria-expanded={fontSizeMenuOpen}
                onMouseDown={e => e.preventDefault()}
                onClick={() => setFontSizeMenuOpen(open => !open)}
                style={{
                  width: 22, padding: 0, border: 0, borderRadius: '0 5px 5px 0',
                  background: 'transparent', color: '#a9a9b8', cursor: 'pointer', fontSize: 10,
                }}
              >▼</button>
              {fontSizeMenuOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100001,
                  minWidth: '100%', maxHeight: 190, overflowY: 'auto', padding: 4,
                  background: '#242438', border: '1px solid #3a3a50', borderRadius: 6,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
                }}>
                  {FONT_SIZES.map(size => (
                    <button
                      key={size}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        setTextStyle({ fontSize: size })
                        setFontSizeMenuOpen(false)
                      }}
                      style={{
                        display: 'block', width: '100%', padding: '5px 8px', border: 0,
                        borderRadius: 4, background: size === effectiveFontSize ? 'rgba(255,255,255,0.16)' : 'transparent',
                        color: '#f4f4f8', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 12,
                      }}
                    >{parseFloat(size)}</button>
                  ))}
                </div>
              )}
            </div>
            <label title="Textfarbe" style={{ ...bBtn(false), padding: '3px 5px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              A
              <input
                type="color"
                value={(textStyleAttributes.color as string | null) ?? '#111827'}
                onChange={e => setTextStyle({ color: e.target.value })}
                style={{ width: 18, height: 18, padding: 0, border: 0, background: 'none', cursor: 'pointer' }}
              />
            </label>
            <label title="Hintergrundfarbe" style={{ ...bBtn(false), padding: '3px 5px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 18, height: 18, padding: '0 3px', borderRadius: 3,
                background: (textStyleAttributes.backgroundColor as string | null) ?? 'transparent',
                color: (textStyleAttributes.color as string | null) ?? '#111827',
                fontWeight: 700, lineHeight: 1,
              }}>
                A
              </span>
              <span style={{ position: 'relative', width: 18, height: 18, overflow: 'hidden', borderRadius: 3 }}>
                <input
                  type="color"
                  value={(textStyleAttributes.backgroundColor as string | null) ?? '#fff59d'}
                  onChange={e => setTextStyle({ backgroundColor: e.target.value })}
                  style={{ width: 18, height: 18, padding: 0, border: 0, background: 'none', cursor: 'pointer' }}
                />
                {!textStyleAttributes.backgroundColor && <span style={{
                  position: 'absolute', left: -4, top: 8, width: 26, height: 2,
                  background: '#ef4444', transform: 'rotate(-45deg)', pointerEvents: 'none',
                }} />}
              </span>
            </label>
            <button
              title="Hintergrundfarbe entfernen"
              style={bBtn(false, { color: '#ef4444', padding: '4px 6px' })}
              onClick={() => setTextStyle({ backgroundColor: null })}
            >
              ×
            </button>
            <span style={{ width: '1px', background: '#2e2e42', margin: '2px 4px', alignSelf: 'stretch' }} />
            <button style={bBtn(editor.isActive('bold'),      { fontWeight: 800 })}              onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
            <button style={bBtn(editor.isActive('italic'),    { fontStyle: 'italic' })}          onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
            <button style={bBtn(editor.isActive('underline'), { textDecoration: 'underline' })}  onClick={() => editor.chain().focus().toggleUnderline().run()}>U</button>
            <button style={bBtn(editor.isActive('strike'),    { textDecoration: 'line-through' })} onClick={() => editor.chain().focus().toggleStrike().run()}>S</button>
            <button style={bBtn(editor.isActive('code'),      { fontFamily: 'monospace' })}      onClick={() => editor.chain().focus().toggleCode().run()}>`</button>
            <span style={{ width: '1px', background: '#2e2e42', margin: '2px 4px', alignSelf: 'stretch' }} />
            <button style={bBtn(editor.isActive('heading', { level: 1 }))} onClick={() => changeSelectedLineType('h1')}>H1</button>
            <button style={bBtn(editor.isActive('heading', { level: 2 }))} onClick={() => changeSelectedLineType('h2')}>H2</button>
            <button style={bBtn(editor.isActive('heading', { level: 3 }))} onClick={() => changeSelectedLineType('h3')}>H3</button>
            <button
              title="Normaler Text"
              style={bBtn(editor.isActive('paragraph'))}
              onClick={() => changeSelectedLineType('paragraph')}
            >
              Tx
            </button>
            <button title="Markierungsleiste schließen" style={bBtn(false)} onClick={closeTextToolbar}>×</button>
          </div>
        </BubbleMenu>
      )}

      {/* Table corner "+" — shows when cursor is in a table cell */}
      {editable && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor }) => editor.isActive('tableCell') || editor.isActive('tableHeader')}
          getReferencedVirtualElement={() => ({ getBoundingClientRect: getTableRect })}
          options={{
            placement: 'top-end',
            offset: 8,
            onHide: () => setTableMenuOpen(false),
          }}
        >
          <div style={{ position: 'relative' }}>
            {/* "+" toggle button */}
            <button
              onClick={() => setTableMenuOpen(o => !o)}
              title="Tabelle bearbeiten"
              style={{
                width: '26px', height: '26px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%',
                border: '1px solid var(--border)',
                background: tableMenuOpen ? 'var(--accent)' : 'var(--surface)',
                color: tableMenuOpen ? '#fff' : 'var(--muted)',
                cursor: 'pointer',
                fontSize: '18px', lineHeight: 1, fontWeight: 300,
                boxShadow: '0 1px 6px rgba(0,0,0,0.1)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!tableMenuOpen) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' } }}
              onMouseLeave={e => { if (!tableMenuOpen) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' } }}
            >+</button>

            {/* Dropdown menu */}
            {tableMenuOpen && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '6px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                minWidth: '180px',
                zIndex: 10,
              }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--muted)', padding: '2px 6px 4px', letterSpacing: '0.07em' }}>ZEILE</div>
                {menuItem('↑ Zeile davor einfügen',  () => editor.chain().focus().addRowBefore().run())}
                {menuItem('↓ Zeile danach einfügen', () => editor.chain().focus().addRowAfter().run())}
                {menuItem('✕ Zeile löschen',          () => editor.chain().focus().deleteRow().run(), true)}

                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--muted)', padding: '2px 6px 4px', letterSpacing: '0.07em' }}>SPALTE</div>
                {menuItem('← Spalte davor einfügen',  () => editor.chain().focus().addColumnBefore().run())}
                {menuItem('→ Spalte danach einfügen', () => editor.chain().focus().addColumnAfter().run())}
                {menuItem('✕ Spalte löschen',          () => editor.chain().focus().deleteColumn().run(), true)}

                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

                {menuItem('✕ Tabelle löschen', () => editor.chain().focus().deleteTable().run(), true)}
              </div>
            )}
          </div>
        </BubbleMenu>
      )}

      {/* Editor canvas — owns the background, anchor for future block resizing/positioning */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '4px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
      }}>
        <button
          type="button"
          title="Verkleinern"
          onClick={() => zoomAt(window.innerWidth / 2, window.innerHeight / 2, viewport.zoom / 1.15)}
          style={{ width: 28, height: 28, border: 'none', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 16 }}
        >-</button>
        <div style={{ minWidth: 46, textAlign: 'center', fontSize: 12, color: 'var(--muted)', userSelect: 'none' }}>
          {Math.round(viewport.zoom * 100)}%
        </div>
        <button
          type="button"
          title="Vergrößern"
          onClick={() => zoomAt(window.innerWidth / 2, window.innerHeight / 2, viewport.zoom * 1.15)}
          style={{ width: 28, height: 28, border: 'none', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 16 }}
        >+</button>
      </div>

      <div
        data-editor-workspace="true"
        onDragOver={onWorkspaceDragOver}
        onDrop={onWorkspaceDrop}
        style={{
          position: 'relative',
          height: 'calc(100vh - 180px)',
          minHeight: '520px',
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'var(--bg)',
          backgroundImage: [
            'linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: `${40 * viewport.zoom}px ${40 * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          border: '1px solid var(--border)',
          touchAction: 'none',
          cursor: panMode ? 'grab' : undefined,
        }}
      >
        {editable && (
          <div
            data-element-palette="true"
            style={{
              position: 'absolute',
              top: 64,
              right: 10,
              zIndex: 55,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 34px)',
              gap: '5px',
              padding: '8px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            }}
          >
            <button
              type="button"
              title="Cursor-Modus"
              aria-pressed={!panMode}
              onPointerDown={e => {
                e.preventDefault()
                e.stopPropagation()
                setPanMode(false)
              }}
              style={{
                width: 34,
                height: 34,
                border: `1px solid ${!panMode ? 'var(--accent)' : 'transparent'}`,
                borderRadius: '6px',
                background: !panMode ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'none',
                color: !panMode ? 'var(--accent)' : 'var(--text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 17,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none',
              }}
              onMouseEnter={e => { if (panMode) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border)' } }}
              onMouseLeave={e => { if (panMode) { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent' } }}
            >
              ↖
            </button>
            <button
              type="button"
              title="Hand-Modus"
              aria-pressed={panMode}
              onPointerDown={e => {
                e.preventDefault()
                e.stopPropagation()
                setPanMode(true)
              }}
              style={{
                width: 34,
                height: 34,
                border: `1px solid ${panMode ? 'var(--accent)' : 'transparent'}`,
                borderRadius: '6px',
                background: panMode ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'none',
                color: panMode ? 'var(--accent)' : 'var(--text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none',
              }}
              onMouseEnter={e => { if (!panMode) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border)' } }}
              onMouseLeave={e => { if (!panMode) { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent' } }}
            >
              ✋
            </button>
            <div style={{ gridColumn: '1 / -1', height: 1, background: 'var(--border)', margin: '1px 0' }} />
            <button
              type="button"
              draggable
              title="Neuen Block hinzufügen"
              onClick={addSectionAtViewportCenter}
              onDragStart={startBlockDrag}
              style={{
                width: 34,
                height: 34,
                border: '1px solid transparent',
                borderRadius: '6px',
                background: 'none',
                color: 'var(--text)',
                cursor: 'grab',
                fontFamily: 'inherit',
                fontSize: 20,
                fontWeight: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent' }}
            >
              +
            </button>
            {ELEMENT_PALETTE.map(item => (
              <button
                key={item.key}
                type="button"
                draggable
                title={`${item.label} hinzufügen`}
                onClick={() => addElementToSelectedSection(item.key)}
                onDragStart={e => startPaletteDrag(e, item.key)}
                style={{
                  width: 34,
                  height: 34,
                  border: '1px solid transparent',
                  borderRadius: '6px',
                  background: 'none',
                  color: 'var(--text)',
                  cursor: 'grab',
                  fontFamily: 'inherit',
                  fontSize: item.icon.length > 2 ? 10 : 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent' }}
              >
                {item.icon}
              </button>
            ))}
          </div>
        )}

        {minimapVisible && (
          <div
            data-editor-minimap="true"
            title="Workspace-Navigation"
            onPointerEnter={() => setMinimapHovered(true)}
            onPointerLeave={() => setMinimapHovered(false)}
            onPointerDown={e => {
              e.preventDefault()
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              const worldX = minimapBounds.x + (e.clientX - rect.left - minimapContent.x) / minimapScale
              const worldY = minimapBounds.y + (e.clientY - rect.top - minimapContent.y) / minimapScale
              const insideView =
                worldX >= minimapView.x &&
                worldX <= minimapView.x + minimapView.w &&
                worldY >= minimapView.y &&
                worldY <= minimapView.y + minimapView.h
              const dragState = insideView
                ? { grabOffsetX: worldX - minimapView.x, grabOffsetY: worldY - minimapView.y }
                : { grabOffsetX: minimapView.w / 2, grabOffsetY: minimapView.h / 2 }
              minimapDragRef.current = dragState
              e.currentTarget.setPointerCapture(e.pointerId)
              panMinimapTo(e.clientX, e.clientY, e.currentTarget, dragState)
            }}
            onPointerMove={e => {
              const dragState = minimapDragRef.current
              if (!dragState) return
              e.preventDefault()
              panMinimapTo(e.clientX, e.clientY, e.currentTarget, dragState)
            }}
            onPointerUp={e => {
              minimapDragRef.current = null
              try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
            }}
            onPointerCancel={e => {
              minimapDragRef.current = null
              try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
            }}
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              zIndex: 60,
              width: minimapSize.w,
              height: minimapSize.h,
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--surface)',
              opacity: minimapHovered ? 1 : 0.42,
              boxShadow: '0 4px 18px rgba(0,0,0,0.14)',
              cursor: 'crosshair',
              overflow: 'hidden',
              touchAction: 'none',
              userSelect: 'none',
              transition: 'opacity 0.14s ease',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: minimapContent.x,
                top: minimapContent.y,
                width: minimapContent.w,
                height: minimapContent.h,
                background: 'var(--surface)',
                boxSizing: 'border-box',
              }}
            />
            {minimapBlocks.map(block => (
              <div
                key={block.id}
                style={{
                  position: 'absolute',
                  left: minimapContent.x + (block.x - minimapBounds.x) * minimapScale,
                  top: minimapContent.y + (block.y - minimapBounds.y) * minimapScale,
                  width: Math.max(3, block.w * minimapScale),
                  height: Math.max(3, block.h * minimapScale),
                  borderRadius: '2px',
                  background: 'var(--accent)',
                  opacity: 0.72,
                }}
              />
            ))}
            <div
              style={{
                position: 'absolute',
                left: minimapContent.x + (minimapView.x - minimapBounds.x) * minimapScale,
                top: minimapContent.y + (minimapView.y - minimapBounds.y) * minimapScale,
                width: Math.max(12, minimapView.w * minimapScale),
                height: Math.max(10, minimapView.h * minimapScale),
                border: '2px solid var(--accent2)',
                borderRadius: '3px',
                boxSizing: 'border-box',
                background: 'color-mix(in srgb, var(--accent2) 9%, transparent)',
                pointerEvents: 'none',
              }}
            />
          </div>
        )}

        <div
          data-editor-canvas="true"
          data-editor-zoom={viewport.zoom}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${CANVAS_W}px`,
            height: `${CANVAS_H}px`,
            minHeight: `${CANVAS_H}px`,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
            overflow: 'visible',
          }}
        >
          <EditorContent
            editor={editor}
            style={{
              width: '1200px',
              height: '100%',
              minHeight: `${CANVAS_H}px`,
              fontSize: '14px',
              lineHeight: 1.75,
            }}
          />

          {/* Add new block */}
          {editable && (
            <button
              data-new-block-btn="true"
              onClick={addSectionAtViewportCenter}
              style={{
                width: '1200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px',
                marginTop: '4px',
                background: 'var(--surface)',
                border: '1px dashed var(--border)',
                borderRadius: '10px',
                color: 'var(--muted)',
                fontSize: '13px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
            >
              <span style={{ fontSize: '18px', lineHeight: 1, fontWeight: 300 }}>+</span>
              Neuer Block
            </button>
          )}
        </div>
      </div>

      <style>{`
        /* Content inside section cards.
           height: PM's posAtCoords needs the editor root (and each section's
           .react-renderer wrapper, see SectionNode) to have real vertical bounds —
           with absolutely positioned sections it collapses to 0 and every coords
           lookup resolves to the doc end, breaking element drag & drop.
           pointer-events: none keeps empty-canvas clicks hitting the canvas, not
           the contenteditable; cards re-enable pointer events on their wrapper. */
        .ProseMirror { outline: none; height: 100%; pointer-events: none; }
        [data-node-view-content] { outline: none; }
        [data-node-view-content] > * + * { margin-top: 6px; }

        [data-node-view-content] h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px; line-height: 1.2; }
        [data-node-view-content] h2 { font-size: 19px; font-weight: 700; margin-bottom: 6px; line-height: 1.3; }
        [data-node-view-content] h3 { font-size: 15px; font-weight: 700; margin-bottom: 4px; }

        [data-node-view-content] p { margin: 0; line-height: 1.75; }
        [data-node-view-content] ul { padding-left: 22px; margin: 0; list-style-type: disc; }
        [data-node-view-content] ol { padding-left: 22px; margin: 0; list-style-type: decimal; }
        [data-node-view-content] li { margin-bottom: 3px; line-height: 1.75; }
        [data-node-view-content] li p { margin: 0; }

        [data-node-view-content] blockquote {
          border-left: 3px solid var(--accent);
          padding: 10px 16px;
          margin: 0;
          background: var(--surface2);
          border-radius: 0 8px 8px 0;
          color: var(--muted);
        }
        [data-node-view-content] blockquote p { margin: 0; }

        [data-node-view-content] code { background: var(--surface2); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
        [data-node-view-content] pre {
          background: #1a1a2a;
          color: #e8e8f0;
          padding: 18px 22px;
          border-radius: 10px;
          overflow-x: auto;
          border: 1px solid #2a2a3a;
          font-size: 13px;
          line-height: 1.6;
          margin: 0;
        }
        [data-node-view-content] pre code { background: none; padding: 0; font-size: inherit; color: inherit; }

        [data-node-view-content] hr { border: none; border-top: 1px solid var(--border); margin: 12px 0; }
        [data-node-view-content] a { color: var(--accent); text-decoration: underline; }
        [data-node-view-content] img { max-width: 100%; border-radius: 8px; display: block; }

        [data-node-view-content] table { border-collapse: collapse; width: 100%; }
        [data-node-view-content] td,
        [data-node-view-content] th { border: 1px solid var(--border); padding: 9px 13px; font-size: 13px; text-align: left; }
        [data-node-view-content] th { background: var(--surface2); font-weight: 700; }

        [data-node-view-content] p.is-empty::before {
          content: attr(data-placeholder);
          color: var(--muted);
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>
    </div>
  )
}
