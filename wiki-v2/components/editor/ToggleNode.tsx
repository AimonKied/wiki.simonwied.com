'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import React from 'react'

function ToggleView({ node, updateAttributes }: NodeViewProps) {
  const open = node.attrs.open !== false
  return (
    <NodeViewWrapper>
      <div
        className="wiki-toggle"
        data-open={open ? 'true' : 'false'}
        style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', margin: '2px 0' }}
      >
        <button
          contentEditable={false}
          onClick={() => updateAttributes({ open: !open })}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '0 2px', color: 'var(--muted)', lineHeight: 1,
            fontSize: '0.65em', marginTop: '5px',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s',
            flexShrink: 0, userSelect: 'none',
          }}
        >
          ▶
        </button>
        <NodeViewContent className="wiki-toggle-content" style={{ flex: 1, minWidth: 0 }} />
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

// JSON factory for SectionNode.addElement
export function toggleJSON(size: 'default' | 'h1' | 'h2' | 'h3') {
  const firstBlock =
    size === 'h1' ? { type: 'heading', attrs: { level: 1 } } :
    size === 'h2' ? { type: 'heading', attrs: { level: 2 } } :
    size === 'h3' ? { type: 'heading', attrs: { level: 3 } } :
    { type: 'paragraph' }
  return {
    type: 'toggle',
    attrs: { open: true },
    content: [firstBlock],
  }
}
