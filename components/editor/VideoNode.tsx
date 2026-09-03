'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

// YouTube und Vimeo lassen sich nicht direkt in ein <video> haengen, sie
// brauchen ihre Player-Seite im iframe. Alles andere behandeln wir als
// Videodatei -- das deckt Uploads in wiki-media und fremde .mp4-Links ab.
export function embedSrc(raw: string): { kind: 'iframe' | 'file'; src: string } | null {
  const url = raw.trim()
  if (!url) return null

  const youtube = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  if (youtube) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${youtube[1]}` }

  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` }

  return { kind: 'file', src: url }
}

function VideoView({ node }: NodeViewProps) {
  const src = node.attrs.src as string | null
  const embed = src ? embedSrc(src) : null

  return (
    <NodeViewWrapper style={{ position: 'relative', margin: '8px 0' }}>
      {!embed && (
        <div style={{
          padding: '18px', borderRadius: '8px', border: '1px dashed var(--border)',
          color: 'var(--muted)', fontSize: '12px', textAlign: 'center',
        }}>
          Kein Video hinterlegt.
        </div>
      )}
      {embed?.kind === 'iframe' && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9' }}>
          <iframe
            src={embed.src}
            title="Video"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              border: 0, borderRadius: '8px',
            }}
          />
        </div>
      )}
      {embed?.kind === 'file' && (
        <video
          src={embed.src}
          controls
          preload="metadata"
          style={{ display: 'block', width: '100%', borderRadius: '8px', background: '#000' }}
        />
      )}
    </NodeViewWrapper>
  )
}

export const VideoEmbed = Node.create({
  name: 'videoEmbed',
  group: 'block',
  // atom: der Knoten hat keinen bearbeitbaren Inhalt, der Cursor soll nicht
  // hineinlaufen. draggable, damit er sich wie ein Bild verschieben laesst.
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null, parseHTML: el => el.getAttribute('data-src') },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-video-embed]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-video-embed': '',
      'data-src': (node.attrs.src as string | null) ?? '',
    })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoView)
  },
})
