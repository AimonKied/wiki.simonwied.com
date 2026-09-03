'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { Mark, mergeAttributes } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Placeholder from '@tiptap/extension-placeholder'
import { ResizableImage } from './MediaNodes'
import { VideoEmbed } from './VideoNode'
import { BookmarkCard } from './BookmarkNode'
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
import { SectionExtension } from './SectionNode'
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

// Notion nimmt "example.com" genauso an wie eine vollstaendige URL. Relative
// Ziele, Anker und mailto/tel bleiben unangetastet.
function normalizeHref(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(value)) return value
  return `https://${value}`
}

interface PageTarget {
  id: string
  title: string
  emoji: string | null
  slug: string
  isPublic: boolean
}

interface PageMenuState {
  from: number
  to: number
  query: string
  left: number
  top: number
  selected: number
}

function filterPages(pages: PageTarget[], query: string): PageTarget[] {
  const q = query.trim().toLowerCase()
  const matches = q ? pages.filter(page => page.title.toLowerCase().includes(q)) : pages
  return matches.slice(0, 8)
}

function insertPageLink(ed: TiptapEditor, target: PageTarget, menu: PageMenuState) {
  ed
    .chain()
    .focus()
    .deleteRange({ from: menu.from, to: menu.to })
    .insertContent([
      {
        type: 'text',
        text: target.emoji ? `${target.emoji} ${target.title}` : target.title,
        marks: [{ type: 'link', attrs: { href: `/notes/${target.slug}` } }],
      },
      // Ohne den angehaengten Leerraum liefe die Link-Markierung beim
      // Weitertippen einfach mit.
      { type: 'text', text: ' ' },
    ])
    .run()
}

const lowlight = createLowlight()
lowlight.register({ javascript, typescript, python, bash, css, xml, json, sql, markdown })
const slashItems = filterPalette

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

// Bilder aus Zwischenablage und Dateisystem. Die genaue Typpruefung macht
// uploadMedia (samt Groessenlimit und WebP-Kompression) -- hier reicht die
// grobe Frage, ob ueberhaupt ein Bild dabei ist, um das Event zu uebernehmen.
function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return []
  return Array.from(data.files).filter(file => file.type.startsWith('image/'))
}

async function uploadImagesInto(
  editor: TiptapEditor,
  files: File[],
  at: number,
  onBusy: (delta: number) => void,
  onError: (message: string | null) => void,
) {
  const { uploadMedia } = await import('@/lib/supabase/storage')
  let pos = at
  for (const file of files) {
    onBusy(1)
    try {
      const url = await uploadMedia(file)
      // insertContentAt statt tr.insert: es teilt einen Absatz auf, wenn die
      // Position mitten im Text liegt -- ein Bildknoten passt dort sonst nicht
      // ins Schema.
      editor.chain().focus().insertContentAt(pos, { type: 'image', attrs: { src: url, align: 'center' } }).run()
      onError(null)
      // Weitere Bilder landen hinter dem gerade eingefuegten.
      pos = editor.state.selection.to
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
    } finally {
      onBusy(-1)
    }
  }
}

export default function ArticleEditor({ content, onChange, editable = true }: ArticleEditorProps) {
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const [tableMenuOpen, setTableMenuOpen] = useState(false)
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const slashMenuRef = useRef<SlashMenuState | null>(null)
  const slashMenuListRef = useRef<HTMLDivElement>(null)
  // null = geschlossen; ein String ist der Entwurf im Eingabefeld
  const [linkDraft, setLinkDraft] = useState<string | null>(null)
  const [pageMenu, setPageMenu] = useState<PageMenuState | null>(null)
  const pageMenuRef = useRef<PageMenuState | null>(null)
  const [pages, setPages] = useState<PageTarget[] | null>(null)
  const pagesRef = useRef<PageTarget[] | null>(null)
  const [mediaBusy, setMediaBusy] = useState(0)
  const [mediaError, setMediaError] = useState<string | null>(null)
  // Die Handler unten entstehen in der useEditor-Konfiguration, koennen die
  // Editor-Instanz also noch nicht kennen -- der Ref schliesst die Luecke.
  const editorRef = useRef<TiptapEditor | null>(null)
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
      VideoEmbed,
      BookmarkCard,
      SectionExtension,
      ToggleExtension,
      CalloutExtension,
    ],
    content: normalizeArticleContent(content),
    editable,
    immediatelyRender: true,
    editorProps: {
      handleKeyDown(_view, event) {
        if (!editable) return false
        if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return false
        // Immer abfangen, sonst kapert der Browser die Tastenkombination.
        event.preventDefault()
        const ed = editorRef.current
        if (!ed) return true
        // Ohne Auswahl und ausserhalb eines Links gibt es nichts zu verlinken.
        if (ed.state.selection.empty && !ed.isActive('link')) return true
        // Steht der Cursor nur irgendwo im Link, erst dessen Text markieren:
        // das BubbleMenu (und damit das Eingabefeld) erscheint ausschliesslich
        // bei nicht-leerer Auswahl -- und man sieht, was man gerade bearbeitet.
        if (ed.state.selection.empty) ed.chain().extendMarkRange('link').run()
        setLinkDraft((ed.getAttributes('link').href as string | undefined) ?? '')
        return true
      },
      handlePaste(_view, event) {
        if (!editable) return false
        const files = imageFilesFrom(event.clipboardData)
        if (!files.length) return false
        const ed = editorRef.current
        if (!ed) return false
        event.preventDefault()
        void uploadImagesInto(ed, files, ed.state.selection.from, d => setMediaBusy(n => n + d), setMediaError)
        return true
      },
      handleDrop(view, event, _slice, moved) {
        // moved = ein Knoten aus dem Dokument wird verschoben; Dateien von
        // ausserhalb sind das nie. Element-Drags (x-wiki-element) und
        // Text-Drags tragen ebenfalls keine files und fallen durch.
        if (!editable || moved) return false
        const files = imageFilesFrom(event.dataTransfer)
        if (!files.length) return false
        const ed = editorRef.current
        if (!ed) return false
        event.preventDefault()
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
          ?? ed.state.selection.from
        void uploadImagesInto(ed, files, at, d => setMediaBusy(n => n + d), setMediaError)
        return true
      },
    },
    onUpdate({ editor }) {
      onChange?.(withArticleMode(editor.getJSON()))
      syncSlashMenu(editor)
      syncPageMenu(editor)
    },
    onSelectionUpdate({ editor }) {
      syncSlashMenu(editor)
      syncPageMenu(editor)
    },
    onBlur() {
      window.setTimeout(() => { setSlashMenu(null); setPageMenu(null) }, 120)
    },
  }, [editable])

  useEffect(() => {
    slashMenuRef.current = slashMenu
  }, [slashMenu])

  useEffect(() => {
    pageMenuRef.current = pageMenu
  }, [pageMenu])

  useEffect(() => {
    pagesRef.current = pages
  }, [pages])

  // Erst laden, wenn jemand tatsaechlich "[[" tippt -- die Liste interessiert
  // beim blossen Oeffnen eines Artikels niemanden.
  useEffect(() => {
    if (!pageMenu || pages !== null) return
    let cancelled = false
    void (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        // Nur Notizen mit Slug: die oeffentliche Route loest ausschliesslich
        // ueber den Slug auf, ohne ihn gibt es kein verlinkbares Ziel.
        const { data } = await createClient()
          .from('notes')
          .select('id, title, emoji, slug, visibility, is_public')
          .not('slug', 'is', null)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
        if (cancelled) return
        setPages((data ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          title: (row.title as string) || 'Ohne Titel',
          emoji: (row.emoji as string | null) ?? null,
          slug: row.slug as string,
          isPublic: ((row.visibility as string | null) ?? (row.is_public ? 'public' : 'private')) === 'public',
        })))
      } catch {
        if (!cancelled) setPages([])
      }
    })()
    return () => { cancelled = true }
  }, [pageMenu, pages])

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    if (!mediaError) return
    const id = window.setTimeout(() => setMediaError(null), 6000)
    return () => window.clearTimeout(id)
  }, [mediaError])

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

  const selectedSlashIndex = slashMenu?.selected
  useEffect(() => {
    if (!slashMenuListRef.current || selectedSlashIndex === undefined) return
    const el = slashMenuListRef.current.children[selectedSlashIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedSlashIndex])

  useEffect(() => {
    if (!editor || !editable) return
    function onKeyDown(e: KeyboardEvent) {
      const page = pageMenuRef.current
      if (page) {
        const pageItems = filterPages(pagesRef.current ?? [], page.query)
        if (e.key === 'Escape') { e.preventDefault(); setPageMenu(null); return }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          setPageMenu(current => current
            ? { ...current, selected: (current.selected + (e.key === 'ArrowDown' ? 1 : -1) + pageItems.length) % Math.max(1, pageItems.length) }
            : current)
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          if (!pageItems.length) return
          e.preventDefault()
          insertPageLink(editor, pageItems[page.selected] ?? pageItems[0], page)
          setPageMenu(null)
        }
        return
      }
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
    const id = window.setTimeout(() => document.addEventListener('click', close), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('click', close)
    }
  }, [tableMenuOpen])

  if (!editor) return null

  // Erkennt "[[stichwort" an beliebiger Stelle der Zeile -- anders als das
  // Slash-Menue, das nur am Zeilenanfang greift: ein Seitenverweis steht
  // typischerweise mitten im Satz.
  function syncPageMenu(ed: TiptapEditor) {
    const { selection } = ed.state
    if (!selection.empty || !ed.isEditable || !selection.$from.parent.isTextblock) {
      setPageMenu(null)
      return
    }
    const { $from } = selection
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, node => node.type.name === 'hardBreak' ? '\n' : '\ufffc')
    const currentLine = textBefore.slice(textBefore.lastIndexOf('\n') + 1)
    const match = currentLine.match(/\[\[([^\]\n]*)$/)
    if (!match) {
      setPageMenu(null)
      return
    }
    try {
      const coords = ed.view.coordsAtPos(selection.from)
      const query = match[1]
      setPageMenu(previous => ({
        from: selection.from - query.length - 2,
        to: selection.from,
        query,
        left: coords.left,
        top: coords.bottom + 8,
        selected: previous?.query === query ? previous.selected : 0,
      }))
    } catch {
      setPageMenu(null)
    }
  }

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
  // Leere Eingabe entfernt den Link -- so muss man nicht den Entfernen-Knopf
  // suchen, wenn man das Feld ohnehin schon geleert hat.
  const applyLink = () => {
    const href = normalizeHref(linkDraft ?? '')
    const chain = editor.chain().focus().extendMarkRange('link')
    if (href) chain.setLink({ href }).run()
    else chain.unsetLink().run()
    setLinkDraft(null)
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
      {/* Ein Upload dauert spuerbar (Kompression + Netz). Ohne Hinweis sieht
          es nach einem verschluckten Einfuegen aus. */}
      {(mediaBusy > 0 || mediaError) && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '24px',
            transform: 'translateX(-50%)',
            zIndex: 400,
            padding: '9px 16px',
            borderRadius: '999px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: mediaError ? 'var(--accent2)' : 'var(--muted)',
            fontSize: '12px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
          }}
          onClick={() => setMediaError(null)}
        >
          {mediaError ?? (mediaBusy === 1 ? 'Bild wird hochgeladen…' : `${mediaBusy} Bilder werden hochgeladen…`)}
        </div>
      )}
      {pageMenu && (
        <div
          style={{
            position: 'fixed',
            left: pageMenu.left,
            top: pageMenu.top,
            zIndex: 100000,
            width: 300,
            maxHeight: 320,
            overflowY: 'auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '6px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.16)',
          }}
        >
          <div style={{ padding: '7px 9px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>
            SEITE VERLINKEN
          </div>
          {pages === null && (
            <div style={{ padding: '8px 9px', fontSize: 12, color: 'var(--muted)' }}>Wird geladen…</div>
          )}
          {pages !== null && filterPages(pages, pageMenu.query).length === 0 && (
            <div style={{ padding: '8px 9px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              {pages.length === 0
                ? 'Keine Seite mit Slug vorhanden. Ein Ziel braucht einen Slug, sonst ist es nicht erreichbar.'
                : 'Nichts gefunden.'}
            </div>
          )}
          {pages !== null && filterPages(pages, pageMenu.query).map((target, index) => (
            <button
              key={target.id}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { insertPageLink(editor, target, pageMenu); setPageMenu(null) }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                textAlign: 'left',
                padding: '7px 9px',
                border: 0,
                borderRadius: 6,
                background: index === pageMenu.selected ? 'var(--surface2)' : 'transparent',
                color: 'var(--text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
              }}
            >
              <span style={{ width: 18, flexShrink: 0, textAlign: 'center' }}>{target.emoji ?? '📄'}</span>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {target.title}
              </span>
              {!target.isPublic && (
                <span
                  title="Noch nicht veröffentlicht — der Link greift erst danach"
                  style={{
                    marginLeft: 'auto', flexShrink: 0,
                    padding: '2px 6px', borderRadius: 999,
                    background: '#d9770622', color: '#d97706',
                    fontSize: 9, fontWeight: 800,
                  }}
                >
                  ENTWURF
                </span>
              )}
            </button>
          ))}
        </div>
      )}

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
            <button
              title="Link setzen (Strg/Cmd+K)"
              style={bBtn(editor.isActive('link'))}
              onClick={() => setLinkDraft((editor.getAttributes('link').href as string | undefined) ?? '')}
            >
              ⛓
            </button>

            <span style={{ width: '1px', background: '#2e2e42', margin: '2px 4px', alignSelf: 'stretch' }} />

            {/* Block type */}
            <button style={bBtn(editor.isActive('heading', { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
            <button style={bBtn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
            <button style={bBtn(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
            <button style={bBtn(editor.isActive('paragraph'))} onClick={() => editor.chain().focus().setParagraph().run()}>Tx</button>

            <button title="Schließen" style={bBtn(false)} onClick={closeTextToolbar}>×</button>

            {linkDraft !== null && (
              <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 4, paddingTop: 4 }}>
                <input
                  autoFocus
                  value={linkDraft}
                  onChange={e => setLinkDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); applyLink() }
                    if (e.key === 'Escape') { e.preventDefault(); setLinkDraft(null); editor.chain().focus().run() }
                  }}
                  placeholder="Adresse oder example.com"
                  style={{
                    flex: 1, minWidth: 0, height: 26, padding: '0 8px',
                    border: '1px solid #2e2e42', borderRadius: 5,
                    background: '#242438', color: '#e8e8f0',
                    fontFamily: 'inherit', fontSize: 12, outline: 'none',
                  }}
                />
                <button title="Übernehmen" style={bBtn(false, { fontWeight: 700 })} onClick={applyLink}>OK</button>
                {editor.isActive('link') && (
                  <button
                    title="Link entfernen"
                    style={bBtn(false, { color: '#ef4444' })}
                    onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkDraft(null) }}
                  >
                    ⛓✕
                  </button>
                )}
                <button title="Abbrechen" style={bBtn(false)} onClick={() => { setLinkDraft(null); editor.chain().focus().run() }}>×</button>
              </div>
            )}
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
        style={editable ? { width: '100%', minHeight: '60vh', cursor: 'text' } : undefined}
        onClick={editable ? e => {
          // Clicking dead space below/around the (possibly near-empty) content
          // should still land the cursor on the nearest line, Notion-style —
          // only when the click hits this wrapper itself, not actual content.
          if (e.target !== e.currentTarget) return
          const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
          editor.chain().focus().setTextSelection(pos ? pos.pos : editor.state.doc.content.size).run()
        } : undefined}
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
        /* Waehrend einer Blockauswahl uebernimmt die Blockflaeche die
           Hervorhebung; die Textmarkierung wuerde sonst doppelt liegen. */
        body[data-block-selection] [data-article-editor] .ProseMirror ::selection {
          background: transparent;
        }
        body[data-block-selection] [data-article-editor] .ProseMirror::selection {
          background: transparent;
        }
        [data-article-editor] [data-section-card] {
          border-radius: 0 !important;
          min-height: 0 !important;
          padding: 3px 0 3px 44px !important;
          box-shadow: none !important;
        }
        /* The 44px left gutter reserves room for the ⠿/+ hover controls, which
           only matter with a mouse. On touch screens that space just reads as
           a lopsided left margin, so drop it and match the (0) right side. */
        @media (max-width: 640px) {
          [data-article-editor] [data-section-card] {
            padding-left: 0 !important;
          }
        }
        /* Auswahl-Flaeche eines Blocks. Die Maße stehen bewusst hier neben dem
           Karten-Padding: sie leiten sich davon ab und muessen mitwandern.
           Ziel ist ein gleicher Abstand von 3px auf allen vier Seiten zum
           Inhalt -- oben/unten liefert ihn das 3px-Padding der Karte, links
           der Versatz gegen die 44px-Rinne, rechts der Ueberstand (die Karte
           hat dort kein Padding, der Text endet also an ihrer Kante). */
        [data-article-editor] .wiki-block-highlight {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 41px;
          right: -3px;
          border-radius: 6px;
          background: color-mix(in srgb, var(--accent) 16%, transparent);
          pointer-events: none;
          z-index: 5;
        }
        @media (max-width: 640px) {
          [data-article-editor] .wiki-block-highlight {
            left: -3px;
          }
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
