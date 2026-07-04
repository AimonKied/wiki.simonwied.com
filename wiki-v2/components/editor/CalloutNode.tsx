'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import type { NodeViewRendererProps } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'

export const CALLOUT_COLORS = ['gray', 'yellow', 'orange', 'red', 'green', 'blue'] as const
export type CalloutColor = typeof CALLOUT_COLORS[number]

const CALLOUT_EMOJIS = ['💡', '⚠️', 'ℹ️', '✅', '❗', '🔥', '📌', '❓', '🚀', '📝']

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: '💡',
        parseHTML: el => el.getAttribute('data-emoji') || '💡',
        renderHTML: attrs => ({ 'data-emoji': attrs.emoji }),
      },
      color: {
        default: 'yellow',
        parseHTML: el => el.getAttribute('data-color') || 'yellow',
        renderHTML: attrs => ({ 'data-color': attrs.color }),
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'wiki-callout' }), 0]
  },

  parseHTML() {
    return [{ tag: 'div.wiki-callout' }]
  },

  // Enter in the last empty block of a callout → insert paragraph after the callout
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state, view } = this.editor
        const { $from, empty } = state.selection
        if (!empty || $from.parent.textContent !== '') return false
        if ($from.depth < 1 || $from.node($from.depth - 1).type.name !== 'callout') return false

        const calloutNode = $from.node($from.depth - 1)
        const paraIndex = $from.index($from.depth - 1)
        if (paraIndex !== calloutNode.childCount - 1) return false

        const calloutPos = $from.before($from.depth - 1)
        const afterCallout = calloutPos + calloutNode.nodeSize
        const tr = state.tr

        if (calloutNode.childCount > 1) {
          const paraStart = $from.before($from.depth)
          const paraEnd = paraStart + $from.parent.nodeSize
          tr.delete(paraStart, paraEnd)
          const newAfter = afterCallout - $from.parent.nodeSize
          tr.insert(newAfter, state.schema.nodes.paragraph.create())
          tr.setSelection(TextSelection.near(tr.doc.resolve(newAfter + 1)))
        } else {
          tr.insert(afterCallout, state.schema.nodes.paragraph.create())
          tr.setSelection(TextSelection.near(tr.doc.resolve(afterCallout + 1)))
        }

        view.dispatch(tr.scrollIntoView())
        return true
      },
    }
  },

  addNodeView() {
    return ({ node: initialNode, getPos, view, editor }: NodeViewRendererProps) => {
      let currentNode = initialNode as PMNode

      const dom = document.createElement('div')
      dom.className = 'wiki-callout'
      dom.setAttribute('data-emoji', String(currentNode.attrs.emoji))
      dom.setAttribute('data-color', String(currentNode.attrs.color))

      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:flex-start;gap:10px;'

      // Emoji button — opens a small picker popover (edit mode only)
      const btn = document.createElement('button')
      btn.setAttribute('contenteditable', 'false')
      btn.type = 'button'
      btn.title = editor.isEditable ? 'Emoji und Farbe ändern' : ''
      btn.style.cssText = [
        'background:none', 'border:none', 'padding:0', 'margin:0',
        'cursor:' + (editor.isEditable ? 'pointer' : 'default'),
        'flex-shrink:0', 'user-select:none',
        'display:inline-flex', 'align-items:center', 'justify-content:center',
        'width:24px', 'height:1lh', 'align-self:flex-start', 'font-size:17px',
      ].join(';')
      btn.textContent = String(currentNode.attrs.emoji)

      let popover: HTMLDivElement | null = null

      function closePopover() {
        popover?.remove()
        popover = null
        document.removeEventListener('mousedown', onOutside)
      }

      function onOutside(e: MouseEvent) {
        if (popover && !popover.contains(e.target as globalThis.Node)) closePopover()
      }

      function setAttrsOnNode(attrs: Record<string, unknown>) {
        if (typeof getPos !== 'function') return
        const pos = getPos()
        if (pos === undefined) return
        view.dispatch(view.state.tr.setNodeMarkup(pos, null, { ...currentNode.attrs, ...attrs }))
      }

      function openPopover() {
        if (popover) { closePopover(); return }
        popover = document.createElement('div')
        popover.setAttribute('contenteditable', 'false')
        popover.style.cssText = [
          'position:absolute', 'z-index:1000', 'top:calc(100% + 4px)', 'left:0',
          'background:var(--surface)', 'border:1px solid var(--border)',
          'border-radius:8px', 'padding:8px', 'box-shadow:0 8px 24px rgba(0,0,0,0.16)',
          'display:flex', 'flex-direction:column', 'gap:8px', 'width:max-content',
        ].join(';')

        const emojiRow = document.createElement('div')
        emojiRow.style.cssText = 'display:grid;grid-template-columns:repeat(5,28px);gap:2px;'
        for (const em of CALLOUT_EMOJIS) {
          const b = document.createElement('button')
          b.type = 'button'
          b.textContent = em
          b.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;padding:3px;border-radius:5px;'
          b.addEventListener('mouseenter', () => { b.style.background = 'var(--surface2, rgba(128,128,128,0.15))' })
          b.addEventListener('mouseleave', () => { b.style.background = 'none' })
          b.addEventListener('mousedown', e => {
            e.preventDefault()
            setAttrsOnNode({ emoji: em })
            closePopover()
          })
          emojiRow.appendChild(b)
        }

        const colorRow = document.createElement('div')
        colorRow.style.cssText = 'display:flex;gap:5px;'
        for (const color of CALLOUT_COLORS) {
          const b = document.createElement('button')
          b.type = 'button'
          b.title = color
          b.className = `wiki-callout-swatch wiki-callout-swatch-${color}`
          b.style.cssText = 'width:20px;height:20px;border-radius:5px;border:1px solid var(--border);cursor:pointer;'
          b.addEventListener('mousedown', e => {
            e.preventDefault()
            setAttrsOnNode({ color })
            closePopover()
          })
          colorRow.appendChild(b)
        }

        popover.appendChild(emojiRow)
        popover.appendChild(colorRow)
        btnWrap.appendChild(popover)
        document.addEventListener('mousedown', onOutside)
      }

      btn.addEventListener('mousedown', e => {
        e.preventDefault()
        if (editor.isEditable) openPopover()
      })

      // Relative wrapper so the popover anchors to the emoji
      const btnWrap = document.createElement('div')
      btnWrap.setAttribute('contenteditable', 'false')
      btnWrap.style.cssText = 'position:relative;flex-shrink:0;'
      btnWrap.appendChild(btn)

      const content = document.createElement('div')
      content.className = 'wiki-callout-content'
      content.style.cssText = 'flex:1;min-width:0;'

      row.appendChild(btnWrap)
      row.appendChild(content)
      dom.appendChild(row)

      return {
        dom,
        contentDOM: content,

        update(updatedNode: PMNode) {
          if (updatedNode.type !== currentNode.type) return false
          currentNode = updatedNode
          dom.setAttribute('data-emoji', String(updatedNode.attrs.emoji))
          dom.setAttribute('data-color', String(updatedNode.attrs.color))
          btn.textContent = String(updatedNode.attrs.emoji)
          return true
        },

        stopEvent(event: Event) {
          const target = event.target as globalThis.Node
          return btnWrap.contains(target)
        },

        destroy() {
          closePopover()
        },
      }
    }
  },
})
