'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import React, { useState, useEffect } from 'react'
import { TextSelection } from '@tiptap/pm/state'

function ToggleView({ node, updateAttributes }: NodeViewProps) {
  const [open, setOpen] = useState(() => node.attrs.open !== false)

  // Sync with node attrs on undo/redo
  useEffect(() => {
    setOpen(node.attrs.open !== false)
  }, [node.attrs.open])

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    const newOpen = !open
    setOpen(newOpen)
    updateAttributes({ open: newOpen })
  }

  return (
    <NodeViewWrapper>
      <div
        className="wiki-toggle"
        data-open={open ? 'true' : 'false'}
        style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', margin: '2px 0' }}
      >
        <button
          contentEditable={false}
          onMouseDown={handleToggle}
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

  // Enter in the last empty block of a toggle → exit the toggle
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state, view } = this.editor
        const { $from, empty } = state.selection
        if (!empty || $from.parent.textContent !== '') return false
        if ($from.depth < 1 || $from.node($from.depth - 1).type.name !== 'toggle') return false

        const toggleNode = $from.node($from.depth - 1)
        const paraIndex = $from.index($from.depth - 1)
        if (paraIndex !== toggleNode.childCount - 1) return false

        const togglePos = $from.before($from.depth - 1)
        const afterToggle = togglePos + toggleNode.nodeSize
        const tr = state.tr

        if (toggleNode.childCount > 1) {
          const paraStart = $from.before($from.depth)
          const paraEnd = paraStart + $from.parent.nodeSize
          tr.delete(paraStart, paraEnd)
          const newAfter = afterToggle - $from.parent.nodeSize
          tr.insert(newAfter, state.schema.nodes.paragraph.create())
          tr.setSelection(TextSelection.near(tr.doc.resolve(newAfter + 1)))
        } else {
          tr.insert(afterToggle, state.schema.nodes.paragraph.create())
          tr.setSelection(TextSelection.near(tr.doc.resolve(afterToggle + 1)))
        }

        view.dispatch(tr.scrollIntoView())
        return true
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleView)
  },
})

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
