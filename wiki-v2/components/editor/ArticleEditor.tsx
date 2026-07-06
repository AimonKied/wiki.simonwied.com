'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { Mark, mergeAttributes } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Placeholder from '@tiptap/extension-placeholder'
import { ResizableImage } from './MediaNodes'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { TaskList, TaskItem } from '@tiptap/extension-list'
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
import { transformVisualLine } from './editorTransforms'
import { ToggleExtension } from './ToggleNode'
import { CalloutExtension } from './CalloutNode'
import { filterPalette } from './elementPalette'

const TEXT_STYLE_MARK = 'wikiTextStyle'

const TextStyle = Mark.create({
  name: TEXT_STYLE_MARK,
  addAttributes() {
    return {
      fontFamily:      { default: null, parseHTML: el => el.style.fontFamily || null },
      fontSize:        { default: null, parseHTML: el => el.style.fontSize || null },
      color:           { default: null, parseHTML: el => el.style.color || null },
      backgroundColor: { default: null, parseHTML: el => el.style.backgroundColor || null },
    }
  },
  parseHTML() { return [{ tag: 'span[style]' }] },
  renderHTML({ HTMLAttributes }) {
    const { fontFamily, fontSize, color, backgroundColor, ...rest } = HTMLAttributes
    const style = [
      fontFamily      && `font-family:${fontFamily}`,
      fontSize        && `font-size:${fontSize}`,
      color           && `color:${color}`,
      backgroundColor && `background-color:${backgroundColor}`,
    ].filter(Boolean).join(';')
    return ['span', mergeAttributes(rest, { style }), 0]
  },
})

const FONT_FAMILIES = [
  { label: 'Standard',   value: null },
  { label: 'Arial',      value: 'Arial, sans-serif' },
  { label: 'Georgia',    value: 'Georgia, serif' },
  { label: 'Times',      value: '"Times New Roman", serif' },
  { label: 'Monospace',  value: 'monospace' },
]

const FONT_SIZES = ['12px', '14px', '15px', '16px', '18px', '19px', '24px', '26px', '32px', '40px', '48px']

const bBtn = (active: boolean, extra?: React.CSSProperties): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  minWidth: 28, height: 26, padding: '4px 5px',
  border: 'none', borderRadius: 5, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 13,
  fontWeight: active ? 700 : 400,
  background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
  color: '#e8e8f0',
  transition: 'background 0.1s',
  ...extra,
})

const lowlight = createLowlight()
lowlight.register({ javascript, typescript, python, bash, css, xml, json, sql, markdown })

const ArticleDocument = Document.extend({
  content: 'section+',
  addAttributes() {
    return {
      wikiMode: { default: 'article' },
      blockModel: { default: 'linear-section-blocks' },
    }
  },
})

const EMPTY_ARTICLE = {
  type: 'doc',
  attrs: { wikiMode: 'article', blockModel: 'linear-section-blocks' },
  content: [
    {
      type: 'section',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Abschnitt' }] },
      ],
    },
    {
      type: 'section',
      content: [
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Eintrag' }] },
      ],
    },
    {
      type: 'section',
      content: [
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
    attrs: {
      ...((json as { attrs?: object }).attrs ?? {}),
      wikiMode: 'article',
      blockModel: 'linear-section-blocks',
    },
  }
}

function normalizeArticleContent(content: object | null | undefined): object {
  if (!content || typeof content !== 'object') return EMPTY_ARTICLE
  const doc = content as { type?: string; attrs?: object; content?: Array<{ type?: string; attrs?: object; content?: object[] }> }
  if (!doc.content?.length) return EMPTY_ARTICLE
  if (doc.content.every(node => node.type === 'section')) {
    const linearSections = doc.content.flatMap(section => {
      if (!section.content?.length || section.content.length === 1) return [section]
      return section.content.map((child, index) => ({
        type: 'section',
        attrs: index === 0 ? section.attrs : undefined,
        content: [child],
      }))
    })
    return withArticleMode({ ...doc, content: linearSections })
  }
  return withArticleMode({
    type: 'doc',
    content: doc.content.map(node => ({ type: 'section', content: [node] })),
  })
}

function dispatchAddElement(key: string, targetPos?: number) {
  document.dispatchEvent(new CustomEvent('wiki-editor-add-element', { detail: { key, targetPos } }))
}

export default function ArticleEditor({ content, onChange, editable = true }: ArticleEditorProps) {
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const [tableMenuOpen, setTableMenuOpen] = useState(false)
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const slashMenuRef = useRef<SlashMenuState | null>(null)
  const slashMenuListRef = useRef<HTMLDivElement>(null)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ document: false, codeBlock: false, link: { openOnClick: !editable } }),
      ArticleDocument,
      Placeholder.configure({
        // Blocks live inside section nodes; without includeChildren the plugin
        // never descends into them and no placeholder ever rendered.
        includeChildren: true,
        showOnlyCurrent: false,
        placeholder: ({ editor: ed, node, pos, hasAnchor }) => {
          // Notion-like: hint only on the focused empty line, and only for
          // top-level lines — not inside tables, toggles or callouts.
          // isFocused: ohne Fokus im Editor (z. B. Cursor im Titel oder nach
          // dem Laden) soll gar kein Hinweis erscheinen.
          if (!ed.isFocused || node.type.name !== 'paragraph' || !hasAnchor) return ''
          try {
            const $pos = ed.state.doc.resolve(pos)
            if ($pos.depth !== 1 || $pos.parent.type.name !== 'section') return ''
          } catch { return '' }
          return 'Schreibe etwas oder drücke „/“ für Befehle'
        },
      }),
      TextStyle,
      ResizableImage,
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true, cellMinWidth: 80 }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      SectionExtension,
      ToggleExtension,
      CalloutExtension,
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

  // Writing surface sits directly on the page since the panel was removed —
  // hide the decorative grid so text stays readable (edit and read-only alike).
  useEffect(() => {
    document.body.setAttribute('data-calm-bg', 'true')
    return () => document.body.removeAttribute('data-calm-bg')
  }, [])

  useEffect(() => {
    const readTheme = () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
    readTheme()
    window.addEventListener('wiki-theme-change', readTheme)
    return () => window.removeEventListener('wiki-theme-change', readTheme)
  }, [])

  useEffect(() => {
    if (!slashMenuListRef.current || slashMenu === null) return
    const el = slashMenuListRef.current.children[slashMenu.selected] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [slashMenu?.selected])

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

  const slashItems = filterPalette

  function executeSlashCommand(ed: TiptapEditor, key: string, menu: SlashMenuState) {
    setSlashMenu(null)
    if (key === 'image') {
      transformVisualLine(ed, 'paragraph', { from: menu.from, to: menu.to })
      window.requestAnimationFrame(() => dispatchAddElement(key, ed.state.selection.from))
      return
    }
    if (transformVisualLine(ed, key, { from: menu.from, to: menu.to })) return
    const chain = ed.chain().focus().deleteRange({ from: menu.from, to: menu.to })
    if (key === 'paragraph')   { chain.setParagraph().run(); return }
    if (key === 'h1')          { chain.setHeading({ level: 1 }).run(); return }
    if (key === 'h2')          { chain.setHeading({ level: 2 }).run(); return }
    if (key === 'h3')          { chain.setHeading({ level: 3 }).run(); return }
    if (key === 'bulletList')  { chain.toggleBulletList().run(); return }
    if (key === 'orderedList') { chain.toggleOrderedList().run(); return }
    if (key === 'taskList')    { chain.toggleTaskList().run(); return }
    if (key === 'callout')     { chain.insertContent({ type: 'callout', content: [{ type: 'paragraph' }] }).run(); return }
    if (key === 'codeBlock')   { chain.setCodeBlock().run(); return }
    if (key === 'blockquote')  { chain.toggleBlockquote().run(); return }
    if (key === 'hr')          { chain.setHorizontalRule().run(); return }
    if (key === 'table')       { chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); return }
    window.requestAnimationFrame(() => dispatchAddElement(key, menu.from))
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

  const textStyleAttrs = editor.schema.marks[TEXT_STYLE_MARK]
    ? editor.getAttributes(TEXT_STYLE_MARK)
    : {}
  const effectiveFontSize = (textStyleAttrs.fontSize as string | null)
    ?? (editor.isActive('heading', { level: 1 }) ? '26px'
      : editor.isActive('heading', { level: 2 }) ? '19px'
        : editor.isActive('heading', { level: 3 }) ? '15px'
          : '14px')
  const effectiveTextColor = (textStyleAttrs.color as string | null) ?? (theme === 'dark' ? '#ececf4' : '#111827')
  const setTextStyle = (attrs: Record<string, string | null>) => {
    if (!editor.schema.marks[TEXT_STYLE_MARK]) return
    editor.chain().focus().setMark(TEXT_STYLE_MARK, attrs).run()
  }
  const closeTextToolbar = () => {
    editor.commands.setTextSelection(editor.state.selection.to)
    editor.commands.blur()
  }
  return (
    <div
      data-article-editor-shell="true"
      data-article-editable={editable ? 'true' : 'false'}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: '14px',
        alignItems: 'start',
        justifyContent: 'start',
        width: '100%',
      }}
    >
      {slashMenu && (
        <div
          ref={slashMenuListRef}
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
            <div key={item.key}>
              {(index === 0 || items[index - 1].group !== item.group) && (
                <div style={{ padding: '7px 9px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0 }}>
                  {item.group}
                </div>
              )}
              <button
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
            </div>
          ))}
        </div>
      )}

      {/* Text format toolbar — appears on selection */}
      {editable && (
        <BubbleMenu
          editor={editor}
          pluginKey="text-format-menu"
          appendTo={() => document.body}
          options={{ strategy: 'fixed', placement: 'top', offset: 10, flip: true, shift: { padding: 8 } }}
          shouldShow={({ editor, from, to }) => editor.isEditable && from !== to && !editor.isActive('image') && !editor.isActive('tableCell') && !editor.isActive('tableHeader')}
          style={{ zIndex: 100000 }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap',
            maxWidth: 'min(720px, calc(100vw - 24px))',
            background: '#1a1a2a', border: '1px solid #2e2e42', borderRadius: '8px',
            padding: '4px 6px', boxShadow: '0 4px 20px rgba(0,0,0,0.35)', zIndex: 100000,
          }}>
            {/* Font family */}
            <select
              title="Schriftfamilie"
              value={(textStyleAttrs.fontFamily as string | null) ?? ''}
              onChange={e => setTextStyle({ fontFamily: e.target.value || null })}
              style={{ ...bBtn(false), padding: '4px 6px', maxWidth: 112, background: '#242438', colorScheme: 'dark' }}
            >
              {FONT_FAMILIES.map(f => (
                <option key={f.label} value={f.value ?? ''} style={{ background: '#242438', color: '#f4f4f8' }}>{f.label}</option>
              ))}
            </select>

            {/* Font size */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'stretch', height: 26, background: '#242438', borderRadius: 5 }}>
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
                  if (!Number.isFinite(size) || size < 6 || size > 200) e.currentTarget.value = String(parseFloat(effectiveFontSize))
                }}
                style={{ width: 34, padding: '4px 2px 4px 7px', border: 0, outline: 'none', background: 'transparent', color: '#e8e8f0', fontFamily: 'inherit', fontSize: 12 }}
              />
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setFontSizeMenuOpen(o => !o)}
                style={{ width: 22, padding: 0, border: 0, borderRadius: '0 5px 5px 0', background: 'transparent', color: '#a9a9b8', cursor: 'pointer', fontSize: 10 }}
              >▼</button>
              {fontSizeMenuOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100001, minWidth: '100%', maxHeight: 190, overflowY: 'auto', padding: 4, background: '#242438', border: '1px solid #3a3a50', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.4)' }}>
                  {FONT_SIZES.map(size => (
                    <button
                      key={size}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setTextStyle({ fontSize: size }); setFontSizeMenuOpen(false) }}
                      style={{ display: 'block', width: '100%', padding: '5px 8px', border: 0, borderRadius: 4, background: size === effectiveFontSize ? 'rgba(255,255,255,0.16)' : 'transparent', color: '#f4f4f8', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 12 }}
                    >{parseFloat(size)}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Text color */}
            <label title="Textfarbe" style={{ ...bBtn(false), padding: '3px 5px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              A
              <input type="color" value={effectiveTextColor} onChange={e => setTextStyle({ color: e.target.value })} style={{ width: 18, height: 18, padding: 0, border: 0, background: 'none', cursor: 'pointer' }} />
            </label>

            {/* Background color */}
            <label title="Hintergrundfarbe" style={{ ...bBtn(false), padding: '3px 5px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 3px', borderRadius: 3, background: (textStyleAttrs.backgroundColor as string | null) ?? 'transparent', color: effectiveTextColor, fontWeight: 700, lineHeight: 1 }}>A</span>
              <span style={{ position: 'relative', width: 18, height: 18, overflow: 'hidden', borderRadius: 3 }}>
                <input type="color" value={(textStyleAttrs.backgroundColor as string | null) ?? '#fff59d'} onChange={e => setTextStyle({ backgroundColor: e.target.value })} style={{ width: 18, height: 18, padding: 0, border: 0, background: 'none', cursor: 'pointer' }} />
                {!textStyleAttrs.backgroundColor && <span style={{ position: 'absolute', left: -4, top: 8, width: 26, height: 2, background: '#ef4444', transform: 'rotate(-45deg)', pointerEvents: 'none' }} />}
              </span>
            </label>
            <button title="Hintergrundfarbe entfernen" style={bBtn(false, { color: '#ef4444', padding: '4px 6px' })} onClick={() => setTextStyle({ backgroundColor: null })}>×</button>

            <span style={{ width: '1px', background: '#2e2e42', margin: '2px 4px', alignSelf: 'stretch' }} />

            {/* Basic formatting */}
            <button style={bBtn(editor.isActive('bold'),      { fontWeight: 800 })}              onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
            <button style={bBtn(editor.isActive('italic'),    { fontStyle: 'italic' })}          onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
            <button style={bBtn(editor.isActive('underline'), { textDecoration: 'underline' })}  onClick={() => editor.chain().focus().toggleUnderline().run()}>U</button>
            <button style={bBtn(editor.isActive('strike'),    { textDecoration: 'line-through' })} onClick={() => editor.chain().focus().toggleStrike().run()}>S</button>
            <button style={bBtn(editor.isActive('code'),      { fontFamily: 'monospace' })}      onClick={() => editor.chain().focus().toggleCode().run()}>`</button>

            <span style={{ width: '1px', background: '#2e2e42', margin: '2px 4px', alignSelf: 'stretch' }} />

            {/* Block type */}
            <button style={bBtn(editor.isActive('heading', { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
            <button style={bBtn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
            <button style={bBtn(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
            <button style={bBtn(editor.isActive('paragraph'))} onClick={() => editor.chain().focus().setParagraph().run()}>Tx</button>

            <button title="Schließen" style={bBtn(false)} onClick={closeTextToolbar}>×</button>
          </div>
        </BubbleMenu>
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
                {tableMenuItem('Zeile davor einfügen', () => editor.chain().focus().addRowBefore().run())}
                {tableMenuItem('Zeile danach einfügen', () => editor.chain().focus().addRowAfter().run())}
                {tableMenuItem('Zeile löschen', () => editor.chain().focus().deleteRow().run(), true)}

                <div style={tableMenuDividerStyle} />

                <div style={tableMenuLabelStyle}>SPALTE</div>
                {tableMenuItem('Spalte davor einfügen', () => editor.chain().focus().addColumnBefore().run())}
                {tableMenuItem('Spalte danach einfügen', () => editor.chain().focus().addColumnAfter().run())}
                {tableMenuItem('Spalte löschen', () => editor.chain().focus().deleteColumn().run(), true)}

                <div style={tableMenuDividerStyle} />

                {tableMenuItem('Tabelle löschen', () => editor.chain().focus().deleteTable().run(), true)}
              </div>
            )}
          </div>
        </BubbleMenu>
      )}

      <div
        data-article-editor="true"
        data-article-editable={editable ? 'true' : 'false'}
        style={editable ? { width: '100%' } : undefined}
      >
        <EditorContent editor={editor} />
      </div>


      <style>{`
        [data-article-editor] .ProseMirror {
          outline: none;
          font-size: 16px;
          line-height: 1.75;
          color: var(--text);
        }
        [data-article-editor] .is-editor-empty:first-child::before,
        [data-article-editor] .is-empty::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--muted);
          opacity: 0.55;
          height: 0;
          pointer-events: none;
        }
        [data-article-editor] .ProseMirror > * + * { margin-top: 2px; }
        [data-article-editor] [data-section-card] {
          border-radius: 0 !important;
          min-height: 0 !important;
          padding: 3px 0 3px 44px !important;
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
          letter-spacing: 0;
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
        [data-article-editor] [data-section-card] ul { list-style-type: disc; }
        [data-article-editor] [data-section-card] ol { list-style-type: decimal; }
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
          letter-spacing: 0;
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
  letterSpacing: 0,
}

const tableMenuDividerStyle = {
  height: '1px',
  background: 'var(--border)',
  margin: '4px 0',
}
