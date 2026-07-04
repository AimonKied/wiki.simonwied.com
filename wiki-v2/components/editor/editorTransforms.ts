import type { Editor as TiptapEditor } from '@tiptap/react'
import { Fragment } from '@tiptap/pm/model'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'

export function createLineElement(editor: TiptapEditor, key: string, content: Fragment): PMNode | null {
  const { schema } = editor.state
  if (key === 'paragraph') return schema.nodes.paragraph.create(null, content)
  if (key === 'h1') return schema.nodes.heading.create({ level: 1 }, content)
  if (key === 'h2') return schema.nodes.heading.create({ level: 2 }, content)
  if (key === 'h3') return schema.nodes.heading.create({ level: 3 }, content)
  if (key === 'codeBlock') return schema.nodes.codeBlock.create({ language: null }, content)
  if (key === 'blockquote') return schema.nodes.blockquote.create(null, schema.nodes.paragraph.create(null, content))
  if (key === 'bulletList' || key === 'orderedList') {
    const paragraph = schema.nodes.paragraph.create(null, content)
    const item = schema.nodes.listItem.create(null, paragraph)
    return schema.nodes[key].create(null, item)
  }
  if (key === 'taskList') {
    if (!schema.nodes.taskList) return null
    const paragraph = schema.nodes.paragraph.create(null, content)
    const item = schema.nodes.taskItem.create({ checked: false }, paragraph)
    return schema.nodes.taskList.create(null, item)
  }
  if (key === 'hr') return schema.nodes.horizontalRule.create()
  if (key === 'table') {
    const cell = () => schema.nodes.tableCell.create(null, schema.nodes.paragraph.create())
    const row = () => schema.nodes.tableRow.create(null, [cell(), cell(), cell()])
    return schema.nodes.table.create(null, [row(), row(), row()])
  }
  if (key === 'toggle' || key === 'toggleH1' || key === 'toggleH2' || key === 'toggleH3') {
    if (!schema.nodes.toggle) return null
    const titleBlock =
      key === 'toggleH1' ? schema.nodes.heading.create({ level: 1 }, content) :
      key === 'toggleH2' ? schema.nodes.heading.create({ level: 2 }, content) :
      key === 'toggleH3' ? schema.nodes.heading.create({ level: 3 }, content) :
      schema.nodes.paragraph.create(null, content)
    return schema.nodes.toggle.create({ open: true }, [titleBlock])
  }
  return null
}

// Transforms the visual line at the cursor position (bounded by hardBreaks) into
// the element type identified by `key`. Used by both the canvas and article editors
// because sections use hardBreaks as line separators inside a single textblock.
export function transformVisualLine(
  editor: TiptapEditor,
  key: string,
  deleteRange?: { from: number; to: number },
): boolean {
  const position = deleteRange?.from ?? editor.state.selection.from
  const $pos = editor.state.doc.resolve(position)
  const parentDepth = $pos.depth
  if (!$pos.parent.isTextblock || parentDepth < 1 || $pos.node(parentDepth - 1).type.name !== 'section') return false

  const parent = $pos.parent
  const parentPos = $pos.before(parentDepth)
  const parentStart = $pos.start(parentDepth)
  const relativePos = position - parentStart
  let previousBreak = -1
  let nextBreak = parent.content.size
  let nextBreakSize = 0

  parent.forEach((child, offset) => {
    if (child.type.name !== 'hardBreak') return
    if (offset < relativePos) previousBreak = offset
    else if (nextBreak === parent.content.size) {
      nextBreak = offset
      nextBreakSize = child.nodeSize
    }
  })

  const lineStart = previousBreak < 0 ? 0 : previousBreak + 1
  const lineEnd = nextBreak
  let lineContent = parent.content.cut(lineStart, lineEnd)
  if (deleteRange) {
    const deleteFrom = Math.max(lineStart, deleteRange.from - parentStart)
    const deleteTo = Math.min(lineEnd, deleteRange.to - parentStart)
    lineContent = parent.content.cut(lineStart, deleteFrom).append(parent.content.cut(deleteTo, lineEnd))
  }

  const target = createLineElement(editor, key, lineContent)
  if (!target) return false

  const replacement: PMNode[] = []
  const beforeContent = parent.content.cut(0, previousBreak < 0 ? 0 : previousBreak)
  if (beforeContent.size) replacement.push(parent.copy(beforeContent))
  const targetIndex = replacement.length
  replacement.push(target)
  const afterStart = nextBreak < parent.content.size ? nextBreak + nextBreakSize : parent.content.size
  const afterContent = parent.content.cut(afterStart)
  if (afterContent.size) replacement.push(parent.copy(afterContent))

  const tr = editor.state.tr.replaceWith(parentPos, parentPos + parent.nodeSize, Fragment.fromArray(replacement))
  const targetPos = parentPos + replacement.slice(0, targetIndex).reduce((sum, node) => sum + node.nodeSize, 0)
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(targetPos + 1, tr.doc.content.size))))
  editor.view.dispatch(tr.scrollIntoView())
  return true
}
