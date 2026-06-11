'use client'

import { useState, useRef, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import LinkExt from '@tiptap/extension-link'
import ImageExt from '@tiptap/extension-image'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import { createLowlight, all } from 'lowlight'

const lowlight = createLowlight(all)

const BLOCKS = [
  { key: 'paragraph',   label: 'Text',          icon: '¶',   desc: 'Normaler Absatz' },
  { key: 'h1',          label: 'Überschrift 1',  icon: 'H1',  desc: 'Großer Titel' },
  { key: 'h2',          label: 'Überschrift 2',  icon: 'H2',  desc: 'Abschnittstitel' },
  { key: 'h3',          label: 'Überschrift 3',  icon: 'H3',  desc: 'Unterabschnitt' },
  { key: 'bulletList',  label: 'Aufzählung',     icon: '•',   desc: 'Ungeordnete Liste' },
  { key: 'orderedList', label: 'Nummeriert',     icon: '1.',  desc: 'Nummerierte Liste' },
  { key: 'codeBlock',   label: 'Code',           icon: '</>',  desc: 'Syntax Highlighting' },
  { key: 'blockquote',  label: 'Zitat',          icon: '"',   desc: 'Hervorgehobenes Zitat' },
  { key: 'hr',          label: 'Trennlinie',     icon: '—',   desc: 'Horizontale Linie' },
  { key: 'table',       label: 'Tabelle',        icon: '⊞',   desc: '3 × 3 Tabelle' },
  { key: 'image',       label: 'Bild',           icon: '⬜',  desc: 'Bild per URL' },
]

function insertBlock(editor: TiptapEditor, key: string) {
  const end = editor.state.doc.content.size
  if (key === 'table') {
    editor.chain().focus().setTextSelection(end).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    return
  }
  if (key === 'hr') {
    editor.chain().focus().insertContentAt(end, { type: 'horizontalRule' }).run()
    return
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
  const node = nodes[key]
  if (node) editor.chain().focus().insertContentAt(end, node).run()
}

interface EditorProps {
  content?: object | null
  onChange?: (json: object) => void
  editable?: boolean
}

export default function Editor({ content, onChange, editable = true }: EditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [imageInput, setImageInput] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [currentNodeInfo, setCurrentNodeInfo] = useState<{ pos: number; nodeSize: number } | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const initialContent = content && Object.keys(content).length > 0 ? content : ''

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      LinkExt.configure({ openOnClick: !editable }),
      ImageExt,
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder: 'Schreib etwas, oder klicke + um einen Block hinzuzufügen…' }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialContent,
    editable,
    onUpdate({ editor }) {
      onChange?.(editor.getJSON())
    },
  })

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    if (pickerOpen) document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [pickerOpen])

  function deleteCurrentBlock() {
    if (!editor || !currentNodeInfo) return
    const { pos, nodeSize } = currentNodeInfo
    editor.chain().focus().deleteRange({ from: pos, to: pos + nodeSize }).run()
  }

  function handleBlockSelect(key: string) {
    if (!editor) return
    if (key === 'image') { setPickerOpen(false); setImageInput(true); return }
    insertBlock(editor, key)
    setPickerOpen(false)
  }

  function handleImageInsert() {
    if (!editor || !imageUrl.trim()) return
    editor.chain().focus()
      .insertContentAt(editor.state.doc.content.size, { type: 'image', attrs: { src: imageUrl.trim() } })
      .run()
    setImageUrl('')
    setImageInput(false)
  }

  if (!editor) return null

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
            <button style={bBtn(editor.isActive('bold'),      { fontWeight: 800 })}                   onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
            <button style={bBtn(editor.isActive('italic'),    { fontStyle: 'italic' })}               onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
            <button style={bBtn(editor.isActive('underline'), { textDecoration: 'underline' })}       onClick={() => editor.chain().focus().toggleUnderline().run()}>U</button>
            <button style={bBtn(editor.isActive('strike'),    { textDecoration: 'line-through' })}    onClick={() => editor.chain().focus().toggleStrike().run()}>S</button>
            <button style={bBtn(editor.isActive('code'),      { fontFamily: 'monospace' })}           onClick={() => editor.chain().focus().toggleCode().run()}>`</button>
            <span style={{ width: '1px', background: '#2e2e42', margin: '2px 4px', alignSelf: 'stretch' }} />
            <button style={bBtn(editor.isActive('heading', { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
            <button style={bBtn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
            <button style={bBtn(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
          </div>
        </BubbleMenu>
      )}

      {/* Per-block drag handle with delete button */}
      {editable && (
        <DragHandle
          editor={editor}
          onNodeChange={({ node, pos }) => {
            if (node) setCurrentNodeInfo({ pos, nodeSize: node.nodeSize })
            else setCurrentNodeInfo(null)
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {/* Grip */}
            <div
              title="Verschieben"
              style={{
                cursor: 'grab',
                color: 'var(--muted)',
                fontSize: '14px',
                padding: '4px 3px',
                borderRadius: '4px',
                lineHeight: 1,
                userSelect: 'none',
              }}
            >
              ⠿
            </div>
            {/* Delete */}
            <button
              title="Block löschen"
              onClick={deleteCurrentBlock}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                fontSize: '13px',
                padding: '4px 5px',
                borderRadius: '4px',
                lineHeight: 1,
                fontFamily: 'inherit',
                transition: 'color 0.1s, background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent2)'; e.currentTarget.style.background = '#fff0f2' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none' }}
            >
              ✕
            </button>
          </div>
        </DragHandle>
      )}

      {/* Editor content */}
      <EditorContent
        editor={editor}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '28px 36px 28px 48px',
          minHeight: '420px',
          fontSize: '14px',
          lineHeight: 1.75,
        }}
      />

      {/* + Button & Block Picker */}
      {editable && (
        <div style={{ position: 'relative', marginTop: '10px' }} ref={pickerRef}>
          <button
            onClick={() => setPickerOpen(p => !p)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '9px',
              background: pickerOpen ? 'var(--surface2)' : 'none',
              border: '1px dashed var(--border)',
              borderRadius: '8px',
              color: 'var(--muted)',
              fontSize: '13px',
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1, fontWeight: 300 }}>+</span>
            Block hinzufügen
          </button>

          {pickerOpen && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '10px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '4px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              zIndex: 100,
            }}>
              {BLOCKS.map(block => (
                <button
                  key={block.key}
                  onClick={() => handleBlockSelect(block.key)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '3px',
                    padding: '10px 12px',
                    background: 'none',
                    border: '1px solid transparent',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent' }}
                >
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{block.icon}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>{block.label}</span>
                  <span style={{ fontSize: '10px', color: 'var(--muted)', lineHeight: 1.3 }}>{block.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image URL input */}
      {imageInput && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <input
            autoFocus
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleImageInsert(); if (e.key === 'Escape') setImageInput(false) }}
            placeholder="https://example.com/bild.jpg"
            style={{
              flex: 1, padding: '9px 14px',
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: '8px', fontSize: '13px',
              fontFamily: 'inherit', color: 'var(--text)', outline: 'none',
            }}
          />
          <button onClick={handleImageInsert} style={{ padding: '9px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 }}>
            Einfügen
          </button>
          <button onClick={() => setImageInput(false)} style={{ padding: '9px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', color: 'var(--muted)' }}>
            ✕
          </button>
        </div>
      )}

      <style>{`
        .tiptap { outline: none; }

        /* Block separation — each top-level block gets a hover highlight + left indicator */
        .tiptap > * {
          position: relative;
          padding: 3px 4px 3px 10px;
          margin: 0 -4px 2px -10px;
          border-left: 2px solid transparent;
          border-radius: 0 6px 6px 0;
          transition: background 0.1s, border-color 0.1s;
        }
        .tiptap > *:hover {
          background: rgba(0, 0, 0, 0.025);
          border-left-color: var(--border);
        }
        .tiptap > h1:hover { border-left-color: var(--accent); }
        .tiptap > h2:hover { border-left-color: var(--accent); }
        .tiptap > h3:hover { border-left-color: var(--accent); }
        .tiptap > pre:hover { border-left-color: #4488ff; background: none; }
        .tiptap > blockquote:hover { background: none; }

        /* Block spacing */
        .tiptap > * + * { margin-top: 4px; }
        .tiptap > h1 + * { margin-top: 8px; }
        .tiptap > h2 + * { margin-top: 6px; }

        /* Typography */
        .tiptap h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; margin-top: 32px; margin-bottom: 4px; line-height: 1.2; }
        .tiptap h2 { font-size: 20px; font-weight: 700; margin-top: 24px; margin-bottom: 4px; line-height: 1.3; }
        .tiptap h3 { font-size: 16px; font-weight: 700; margin-top: 18px; margin-bottom: 2px; }
        .tiptap h1:first-child, .tiptap h2:first-child, .tiptap h3:first-child { margin-top: 0; }

        .tiptap p { margin: 0; line-height: 1.75; }
        .tiptap ul, .tiptap ol { padding-left: 22px; margin: 0; }
        .tiptap li { margin-bottom: 3px; line-height: 1.75; }
        .tiptap li p { margin: 0; }

        .tiptap blockquote {
          border-left: 3px solid var(--accent) !important;
          padding: 12px 16px !important;
          margin: 4px 0 !important;
          background: var(--surface2) !important;
          border-radius: 0 8px 8px 0;
          color: var(--muted);
        }
        .tiptap blockquote p { margin: 0; }

        .tiptap code { background: var(--surface2); padding: 2px 6px; border-radius: 4px; font-size: 12px; }

        .tiptap pre {
          background: #1a1a2a;
          color: #e8e8f0;
          padding: 20px 24px;
          border-radius: 10px;
          margin: 4px 0;
          overflow-x: auto;
          border: 1px solid #2a2a3a;
          font-size: 13px;
          line-height: 1.6;
        }
        .tiptap pre code { background: none; padding: 0; font-size: inherit; color: inherit; }

        .tiptap hr { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
        .tiptap a { color: var(--accent); text-decoration: underline; }
        .tiptap img { max-width: 100%; border-radius: 8px; margin: 4px 0; display: block; }

        .tiptap table { border-collapse: collapse; width: 100%; margin: 4px 0; }
        .tiptap td, .tiptap th { border: 1px solid var(--border); padding: 10px 14px; font-size: 13px; text-align: left; }
        .tiptap th { background: var(--surface2); font-weight: 700; }

        .tiptap p.is-editor-empty:first-child::before {
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
