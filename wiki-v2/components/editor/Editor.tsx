'use client'

import { useEditor, EditorContent } from '@tiptap/react'
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
import { useEffect } from 'react'

const lowlight = createLowlight(all)

interface EditorProps {
  content?: object | null
  onChange?: (json: object) => void
  editable?: boolean
}

export default function Editor({ content, onChange, editable = true }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      LinkExt.configure({ openOnClick: false }),
      ImageExt,
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder: 'Schreib etwas…' }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content ?? '',
    editable,
    onUpdate({ editor }) {
      onChange?.(editor.getJSON())
    },
  })

  useEffect(() => {
    if (editor && content && editor.isEmpty) {
      editor.commands.setContent(content)
    }
  }, [editor, content])

  if (!editor) return null

  const btn = (active: boolean) => ({
    padding: '4px 8px',
    borderRadius: '5px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'inherit',
    background: active ? 'var(--surface2)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--muted)',
    fontWeight: active ? 700 : 400,
    transition: 'all 0.1s',
  } as React.CSSProperties)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {editable && (
        <div style={{
          display: 'flex',
          gap: '2px',
          padding: '8px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          borderRadius: '10px 10px 0 0',
          flexWrap: 'wrap',
        }}>
          <button style={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
          <button style={{ ...btn(editor.isActive('italic')), fontStyle: 'italic' }} onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
          <button style={{ ...btn(editor.isActive('underline')), textDecoration: 'underline' }} onClick={() => editor.chain().focus().toggleUnderline().run()}>U</button>
          <button style={{ ...btn(editor.isActive('strike')), textDecoration: 'line-through' }} onClick={() => editor.chain().focus().toggleStrike().run()}>S</button>
          <span style={{ width: '1px', background: 'var(--border)', margin: '2px 6px' }} />
          {([1, 2, 3] as const).map(level => (
            <button key={level} style={btn(editor.isActive('heading', { level }))} onClick={() => editor.chain().focus().toggleHeading({ level }).run()}>
              H{level}
            </button>
          ))}
          <span style={{ width: '1px', background: 'var(--border)', margin: '2px 6px' }} />
          <button style={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• Liste</button>
          <button style={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. Liste</button>
          <span style={{ width: '1px', background: 'var(--border)', margin: '2px 6px' }} />
          <button style={btn(editor.isActive('codeBlock'))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{'</>'}</button>
          <button style={btn(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>&ldquo;</button>
          <button style={btn(false)} onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</button>
        </div>
      )}

      <EditorContent
        editor={editor}
        style={{
          flex: 1,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: editable ? '0 0 10px 10px' : '10px',
          padding: '24px 28px',
          minHeight: '400px',
          outline: 'none',
          lineHeight: 1.75,
          fontSize: '14px',
          overflowY: 'auto',
        }}
      />

      <style>{`
        .tiptap { outline: none; }
        .tiptap h1 { font-size: 24px; font-weight: 800; margin: 24px 0 8px; }
        .tiptap h2 { font-size: 20px; font-weight: 700; margin: 20px 0 6px; }
        .tiptap h3 { font-size: 16px; font-weight: 700; margin: 16px 0 4px; }
        .tiptap p { margin: 0 0 10px; }
        .tiptap ul, .tiptap ol { padding-left: 20px; margin: 0 0 10px; }
        .tiptap li { margin-bottom: 4px; }
        .tiptap blockquote { border-left: 3px solid var(--border); padding-left: 16px; color: var(--muted); margin: 12px 0; }
        .tiptap code { background: var(--surface2); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
        .tiptap pre { background: #1a1a2a; color: #e8e8f0; padding: 16px 20px; border-radius: 8px; margin: 12px 0; overflow-x: auto; }
        .tiptap pre code { background: none; padding: 0; font-size: 13px; }
        .tiptap hr { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
        .tiptap a { color: var(--accent); text-decoration: underline; }
        .tiptap table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        .tiptap td, .tiptap th { border: 1px solid var(--border); padding: 8px 12px; }
        .tiptap th { background: var(--surface2); font-weight: 700; }
        .tiptap p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--muted); pointer-events: none; float: left; height: 0; }
      `}</style>
    </div>
  )
}
