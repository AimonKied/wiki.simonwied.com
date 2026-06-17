'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import type { NodeViewRendererProps } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'

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

  // Enter in the last empty block of a toggle → insert paragraph after the toggle
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
    return ({ node: initialNode, getPos, view }: NodeViewRendererProps) => {
      let currentNode = initialNode as PMNode

      // Outer wrapper
      const dom = document.createElement('div')
      dom.className = 'wiki-toggle'
      dom.setAttribute('data-open', currentNode.attrs.open !== false ? 'true' : 'false')
      dom.style.margin = '2px 0'

      // Flex row: button + content
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:baseline;gap:4px;'

      // Toggle button — native listener, no React events
      const btn = document.createElement('button')
      btn.setAttribute('contenteditable', 'false')
      btn.textContent = '▶'
      btn.style.cssText = [
        'background:none', 'border:none', 'cursor:pointer',
        'padding:0 2px', 'color:var(--muted)', 'line-height:1',
        'font-size:0.65em', 'flex-shrink:0',
        'user-select:none', 'transition:transform 0.15s',
        'transform:' + (currentNode.attrs.open !== false ? 'rotate(90deg)' : 'none'),
      ].join(';')

      btn.addEventListener('mousedown', e => {
        e.preventDefault()
        const isOpen = dom.getAttribute('data-open') !== 'false'
        const newOpen = !isOpen
        dom.setAttribute('data-open', newOpen ? 'true' : 'false')
        btn.style.transform = newOpen ? 'rotate(90deg)' : 'none'
        if (typeof getPos === 'function') {
          const pos = getPos()
          if (pos !== undefined) {
            view.dispatch(view.state.tr.setNodeMarkup(pos, null, {
              ...currentNode.attrs,
              open: newOpen,
            }))
          }
        }
      })

      // ContentDOM — ProseMirror manages the toggle's blocks here
      const content = document.createElement('div')
      content.className = 'wiki-toggle-content'
      content.style.cssText = 'flex:1;min-width:0;'

      row.appendChild(btn)
      row.appendChild(content)
      dom.appendChild(row)

      return {
        dom,
        contentDOM: content,

        update(updatedNode: PMNode) {
          if (updatedNode.type !== currentNode.type) return false
          currentNode = updatedNode
          const open = updatedNode.attrs.open !== false
          dom.setAttribute('data-open', open ? 'true' : 'false')
          btn.style.transform = open ? 'rotate(90deg)' : 'none'
          return true
        },

        // Tell ProseMirror not to handle events on the toggle button
        stopEvent(event: Event) {
          return event.target === btn
        },
      }
    }
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
