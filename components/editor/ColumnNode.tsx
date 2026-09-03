'use client'

import { useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Fragment } from '@tiptap/pm/model'
import type { Node as PMNode } from '@tiptap/pm/model'

// Spalten als Container innerhalb einer Section: columnList haelt columns,
// jede column haelt gewoehnliche Bloecke. Das Dokumentmodell bleibt damit
// unangetastet -- eine Section enthaelt weiterhin genau einen Block, dieser
// eine ist nur selbst ein Container.
//
// Auf schmalen Schirmen laufen die Spalten untereinander (flex-wrap plus
// min-width): nebeneinander sind sie dort unlesbar.

function ColumnListView() {
  return (
    <NodeViewWrapper>
      <NodeViewContent
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '18px',
          alignItems: 'flex-start',
          margin: '4px 0',
        }}
      />
    </NodeViewWrapper>
  )
}

function ColumnView({ editor, getPos }: NodeViewProps) {
  const [hovered, setHovered] = useState(false)

  // Position der Spalte innerhalb ihrer Gruppe. Aus der Dokumentposition
  // hergeleitet statt gespeichert, damit sie nach jedem Umsortieren stimmt.
  function locate() {
    if (typeof getPos !== 'function') return null
    const pos = getPos()
    if (pos === undefined) return null
    const $pos = editor.state.doc.resolve(pos)
    const list = $pos.parent
    if (list.type.name !== 'columnList') return null
    return { listPos: $pos.before(), list, index: $pos.index() }
  }

  function move(delta: number) {
    const found = locate()
    if (!found) return
    const { listPos, list, index } = found
    const target = index + delta
    if (target < 0 || target >= list.childCount) return

    const children: PMNode[] = []
    for (let i = 0; i < list.childCount; i++) children.push(list.child(i))
    const [moved] = children.splice(index, 1)
    children.splice(target, 0, moved)

    const tr = editor.state.tr.replaceWith(
      listPos + 1,
      listPos + list.nodeSize - 1,
      Fragment.from(children),
    )
    editor.view.dispatch(tr)
  }

  function remove() {
    const found = locate()
    if (!found) return
    const { listPos, list, index } = found
    const children: PMNode[] = []
    for (let i = 0; i < list.childCount; i++) if (i !== index) children.push(list.child(i))

    const tr = editor.state.tr
    if (children.length === 0) {
      // Letzte Spalte weg heisst: die Gruppe ergibt keinen Sinn mehr.
      tr.delete(listPos, listPos + list.nodeSize)
    } else if (children.length === 1) {
      // Eine einzelne Spalte ist keine Spaltengruppe -- ihren Inhalt an ihre
      // Stelle setzen, statt eine Gruppe mit einem Element stehenzulassen.
      const rest: PMNode[] = []
      children[0].forEach(child => rest.push(child))
      tr.replaceWith(listPos, listPos + list.nodeSize, Fragment.from(rest))
    } else {
      tr.replaceWith(listPos + 1, listPos + list.nodeSize - 1, Fragment.from(children))
    }
    editor.view.dispatch(tr)
  }

  const found = locate()
  const canEdit = editor.isEditable && found !== null

  return (
    <NodeViewWrapper
      style={{ flex: '1 1 240px', minWidth: 'min(100%, 240px)', position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {canEdit && (
        <div
          contentEditable={false}
          style={{
            position: 'absolute', top: -6, right: 0, zIndex: 6,
            display: 'flex', gap: '1px',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.1s',
            pointerEvents: hovered ? 'auto' : 'none',
          }}
        >
          <button type="button" title="Spalte nach links" onClick={() => move(-1)} style={columnButtonStyle}>◀</button>
          <button type="button" title="Spalte nach rechts" onClick={() => move(1)} style={columnButtonStyle}>▶</button>
          <button type="button" title="Spalte entfernen" onClick={remove} style={{ ...columnButtonStyle, color: 'var(--accent2)' }}>✕</button>
        </div>
      )}
      <NodeViewContent />
    </NodeViewWrapper>
  )
}

const columnButtonStyle: React.CSSProperties = {
  width: 20, height: 20,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', borderRadius: 4,
  background: 'var(--surface2)', color: 'var(--muted)',
  fontSize: 9, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit',
}


export const ColumnList = Node.create({
  name: 'columnList',
  group: 'block',
  content: 'column+',
  // isolating: Auswahl und Loeschen sollen nicht versehentlich ueber die
  // Grenze des Containers hinauslaufen.
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-column-list]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-column-list': '' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnListView)
  },
})

export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-column]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-column': '' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnView)
  },
})

// Vorlage fuer eine neue Spaltengruppe mit n leeren Spalten.
export function columnListJSON(count: number) {
  return {
    type: 'columnList',
    content: Array.from({ length: count }, () => ({
      type: 'column',
      content: [{ type: 'paragraph' }],
    })),
  }
}
