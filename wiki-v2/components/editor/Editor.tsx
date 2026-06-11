'use client'

import { useEditor, EditorContent } from '@tiptap/react'
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
import { SectionExtension } from './SectionNode'

const lowlight = createLowlight()
lowlight.register({ javascript, typescript, python, bash, css, xml, json, sql, go, rust, java, markdown })

// Wrap flat content (old notes) in a section so it renders as a card
function ensureSections(content: object | null | undefined): object | string {
  if (!content || typeof content !== 'object') return ''
  const doc = content as { type?: string; content?: Array<{ type: string }> }
  if (!doc.content?.length) return ''
  const hasSection = doc.content.some(n => n.type === 'section')
  if (hasSection) return content
  return { ...doc, content: [{ type: 'section', content: doc.content }] }
}

function addSection(editor: TiptapEditor) {
  editor.chain().focus()
    .insertContentAt(editor.state.doc.content.size, {
      type: 'section',
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

  if (!editor) return null

  const tBtn = (title: string, onClick: () => void, label: string, destructive = false) => (
    <button
      key={title}
      title={title}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '4px 7px', minWidth: '28px',
        background: 'none', border: '1px solid transparent', borderRadius: '6px',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', lineHeight: 1,
        color: destructive ? 'var(--accent2)' : 'var(--text)',
        transition: 'background 0.1s, border-color 0.1s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = destructive ? '#fff0f2' : 'var(--surface2)'
        e.currentTarget.style.borderColor = destructive ? 'var(--accent2)' : 'var(--border)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'none'
        e.currentTarget.style.borderColor = 'transparent'
      }}
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
    <div style={{ position: 'relative' }}>
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

      {/* Floating table toolbar — appears when cursor is inside a table cell */}
      {editable && (
        <BubbleMenu
          editor={editor}
          shouldShow={() => editor.isActive('tableCell') || editor.isActive('tableHeader')}
          tippyOptions={{ placement: 'right-start', offset: [0, 12] }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '6px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            fontFamily: 'inherit',
          }}>
            {/* Row controls */}
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--muted)', padding: '0 3px', letterSpacing: '0.06em' }}>ZEILE</span>
            {tBtn('Zeile darüber einfügen',  () => editor.chain().focus().addRowBefore().run(), '↑')}
            {tBtn('Zeile darunter einfügen', () => editor.chain().focus().addRowAfter().run(),  '↓')}
            {tBtn('Zeile löschen',           () => editor.chain().focus().deleteRow().run(),     '✕', true)}
            <div style={{ height: '1px', background: 'var(--border)', margin: '2px 0' }} />
            {/* Column controls */}
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--muted)', padding: '0 3px', letterSpacing: '0.06em' }}>SPALTE</span>
            {tBtn('Spalte links einfügen',  () => editor.chain().focus().addColumnBefore().run(), '←')}
            {tBtn('Spalte rechts einfügen', () => editor.chain().focus().addColumnAfter().run(),  '→')}
            {tBtn('Spalte löschen',         () => editor.chain().focus().deleteColumn().run(),    '✕', true)}
            <div style={{ height: '1px', background: 'var(--border)', margin: '2px 0' }} />
            {tBtn('Tabelle löschen', () => editor.chain().focus().deleteTable().run(), '✕ Tabelle', true)}
          </div>
        </BubbleMenu>
      )}

      {/* Editor area — transparent background, sections render as cards inside */}
      <EditorContent
        editor={editor}
        style={{
          fontSize: '14px',
          lineHeight: 1.75,
          minHeight: '120px',
        }}
      />

      {/* Global: Add new block (section/card) */}
      {editable && (
        <button
          data-new-block-btn="true"
          onClick={() => addSection(editor)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px',
            marginTop: '4px',
            background: 'none',
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
