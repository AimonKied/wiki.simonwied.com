'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import React, { useEffect, useRef } from 'react'

type ToggleSize = 'default' | 'h1' | 'h2' | 'h3'

const SIZE_STYLE: Record<ToggleSize, React.CSSProperties> = {
  default: { fontSize: '1em',    fontWeight: 500 },
  h1:      { fontSize: '1.8em',  fontWeight: 700, lineHeight: 1.2 },
  h2:      { fontSize: '1.4em',  fontWeight: 600, lineHeight: 1.3 },
  h3:      { fontSize: '1.15em', fontWeight: 600, lineHeight: 1.4 },
}

function ToggleView({ node, updateAttributes, editor }: NodeViewProps) {
  const open = node.attrs.open !== false
  const size: ToggleSize = node.attrs.size ?? 'default'
  const summaryRef = useRef<HTMLDivElement>(null)

  // Sync attr → DOM without React re-render conflicts
  useEffect(() => {
    const el = summaryRef.current
    if (!el) return
    if (el.textContent !== (node.attrs.summary ?? '')) {
      el.textContent = node.attrs.summary ?? ''
    }
  }, [node.attrs.summary])

  const handleSummaryInput = () => {
    updateAttributes({ summary: summaryRef.current?.textContent ?? '' })
  }

  const handleSummaryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Open toggle and move focus to the body content
      if (!open) updateAttributes({ open: true })
      const editorEl = (editor.view.dom as HTMLElement)
      // Find the NodeViewContent div inside this node view and focus it
      const wrapper = summaryRef.current?.closest('[data-node-view-wrapper]')
      const bodyContent = wrapper?.querySelector('.wiki-toggle-body [contenteditable]') as HTMLElement | null
      bodyContent?.focus()
    }
  }

  const btnFontSize = size === 'h1' ? '0.55em' : size === 'h2' ? '0.6em' : '0.65em'

  return (
    <NodeViewWrapper>
      <div
        className="wiki-toggle"
        data-open={open ? 'true' : 'false'}
        style={{ margin: '2px 0' }}
      >
        {/* Summary row */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', userSelect: 'none' }}>
          <button
            contentEditable={false}
            onClick={() => updateAttributes({ open: !open })}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0 2px', color: 'var(--muted)', lineHeight: 1,
              fontSize: btnFontSize,
              transform: open ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s',
              flexShrink: 0,
            }}
          >
            ▶
          </button>
          <div
            ref={summaryRef}
            contentEditable={editor.isEditable}
            suppressContentEditableWarning
            onInput={handleSummaryInput}
            onKeyDown={handleSummaryKeyDown}
            style={{
              ...SIZE_STYLE[size],
              flex: 1,
              outline: 'none',
              cursor: 'text',
              minWidth: '1px',
            }}
            data-placeholder="Toggle..."
          />
        </div>

        {/* Collapsible body */}
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
      </div>
    </NodeViewWrapper>
  )
}

export const ToggleExtension = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      open:    { default: true,      parseHTML: el => el.getAttribute('data-open') !== 'false', renderHTML: attrs => ({ 'data-open': attrs.open ? 'true' : 'false' }) },
      summary: { default: '',        parseHTML: el => el.querySelector('.wiki-toggle-summary')?.textContent ?? '', renderHTML: () => ({}) },
      size:    { default: 'default', parseHTML: el => el.getAttribute('data-size') ?? 'default', renderHTML: attrs => ({ 'data-size': attrs.size }) },
    }
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'wiki-toggle' }),
      ['div', { class: 'wiki-toggle-summary' }, node.attrs.summary ?? ''],
      ['div', { class: 'wiki-toggle-body' }, 0],
    ]
  },

  parseHTML() {
    return [{ tag: 'div.wiki-toggle' }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleView)
  },
})

// JSON factory for addElement in SectionNode
export function toggleJSON(size: ToggleSize) {
  return {
    type: 'toggle',
    attrs: { open: true, size, summary: '' },
    content: [{ type: 'paragraph' }],
  }
}
