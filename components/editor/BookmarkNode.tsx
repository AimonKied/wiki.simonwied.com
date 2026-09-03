'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

// Die Vorschaudaten stehen als Attribute im Dokument, nicht als Verweis auf
// einen Dienst: die Karte bleibt lesbar, auch wenn die Zielseite spaeter
// verschwindet oder ihre Metadaten aendert -- und eine oeffentliche Seite
// loest beim Anzeigen keinen Abruf aus.
function BookmarkView({ node }: NodeViewProps) {
  const url = node.attrs.url as string | null
  const title = (node.attrs.title as string | null) ?? url ?? ''
  const description = node.attrs.description as string | null
  const image = node.attrs.image as string | null
  const siteName = node.attrs.siteName as string | null

  if (!url) {
    return (
      <NodeViewWrapper style={{ margin: '8px 0' }}>
        <div style={{
          padding: '18px', borderRadius: '8px', border: '1px dashed var(--border)',
          color: 'var(--muted)', fontSize: '12px', textAlign: 'center',
        }}>
          Kein Link hinterlegt.
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper style={{ margin: '8px 0' }}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 0,
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
          background: 'var(--surface)',
          color: 'var(--text)',
          textDecoration: 'none',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
          {description && (
            <p style={{
              margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {description}
            </p>
          )}
          <div style={{ marginTop: 'auto', fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {siteName ?? url}
          </div>
        </div>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            style={{ width: '30%', maxWidth: '200px', objectFit: 'cover', flexShrink: 0, background: 'var(--surface2)' }}
          />
        )}
      </a>
    </NodeViewWrapper>
  )
}

export const BookmarkCard = Node.create({
  name: 'bookmark',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      url: { default: null, parseHTML: el => el.getAttribute('data-url') },
      title: { default: null, parseHTML: el => el.getAttribute('data-title') },
      description: { default: null, parseHTML: el => el.getAttribute('data-description') },
      image: { default: null, parseHTML: el => el.getAttribute('data-image') },
      siteName: { default: null, parseHTML: el => el.getAttribute('data-site-name') },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-bookmark]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs: Record<string, string> = { 'data-bookmark': '' }
    for (const [key, dataKey] of [
      ['url', 'data-url'],
      ['title', 'data-title'],
      ['description', 'data-description'],
      ['image', 'data-image'],
      ['siteName', 'data-site-name'],
    ] as const) {
      const value = node.attrs[key] as string | null
      if (value) attrs[dataKey] = value
    }
    return ['div', mergeAttributes(HTMLAttributes, attrs)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkView)
  },
})
