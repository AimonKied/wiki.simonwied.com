'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useRef, useState, useCallback } from 'react'

// ── Shared styles ────────────────────────────────────────────────────────────

const TOOLBAR_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: -38,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 2,
  background: '#1a1a2a',
  border: '1px solid #2e2e42',
  borderRadius: 7,
  padding: '3px 5px',
  zIndex: 1000,
  whiteSpace: 'nowrap',
}

const tbBtn = (active = false): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 26,
  height: 24,
  padding: '0 5px',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: active ? 700 : 400,
  background: active ? 'rgba(255,255,255,0.2)' : 'transparent',
  color: '#e8e8f0',
})

const DIVIDER: React.CSSProperties = {
  width: 1,
  background: '#2e2e42',
  margin: '2px 3px',
  alignSelf: 'stretch',
}

const RESIZE_HANDLE: React.CSSProperties = {
  position: 'absolute',
  right: -5,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 10,
  height: 36,
  borderRadius: 5,
  cursor: 'ew-resize',
  background: 'var(--accent)',
  opacity: 0.85,
}

type Align = 'left' | 'center' | 'right'

function alignContainerStyle(align: Align): React.CSSProperties {
  if (align === 'left')  return { display: 'flex', justifyContent: 'flex-start' }
  if (align === 'right') return { display: 'flex', justifyContent: 'flex-end' }
  return { display: 'flex', justifyContent: 'center' }
}

// ── useResize hook ───────────────────────────────────────────────────────────

function useResize(onWidth: (w: number) => void) {
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = containerRef.current?.offsetWidth ?? 400

    function onMove(e: MouseEvent) {
      const newW = Math.max(80, startW + (e.clientX - startX))
      onWidth(newW)
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [onWidth])

  return { containerRef, onMouseDown }
}

// ── ImageView NodeView ───────────────────────────────────────────────────────

function ImageView({ node, updateAttributes, selected, deleteNode, editor }: NodeViewProps) {
  const { src, alt, width, align = 'center' } = node.attrs as {
    src: string; alt?: string; width?: string; align?: Align
  }

  const [liveWidth, setLiveWidth] = useState<string | null>(width ?? null)

  const { containerRef, onMouseDown } = useResize((w) => {
    const val = `${w}px`
    setLiveWidth(val)
    updateAttributes({ width: val })
  })

  const isEditable = editor.isEditable

  return (
    <NodeViewWrapper>
      <div style={alignContainerStyle(align as Align)}>
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            display: 'inline-block',
            width: liveWidth ?? 'auto',
            maxWidth: '100%',
          }}
        >
          <img
            src={src}
            alt={alt ?? ''}
            draggable={false}
            style={{
              display: 'block',
              width: '100%',
              borderRadius: 6,
              outline: selected && isEditable ? '2px solid var(--accent)' : 'none',
              outlineOffset: 2,
            }}
          />

          {selected && isEditable && (
            <>
              <div style={TOOLBAR_STYLE}>
                <button type="button" style={tbBtn(align === 'left')}   onClick={() => updateAttributes({ align: 'left' })}   title="Links">◀</button>
                <button type="button" style={tbBtn(align === 'center')} onClick={() => updateAttributes({ align: 'center' })} title="Mitte">▶◀</button>
                <button type="button" style={tbBtn(align === 'right')}  onClick={() => updateAttributes({ align: 'right' })}  title="Rechts">▶</button>
                <span style={DIVIDER} />
                {liveWidth && (
                  <span style={{ ...tbBtn(), color: '#a9a9b8', fontSize: 11 }}>{Math.round(parseInt(liveWidth))} px</span>
                )}
                <button
                  type="button"
                  style={tbBtn()}
                  onClick={() => { setLiveWidth(null); updateAttributes({ width: null }) }}
                  title="Breite zurücksetzen"
                >⟳</button>
                <span style={DIVIDER} />
                <button type="button" style={{ ...tbBtn(), color: '#ef4444' }} onClick={() => deleteNode()} title="Löschen">×</button>
              </div>
              <div onMouseDown={onMouseDown} style={RESIZE_HANDLE} title="Breite ziehen" />
            </>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  )
}

// ── VideoView NodeView ───────────────────────────────────────────────────────

function VideoView({ node, updateAttributes, selected, deleteNode, editor }: NodeViewProps) {
  const { src, width, align = 'center' } = node.attrs as {
    src: string; width?: string; align?: Align
  }

  const [liveWidth, setLiveWidth] = useState<string | null>(width ?? null)

  const { containerRef, onMouseDown } = useResize((w) => {
    const val = `${w}px`
    setLiveWidth(val)
    updateAttributes({ width: val })
  })

  const isEditable = editor.isEditable

  return (
    <NodeViewWrapper>
      <div style={alignContainerStyle(align as Align)}>
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            display: 'inline-block',
            width: liveWidth ?? '100%',
            maxWidth: '100%',
          }}
        >
          <video
            src={src}
            controls
            style={{
              display: 'block',
              width: '100%',
              borderRadius: 6,
              outline: selected && isEditable ? '2px solid var(--accent)' : 'none',
              outlineOffset: 2,
              background: '#000',
            }}
          />

          {selected && isEditable && (
            <>
              <div style={TOOLBAR_STYLE}>
                <button type="button" style={tbBtn(align === 'left')}   onClick={() => updateAttributes({ align: 'left' })}   title="Links">◀</button>
                <button type="button" style={tbBtn(align === 'center')} onClick={() => updateAttributes({ align: 'center' })} title="Mitte">▶◀</button>
                <button type="button" style={tbBtn(align === 'right')}  onClick={() => updateAttributes({ align: 'right' })}  title="Rechts">▶</button>
                <span style={DIVIDER} />
                {liveWidth && (
                  <span style={{ ...tbBtn(), color: '#a9a9b8', fontSize: 11 }}>{Math.round(parseInt(liveWidth))} px</span>
                )}
                <button
                  type="button"
                  style={tbBtn()}
                  onClick={() => { setLiveWidth(null); updateAttributes({ width: null }) }}
                  title="Breite zurücksetzen"
                >⟳</button>
                <span style={DIVIDER} />
                <button type="button" style={{ ...tbBtn(), color: '#ef4444' }} onClick={() => deleteNode()} title="Löschen">×</button>
              </div>
              <div onMouseDown={onMouseDown} style={RESIZE_HANDLE} title="Breite ziehen" />
            </>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  )
}

// ── ResizableImage extension ─────────────────────────────────────────────────

export const ResizableImage = Image.extend({
  inline: false,
  group: 'block',

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: el => el.getAttribute('data-width') || el.style.width || null,
        renderHTML: attrs => attrs.width ? { 'data-width': attrs.width, style: `width:${attrs.width}` } : {},
      },
      align: {
        default: 'center',
        parseHTML: el => el.getAttribute('data-align') || 'center',
        renderHTML: attrs => ({ 'data-align': attrs.align ?? 'center' }),
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
})

// ── VideoNode extension ──────────────────────────────────────────────────────

export const VideoNode = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: el => (el as HTMLVideoElement).src || el.getAttribute('src'),
      },
      width: {
        default: null,
        parseHTML: el => el.getAttribute('data-width') || el.style.width || null,
        renderHTML: attrs => attrs.width ? { 'data-width': attrs.width, style: `width:${attrs.width}` } : {},
      },
      align: {
        default: 'center',
        parseHTML: el => el.getAttribute('data-align') || 'center',
        renderHTML: attrs => ({ 'data-align': attrs.align ?? 'center' }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'video[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { width: _w, align: _a, ...rest } = HTMLAttributes
    return ['video', mergeAttributes(rest, { controls: '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoView)
  },
})
