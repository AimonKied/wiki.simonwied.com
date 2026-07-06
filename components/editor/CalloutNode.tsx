'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import type { NodeViewRendererProps } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { TextSelection } from '@tiptap/pm/state'

export const CALLOUT_COLORS = ['gray', 'yellow', 'orange', 'red', 'green', 'blue'] as const
export type CalloutColor = typeof CALLOUT_COLORS[number]

const CALLOUT_EMOJIS = ['💡', '⚠️', 'ℹ️', '✅', '❗', '🔥', '📌', '❓', '🚀', '📝']

// The section wrapper re-mounts its child node views on almost every interaction,
// so the picker cannot live inside the node view DOM — it would be destroyed the
// moment it opens. Instead it is a single document-level overlay (Notion does the
// same): anchored to the emoji's screen position, updating the node via its
// document position, which stays valid across node-view re-mounts.
let activePopover: { el: HTMLDivElement; close: () => void } | null = null

function closeCalloutPopover() {
  activePopover?.close()
}

function openCalloutPopover(btn: HTMLButtonElement, view: EditorView, pos: number) {
  if (activePopover) { closeCalloutPopover(); return }

  const el = document.createElement('div')
  const rect = btn.getBoundingClientRect()
  el.style.cssText = [
    'position:fixed', `left:${rect.left}px`, `top:${rect.bottom + 4}px`, 'z-index:100000',
    'background:var(--surface)', 'border:1px solid var(--border)',
    'border-radius:8px', 'padding:8px', 'box-shadow:0 8px 24px rgba(0,0,0,0.16)',
    'display:flex', 'flex-direction:column', 'gap:8px', 'width:max-content',
  ].join(';')

  function setAttrs(attrs: Record<string, unknown>) {
    const node = view.state.doc.nodeAt(pos)
    if (!node || node.type.name !== 'callout') return
    view.dispatch(view.state.tr.setNodeMarkup(pos, null, { ...node.attrs, ...attrs }))
  }

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
      setAttrs({ emoji: em })
      closeCalloutPopover()
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
      setAttrs({ color })
      closeCalloutPopover()
    })
    colorRow.appendChild(b)
  }

  el.appendChild(emojiRow)
  el.appendChild(colorRow)
  document.body.appendChild(el)

  function onOutside(e: MouseEvent) {
    if (!el.contains(e.target as globalThis.Node)) closeCalloutPopover()
  }
  function onScroll() { closeCalloutPopover() }

  function close() {
    el.remove()
    document.removeEventListener('mousedown', onOutside)
    window.removeEventListener('scroll', onScroll, true)
    activePopover = null
  }

  // Defer: the mousedown that opened the popover is still propagating and would
  // hit the outside-click listener immediately, closing it again.
  window.setTimeout(() => {
    document.addEventListener('mousedown', onOutside)
    window.addEventListener('scroll', onScroll, true)
  }, 0)

  activePopover = { el, close }
}

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

      // Emoji button — opens the document-level picker (edit mode only)
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

      btn.addEventListener('mousedown', e => {
        e.preventDefault()
        if (!editor.isEditable) return
        if (typeof getPos !== 'function') return
        const pos = getPos()
        if (pos === undefined) return
        openCalloutPopover(btn, view, pos)
      })

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
          return btnWrap.contains(event.target as globalThis.Node)
        },

        // No cleanup of the popover here: the section wrapper re-mounts this node
        // view constantly, and the overlay must survive those re-mounts.
      }
    }
  },
})
