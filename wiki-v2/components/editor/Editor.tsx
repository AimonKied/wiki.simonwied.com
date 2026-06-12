'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import React, { useState, useEffect, useRef } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
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

const ELEMENT_PALETTE = [
  { key: 'paragraph',   label: 'Text',  icon: '¶'   },
  { key: 'h1',          label: 'H1',    icon: 'H1'  },
  { key: 'h2',          label: 'H2',    icon: 'H2'  },
  { key: 'h3',          label: 'H3',    icon: 'H3'  },
  { key: 'bulletList',  label: 'Liste', icon: '•'   },
  { key: 'orderedList', label: '1.',    icon: '1.'  },
  { key: 'codeBlock',   label: 'Code',  icon: '</>' },
  { key: 'blockquote',  label: 'Zitat', icon: '"'   },
  { key: 'hr',          label: 'Linie', icon: '—'   },
  { key: 'table',       label: 'Table', icon: '⊞'   },
  { key: 'image',       label: 'Bild',  icon: '▧'   },
]

// Wrap flat content (old notes) in a section so it renders as a card
function ensureSections(content: object | null | undefined): object | string {
  if (!content || typeof content !== 'object') return ''
  const doc = content as { type?: string; content?: Array<{ type: string; attrs?: Record<string, unknown>; content?: unknown }> }
  if (!doc.content?.length) return ''
  const hasSection = doc.content.some(n => n.type === 'section')
  const sections = hasSection ? doc.content : [{ type: 'section', content: doc.content }]
  let sectionIndex = 0
  return {
    ...doc,
    content: sections.map(node => {
      if (node.type !== 'section') return node
      const attrs = node.attrs ?? {}
      const hasCanvasPosition = attrs.x !== undefined && attrs.x !== null && attrs.y !== undefined && attrs.y !== null
      const next = {
        ...node,
        attrs: hasCanvasPosition
          ? attrs
          : { ...attrs, x: 0, y: sectionIndex * 180, w: null, h: null },
      }
      sectionIndex += 1
      return next
    }),
  }
}

function addSection(editor: TiptapEditor, attrs: Record<string, number | null> = {}) {
  editor.chain().focus()
    .insertContentAt(editor.state.doc.content.size, {
      type: 'section',
      attrs,
      content: [{ type: 'paragraph' }],
    })
    .run()
}

interface EditorProps {
  content?: object | null
  onChange?: (json: object) => void
  editable?: boolean
}

export default function Editor({ content, onChange, editable = true }: EditorProps) {
  const initialContent = ensureSections(content)
  const [tableMenuOpen, setTableMenuOpen] = useState(false)
  const [viewport, setViewport] = useState({ x: 80, y: 48, zoom: 1 })
  const viewportRef = useRef(viewport)
  const spaceDownRef = useRef(false)

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  function zoomAt(clientX: number, clientY: number, nextZoom: number) {
    const viewportEl = document.querySelector('[data-editor-workspace]') as HTMLElement | null
    if (!viewportEl) {
      setViewport(v => ({ ...v, zoom: nextZoom }))
      return
    }
    const rect = viewportEl.getBoundingClientRect()
    setViewport(v => {
      const zoom = Math.max(0.25, Math.min(2.5, nextZoom))
      const worldX = (clientX - rect.left - v.x) / v.zoom
      const worldY = (clientY - rect.top - v.y) / v.zoom
      return {
        x: clientX - rect.left - worldX * zoom,
        y: clientY - rect.top - worldY * zoom,
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
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      spaceDownRef.current = true
      document.body.style.cursor = 'grab'
      e.preventDefault()
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      spaceDownRef.current = false
      document.body.style.cursor = ''
    }

    function onMouseDown(e: MouseEvent) {
      if (!spaceDownRef.current || e.button !== 0) return
      const target = e.target as Element
      if (!target.closest('[data-editor-workspace]')) return
      e.preventDefault()
      const startX = e.clientX
      const startY = e.clientY
      const startView = viewportRef.current
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'

      function onMove(ev: MouseEvent) {
        setViewport(v => ({ ...v, x: startView.x + ev.clientX - startX, y: startView.y + ev.clientY - startY }))
      }

      function onUp() {
        document.body.style.cursor = spaceDownRef.current ? 'grab' : ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
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

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('wheel', onWheel)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [editable])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: { openOnClick: !editable },
      }),
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
    },
  })

  useEffect(() => {
    if (!tableMenuOpen) return
    const close = () => setTableMenuOpen(false)
    // setTimeout(0): defer until after the current click event finishes propagating,
    // otherwise the click that opened the menu immediately triggers the listener
    const id = window.setTimeout(() => document.addEventListener('click', close), 0)
    return () => { window.clearTimeout(id); document.removeEventListener('click', close) }
  }, [tableMenuOpen])

  if (!editor) return null

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

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Floating format menu on text selection */}
      {editable && (
        <BubbleMenu editor={editor}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            background: '#1a1a2a',
            border: '1px solid #2e2e42',
            borderRadius: '8px',
            padding: '4px 6px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          }}>
            <button style={bBtn(editor.isActive('bold'),      { fontWeight: 800 })}              onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
            <button style={bBtn(editor.isActive('italic'),    { fontStyle: 'italic' })}          onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
            <button style={bBtn(editor.isActive('underline'), { textDecoration: 'underline' })}  onClick={() => editor.chain().focus().toggleUnderline().run()}>U</button>
            <button style={bBtn(editor.isActive('strike'),    { textDecoration: 'line-through' })} onClick={() => editor.chain().focus().toggleStrike().run()}>S</button>
            <button style={bBtn(editor.isActive('code'),      { fontFamily: 'monospace' })}      onClick={() => editor.chain().focus().toggleCode().run()}>`</button>
            <span style={{ width: '1px', background: '#2e2e42', margin: '2px 4px', alignSelf: 'stretch' }} />
            <button style={bBtn(editor.isActive('heading', { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
            <button style={bBtn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
            <button style={bBtn(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
          </div>
        </BubbleMenu>
      )}

      {/* Table corner "+" — shows when cursor is in a table cell */}
      {editable && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor }) => editor.isActive('tableCell') || editor.isActive('tableHeader')}
          tippyOptions={{
            placement: 'top-end',
            offset: [0, 8],
            hideOnClick: false,
            onHide: () => setTableMenuOpen(false),
            getReferenceClientRect: getTableRect,
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
        }}
      >
        {editable && (
          <div
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

        <div
          data-editor-canvas="true"
          data-editor-zoom={viewport.zoom}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '9000px',
            height: '4000px',
            minHeight: '4000px',
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
            overflow: 'visible',
          }}
        >
          <EditorContent
            editor={editor}
            style={{
              width: '1200px',
              minHeight: '4000px',
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
        /* Content inside section cards */
        .ProseMirror { outline: none; }
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
