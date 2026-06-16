'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
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
import markdown from 'highlight.js/lib/languages/markdown'
import { useEffect, useRef, useState } from 'react'
import { SectionExtension, sectionSel } from './SectionNode'

const lowlight = createLowlight()
lowlight.register({ javascript, typescript, python, bash, css, xml, json, sql, markdown })

const ArticleDocument = Document.extend({
  content: 'section+',
})

const ELEMENT_PALETTE = [
  { key: 'paragraph', label: 'Textblock', icon: 'T' },
  { key: 'h1', label: 'Titel', icon: 'H1' },
  { key: 'h2', label: 'Ueberschrift', icon: 'H2' },
  { key: 'h3', label: 'Untertitel', icon: 'H3' },
  { key: 'blockquote', label: 'Zitat', icon: '"' },
  { key: 'bulletList', label: 'Liste', icon: 'UL' },
  { key: 'orderedList', label: 'Nummerierte Liste', icon: '1.' },
  { key: 'table', label: 'Tabelle', icon: 'TB' },
  { key: 'image', label: 'Bild', icon: 'IMG' },
  { key: 'codeBlock', label: 'Codeblock', icon: '</>' },
  { key: 'hr', label: 'Trennlinie', icon: '-' },
]

const EMPTY_ARTICLE = {
  type: 'doc',
  attrs: { wikiMode: 'article' },
  content: [
    {
      type: 'section',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Abschnitt' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Eintrag' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Schreibe hier deinen Artikel im Stil von wiki v1.' }] },
      ],
    },
  ],
}

interface SlashMenuState {
  from: number
  to: number
  query: string
  left: number
  top: number
  selected: number
}

interface ArticleEditorProps {
  content?: object | null
  onChange?: (json: object) => void
  editable?: boolean
}

function withArticleMode(json: object) {
  return {
    ...(json as Record<string, unknown>),
    attrs: { ...((json as { attrs?: object }).attrs ?? {}), wikiMode: 'article' },
  }
}

function normalizeArticleContent(content: object | null | undefined): object {
  if (!content || typeof content !== 'object') return EMPTY_ARTICLE
  const doc = content as { type?: string; content?: Array<{ type?: string }> }
  if (!doc.content?.length) return EMPTY_ARTICLE
  if (doc.content.every(node => node.type === 'section')) return withArticleMode(content)
  return withArticleMode({
    type: 'doc',
    content: [{ type: 'section', content: doc.content }],
  })
}

function dispatchAddElement(key: string, targetPos?: number) {
  document.dispatchEvent(new CustomEvent('wiki-editor-add-element', { detail: { key, targetPos } }))
}

export default function ArticleEditor({ content, onChange, editable = true }: ArticleEditorProps) {
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const [tableMenuOpen, setTableMenuOpen] = useState(false)
  const slashMenuRef = useRef<SlashMenuState | null>(null)
  const lastInsertPosRef = useRef<number | null>(null)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ document: false, codeBlock: false, link: { openOnClick: !editable } }),
      ArticleDocument,
      ImageExt,
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true, cellMinWidth: 80 }),
      TableRow,
      TableHeader,
      TableCell,
      SectionExtension,
    ],
    content: normalizeArticleContent(content),
    editable,
    immediatelyRender: true,
    onUpdate({ editor }) {
      onChange?.(withArticleMode(editor.getJSON()))
      syncSlashMenu(editor)
    },
    onSelectionUpdate({ editor }) {
      syncSlashMenu(editor)
    },
    onBlur() {
      window.setTimeout(() => setSlashMenu(null), 120)
    },
  }, [editable])

  useEffect(() => {
    slashMenuRef.current = slashMenu
  }, [slashMenu])

  useEffect(() => {
    if (!editor || !editable) return
    function onKeyDown(e: KeyboardEvent) {
      const menu = slashMenuRef.current
      if (!menu) return
      const items = slashItems(menu.query)
      if (e.key === 'Escape') {
        e.preventDefault()
        setSlashMenu(null)
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashMenu(current => current
          ? { ...current, selected: (current.selected + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length) }
          : current)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (!items.length) return
        e.preventDefault()
        executeSlashCommand(editor, items[menu.selected]?.key ?? items[0].key, menu)
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [editor, editable])

  useEffect(() => {
    if (!tableMenuOpen) return
    function close() { setTableMenuOpen(false) }
    setTimeout(() => document.addEventListener('click', close), 0)
    return () => document.removeEventListener('click', close)
  }, [tableMenuOpen])

  if (!editor) return null

  function syncSlashMenu(ed: TiptapEditor) {
    const { selection } = ed.state
    if (selection.empty) lastInsertPosRef.current = selection.from
    if (!selection.empty || !ed.isEditable) {
      setSlashMenu(null)
      return
    }
    const { $from } = selection
    if (!$from.parent.isTextblock) {
      setSlashMenu(null)
      return
    }
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, node => node.type.name === 'hardBreak' ? '\n' : '\ufffc')
    const currentLine = textBefore.slice(textBefore.lastIndexOf('\n') + 1)
    const match = currentLine.match(/^\/([^\s/]*)$/)
    if (!match) {
      setSlashMenu(null)
      return
    }
    try {
      const coords = ed.view.coordsAtPos(selection.from)
      const query = match[1]
      setSlashMenu(previous => ({
        from: selection.from - query.length - 1,
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

  function slashItems(query: string) {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return ELEMENT_PALETTE
    return ELEMENT_PALETTE.filter(item => `${item.label} ${item.key}`.toLowerCase().includes(normalized))
  }

  function executeSlashCommand(ed: TiptapEditor, key: string, menu: SlashMenuState) {
    ed.chain().focus().deleteRange({ from: menu.from, to: menu.to }).run()
    window.requestAnimationFrame(() => dispatchAddElement(key, menu.from))
    setSlashMenu(null)
  }

  function appendBlock() {
    editor.chain().focus().insertContentAt(editor.state.doc.content.size, {
      type: 'section',
      content: [
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Neuer Eintrag' }] },
        { type: 'paragraph' },
      ],
    }).run()
  }

  function startPaletteDrag(e: React.DragEvent, key: string) {
    e.dataTransfer.setData('application/x-wiki-element', key)
    e.dataTransfer.effectAllowed = 'copy'
  }

  function getBottomBlockInsertPos() {
    let insertPos: number | null = null
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === 'section') insertPos = offset + node.nodeSize - 1
    })
    return insertPos
  }

  function insertPaletteElement(key: string) {
    const targetPos = lastInsertPosRef.current ?? getBottomBlockInsertPos()
    dispatchAddElement(key, targetPos ?? undefined)
  }

  function getTableRect() {
    try {
      const { node } = editor.view.domAtPos(editor.state.selection.from)
      let el: Element | null = node instanceof Element ? node : (node as Node).parentElement
      while (el && el.tagName !== 'TABLE') el = el.parentElement
      if (el) return el.getBoundingClientRect()
    } catch {}
    return editor.view.dom.getBoundingClientRect()
  }

  function tableMenuItem(label: string, onClick: () => void, destructive = false) {
    return (
      <button
        key={label}
        type="button"
        onClick={() => { onClick(); setTableMenuOpen(false) }}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '6px 10px',
          background: 'none',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '13px',
          color: destructive ? 'var(--accent2)' : 'var(--text)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = destructive ? '#fff0f2' : 'var(--surface2)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
      >
        {label}
      </button>
    )
  }

  const items = slashMenu ? slashItems(slashMenu.query) : []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1040px) 88px', gap: '14px', alignItems: 'start' }}>
      {slashMenu && (
        <div
          style={{
            position: 'fixed',
            left: slashMenu.left,
            top: slashMenu.top,
            zIndex: 100000,
            width: 260,
            maxHeight: 320,
            overflowY: 'auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '6px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.16)',
          }}
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => executeSlashCommand(editor, item.key, slashMenu)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 9px',
                border: 0,
                borderRadius: '6px',
                background: index === slashMenu.selected ? 'var(--surface2)' : 'transparent',
                color: 'var(--text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '12px',
                textAlign: 'left',
              }}
            >
              <span style={{ width: 34, color: 'var(--accent)', fontWeight: 800 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}

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
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setTableMenuOpen(open => !open) }}
              title="Tabelle bearbeiten"
              style={{
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: '1px solid var(--border)',
                background: tableMenuOpen ? 'var(--accent)' : 'var(--surface)',
                color: tableMenuOpen ? '#fff' : 'var(--muted)',
                cursor: 'pointer',
                fontSize: '18px',
                lineHeight: 1,
                fontWeight: 300,
                boxShadow: '0 1px 6px rgba(0,0,0,0.1)',
              }}
            >
              +
            </button>

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
                  minWidth: '200px',
                  zIndex: 100001,
                }}
              >
                <div style={tableMenuLabelStyle}>ZEILE</div>
                {tableMenuItem('Zeile davor einfuegen', () => editor.chain().focus().addRowBefore().run())}
                {tableMenuItem('Zeile danach einfuegen', () => editor.chain().focus().addRowAfter().run())}
                {tableMenuItem('Zeile loeschen', () => editor.chain().focus().deleteRow().run(), true)}

                <div style={tableMenuDividerStyle} />

                <div style={tableMenuLabelStyle}>SPALTE</div>
                {tableMenuItem('Spalte davor einfuegen', () => editor.chain().focus().addColumnBefore().run())}
                {tableMenuItem('Spalte danach einfuegen', () => editor.chain().focus().addColumnAfter().run())}
                {tableMenuItem('Spalte loeschen', () => editor.chain().focus().deleteColumn().run(), true)}

                <div style={tableMenuDividerStyle} />

                {tableMenuItem('Tabelle loeschen', () => editor.chain().focus().deleteTable().run(), true)}
              </div>
            )}
          </div>
        </BubbleMenu>
      )}

      <div data-article-editor="true">
        <EditorContent editor={editor} />
        {editable && (
          <div style={{ display: 'flex', marginTop: '12px', paddingBottom: '28px' }}>
            <button type="button" onClick={appendBlock} style={appendButtonStyle}>+ Block hinzufuegen</button>
          </div>
        )}
      </div>

      {editable && (
        <aside
          data-article-tool-palette="true"
          style={{
            position: 'sticky',
            top: 14,
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
              title={`${item.label} einfuegen`}
              onClick={() => insertPaletteElement(item.key)}
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
                fontSize: item.icon.length > 2 ? 9 : 11,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none',
              }}
            >
              {item.icon}
            </button>
          ))}
        </aside>
      )}

      <style>{`
        [data-article-editor] .ProseMirror {
          outline: none;
          font-size: 16px;
          line-height: 1.75;
          color: var(--text);
        }
        [data-article-editor] .ProseMirror > * + * { margin-top: 12px; }
        [data-article-editor] [data-section-card] {
          border-radius: 12px !important;
          min-height: 0 !important;
          padding: 24px 28px 22px 44px !important;
          box-shadow: none !important;
        }
        [data-article-editor] [data-section-card] h1 {
          font-size: 30px;
          line-height: 1.2;
          font-weight: 800;
          margin: 0 0 18px;
        }
        [data-article-editor] [data-section-card] h2 {
          font-size: 22px;
          line-height: 1.3;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin: 0 0 14px;
        }
        [data-article-editor] [data-section-card] h3 {
          font-size: 18px;
          line-height: 1.4;
          font-weight: 700;
          margin: 0 0 10px;
        }
        [data-article-editor] [data-section-card] p { margin: 0; }
        [data-article-editor] [data-section-card] ul,
        [data-article-editor] [data-section-card] ol { padding-left: 24px; margin: 0; }
        [data-article-editor] [data-section-card] li + li { margin-top: 6px; }
        [data-article-editor] [data-section-card] blockquote {
          border-left: 3px solid var(--accent);
          margin: 0;
          padding: 12px 16px;
          background: var(--surface2);
          color: var(--text);
          border-radius: 0 8px 8px 0;
        }
        [data-article-editor] [data-section-card] pre {
          background: #1a1a2a;
          color: #e8e8f0;
          padding: 18px 20px;
          border-radius: 8px;
          overflow-x: auto;
          border: 1px solid #2a2a3a;
        }
        [data-article-editor] [data-section-card] code {
          background: var(--surface2);
          padding: 2px 5px;
          border-radius: 4px;
          font-size: 13px;
        }
        [data-article-editor] [data-section-card] pre code { background: none; padding: 0; }
        [data-article-editor] [data-section-card] hr {
          border: none;
          border-top: 1px solid var(--border);
          margin: 16px 0;
        }
        [data-article-editor] [data-section-card] img {
          max-width: 100%;
          border-radius: 8px;
          display: block;
        }
        [data-article-editor] [data-section-card] table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 12px 0;
          overflow: hidden;
          border: 1px solid var(--border);
        }
        [data-article-editor] [data-section-card] td,
        [data-article-editor] [data-section-card] th {
          border: 1px solid var(--border);
          padding: 9px 12px;
          text-align: left;
          font-size: 14px;
          line-height: 1.65;
          min-width: 120px;
          vertical-align: top;
        }
        [data-article-editor] [data-section-card] td p,
        [data-article-editor] [data-section-card] th p { min-height: 24px; }
        [data-article-editor] [data-section-card] th {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          background: var(--surface2);
          font-weight: 700;
        }
        [data-article-editor] .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background: var(--accent);
          pointer-events: none;
        }
        [data-article-editor] .resize-cursor {
          cursor: col-resize;
        }
      `}</style>
    </div>
  )
}

const tableMenuLabelStyle = {
  fontSize: '9px',
  fontWeight: 700,
  color: 'var(--muted)',
  padding: '2px 6px 4px',
  letterSpacing: '0.07em',
}

const tableMenuDividerStyle = {
  height: '1px',
  background: 'var(--border)',
  margin: '4px 0',
}

const appendButtonStyle = {
  flex: 1,
  padding: '11px 14px',
  background: 'var(--surface)',
  border: '1px dashed var(--border)',
  borderRadius: '8px',
  color: 'var(--muted)',
  fontSize: '13px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
}
