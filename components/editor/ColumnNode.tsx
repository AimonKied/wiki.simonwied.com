'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react'

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

function ColumnView() {
  return (
    <NodeViewWrapper
      style={{
        flex: '1 1 240px',
        minWidth: 'min(100%, 240px)',
      }}
    >
      <NodeViewContent />
    </NodeViewWrapper>
  )
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
