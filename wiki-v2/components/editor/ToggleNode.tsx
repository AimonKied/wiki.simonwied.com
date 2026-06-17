'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import React, { useCallback, useEffect, useState } from 'react'

// ── ToggleSummary ─────────────────────────────────────────────────────────────

function ToggleSummaryView({ node, getPos, editor }: NodeViewProps) {
  const [isOpen, setIsOpen] = useState(true)

  useEffect(() => {
    const sync = () => {
      if (typeof getPos !== 'function') return
      const pos = getPos()
      if (typeof pos !== 'number') return
      try {
        const $pos = editor.state.doc.resolve(pos)
        if ($pos.depth < 1) return
        const parent = editor.state.doc.nodeAt($pos.before($pos.depth))
        setIsOpen(parent?.attrs?.open !== false)
      } catch { /* node may have been removed */ }
    }
    sync()
    editor.on('update', sync)
    return () => { editor.off('update', sync) }
  }, [editor, getPos])

  const handleToggle = useCallback(() => {
    if (typeof getPos !== 'function') return
    const pos = getPos()
    if (typeof pos !== 'number') return
    try {
      const $pos = editor.state.doc.resolve(pos)
      if ($pos.depth < 1) return
      const parentPos = $pos.before($pos.depth)
      const parent = editor.state.doc.nodeAt(parentPos)
      if (!parent || parent.type.name !== 'toggle') return
      editor.chain().command(({ tr }) => {
        tr.setNodeMarkup(parentPos, undefined, { ...parent.attrs, open: !parent.attrs.open })
        return true
      }).run()
    } catch { /* ignore */ }
  }, [editor, getPos])

  const size = node.attrs.size as string
  const textStyle: React.CSSProperties =
    size === 'h1' ? { fontSize: '1.8em', fontWeight: 700, lineHeight: 1.2 } :
    size === 'h2' ? { fontSize: '1.4em', fontWeight: 600, lineHeight: 1.3 } :
    size === 'h3' ? { fontSize: '1.15em', fontWeight: 600, lineHeight: 1.4 } :
    { fontSize: '1em', fontWeight: 500 }

  return (
    <NodeViewWrapper>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
        <button
          contentEditable={false}
          onClick={handleToggle}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '0 2px', color: 'var(--muted)', lineHeight: 1,
            fontSize: size === 'h1' ? '0.6em' : size === 'h2' ? '0.65em' : '0.7em',
            transform: isOpen ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          ▶
        </button>
        <NodeViewContent style={{ ...textStyle, flex: 1, outline: 'none', display: 'inline' }} />
      </div>
    </NodeViewWrapper>
  )
}

export const ToggleSummaryExtension = Node.create({
  name: 'toggleSummary',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return {
      size: {
        default: 'default',
        parseHTML: el => el.getAttribute('data-size') ?? 'default',
        renderHTML: attrs => ({ 'data-size': attrs.size }),
      },
    }
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'wiki-toggle-row' }), 0]
  },
  parseHTML() {
    return [{ tag: 'div.wiki-toggle-row' }]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ToggleSummaryView)
  },
})

// ── ToggleContent ─────────────────────────────────────────────────────────────

function ToggleContentView() {
  return (
    <NodeViewWrapper>
      <div
        className="wiki-toggle-body"
        style={{
          paddingLeft: '18px',
          borderLeft: '2px solid var(--border)',
          marginLeft: '9px',
          marginTop: '2px',
          paddingTop: '2px',
        }}
      >
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  )
}

export const ToggleContentExtension = Node.create({
  name: 'toggleContent',
  content: 'block+',
  defining: true,
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'wiki-toggle-body' }), 0]
  },
  parseHTML() {
    return [{ tag: 'div.wiki-toggle-body' }]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ToggleContentView)
  },
})

// ── Toggle (container) ────────────────────────────────────────────────────────

function ToggleView({ node }: NodeViewProps) {
  const open = node.attrs.open !== false
  return (
    <NodeViewWrapper
      className="wiki-toggle"
      {...{ 'data-open': open ? 'true' : 'false' } as React.HTMLAttributes<HTMLDivElement>}
      style={{ margin: '2px 0' }}
    >
      <NodeViewContent />
    </NodeViewWrapper>
  )
}

export const ToggleExtension = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'toggleSummary toggleContent',
  defining: true,
  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: el => el.getAttribute('data-open') !== 'false',
        renderHTML: attrs => ({ 'data-open': attrs.open ? 'true' : 'false' }),
      },
    }
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'wiki-toggle' }), 0]
  },
  parseHTML() {
    return [{ tag: 'div.wiki-toggle' }]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ToggleView)
  },
})

// Convenience JSON factory used by SectionNode.addElement and editorTransforms
export function toggleJSON(size: 'default' | 'h1' | 'h2' | 'h3') {
  return {
    type: 'toggle',
    attrs: { open: true },
    content: [
      { type: 'toggleSummary', attrs: { size }, content: [] },
      { type: 'toggleContent', content: [{ type: 'paragraph' }] },
    ],
  }
}
