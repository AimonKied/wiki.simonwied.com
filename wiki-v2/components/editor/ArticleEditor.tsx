'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/react'
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
  { key: 'paragraph', label: 'Text', icon: 'P' },
  { key: 'h2', label: 'Abschnitt', icon: 'H2' },
  { key: 'h3', label: 'Eintrag', icon: 'H3' },
  { key: 'bulletList', label: 'Liste', icon: 'UL' },
  { key: 'orderedList', label: 'Nummern', icon: '1.' },
  { key: 'codeBlock', label: 'Code', icon: '</>' },
  { key: 'blockquote', label: 'Hinweis', icon: '"' },
  { key: 'hr', label: 'Linie', icon: '-' },
  { key: 'table', label: 'Tabelle', icon: 'TB' },
  { key: 'image', label: 'Bild', icon: 'IMG' },
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
  const slashMenuRef = useRef<SlashMenuState | null>(null)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ document: false, codeBlock: false, link: { openOnClick: !editable } }),
      ArticleDocument,
      ImageExt,
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
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

  if (!editor) return null

  function syncSlashMenu(ed: TiptapEditor) {
    const { selection } = ed.state
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
              onClick={() => dispatchAddElement(item.key)}
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
        [data-article-editor] [data-section-card] h1 { display: none; }
        [data-article-editor] [data-section-card] h2 {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 22px;
          line-height: 1.3;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin: 0 0 18px;
        }
        [data-article-editor] [data-section-card] h2::before {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent);
          flex-shrink: 0;
        }
        [data-article-editor] [data-section-card] h2::after {
          content: '';
          height: 1px;
          background: var(--border);
          flex: 1;
        }
        [data-article-editor] [data-section-card] h3 {
          font-size: 18px;
          line-height: 1.4;
          font-weight: 700;
          margin: 0 0 10px;
        }
        [data-article-editor] [data-section-card] h3::before {
          content: '#';
          color: var(--accent);
          margin-right: 10px;
          font-size: 14px;
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
          width: 100%;
          margin: 12px 0;
        }
        [data-article-editor] [data-section-card] td,
        [data-article-editor] [data-section-card] th {
          border-bottom: 1px solid var(--border);
          padding: 9px 12px;
          text-align: left;
          font-size: 14px;
          line-height: 1.65;
        }
        [data-article-editor] [data-section-card] th {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          background: transparent;
          font-weight: 700;
        }
      `}</style>
    </div>
  )
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
