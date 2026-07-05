'use client'

import Image from '@tiptap/extension-image'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useRef, useState, useCallback, useEffect } from 'react'

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
  right: -7,
  bottom: -7,
  width: 16,
  height: 16,
  borderRadius: 8,
  cursor: 'ew-resize',
  background: 'var(--accent)',
  border: '2px solid #fff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
}

type Align = 'left' | 'center' | 'right'

function alignContainerStyle(align: Align): React.CSSProperties {
  if (align === 'left')  return { display: 'flex', justifyContent: 'flex-start' }
  if (align === 'right') return { display: 'flex', justifyContent: 'flex-end' }
  return { display: 'flex', justifyContent: 'center' }
}

// ── useResize hook ───────────────────────────────────────────────────────────

function useResize(onWidth: (w: number) => void, getMaxWidth: () => number) {
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = containerRef.current?.offsetWidth ?? 400

    function onMove(e: MouseEvent) {
      const newW = Math.max(80, Math.min(getMaxWidth(), startW + (e.clientX - startX)))
      onWidth(newW)
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [onWidth, getMaxWidth])

  return { containerRef, onMouseDown }
}

// ── ImageView NodeView ───────────────────────────────────────────────────────

function ImageView({ node, updateAttributes, selected, deleteNode, editor, getPos }: NodeViewProps) {
  const { src, alt, width, align = 'center', rotate = 0 } = node.attrs as {
    src: string; alt?: string; width?: string; align?: Align; rotate?: number
  }

  const [liveWidth, setLiveWidth] = useState<string | null>(width ?? null)
  const [hovered, setHovered] = useState(false)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const isSideways = Math.abs(rotate % 180) === 90
  const widthScale = isSideways && naturalSize?.h ? Math.min(1, naturalSize.w / naturalSize.h) : 1
  const imageWidth = liveWidth
    ? `min(${liveWidth}, ${widthScale * 100}%)`
    : widthScale === 1 ? 'auto' : `${widthScale * 100}%`

  const getMaxImageWidth = useCallback(() => {
    const blockWidth = frameRef.current?.clientWidth ?? 2000
    return Math.max(1, Math.floor(blockWidth))
  }, [])

  const clampImageWidth = useCallback((w: number) => {
    const max = getMaxImageWidth()
    return Math.max(Math.min(80, max), Math.min(max, Math.round(w)))
  }, [getMaxImageWidth])

  const { containerRef, onMouseDown } = useResize((w) => {
    const val = `${clampImageWidth(w)}px`
    setLiveWidth(val)
    updateAttributes({ width: val })
  }, getMaxImageWidth)

  const isEditable = editor.isEditable
  const controlsVisible = isEditable && (selected || hovered)
  const currentWidth = liveWidth ? Math.round(parseInt(liveWidth)) : ''
  const maxImageWidth = getMaxImageWidth()

  useEffect(() => {
    if (!liveWidth) return
    const parsedWidth = parseInt(liveWidth)
    if (!Number.isFinite(parsedWidth)) return
    const next = clampImageWidth(parsedWidth)
    if (next === parsedWidth) return
    const nextWidth = `${next}px`
    setLiveWidth(nextWidth)
    queueMicrotask(() => updateAttributes({ width: nextWidth }))
  }, [clampImageWidth, liveWidth, updateAttributes])

  function setWidthFromInput(value: string) {
    const width = Number(value)
    if (!Number.isFinite(width)) return
    const next = clampImageWidth(width)
    const nextWidth = `${next}px`
    setLiveWidth(nextWidth)
    updateAttributes({ width: nextWidth })
  }

  function rotateImage() {
    updateAttributes({ rotate: ((rotate + 90) % 360 + 360) % 360 })
  }

  function clearSelectionBesideImage(e: React.MouseEvent<HTMLDivElement>) {
    if (!isEditable || e.target !== e.currentTarget || typeof getPos !== 'function') return
    const pos = getPos()
    if (typeof pos !== 'number') return
    e.preventDefault()
    editor.chain().focus().setTextSelection(pos + node.nodeSize).run()
  }

  return (
    <NodeViewWrapper draggable={isEditable}>
      <div ref={frameRef} onMouseDown={clearSelectionBesideImage} style={alignContainerStyle(align as Align)}>
        <div
          ref={containerRef}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'relative',
            display: 'inline-flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: liveWidth ?? 'fit-content',
            maxWidth: '100%',
            lineHeight: 0,
          }}
        >
          <img
            src={src}
            alt={alt ?? ''}
            draggable={false}
            onLoad={e => setNaturalSize({
              w: e.currentTarget.naturalWidth || e.currentTarget.width,
              h: e.currentTarget.naturalHeight || e.currentTarget.height,
            })}
            style={{
              display: 'block',
              width: imageWidth,
              maxWidth: '100%',
              height: 'auto',
              borderRadius: 6,
              transform: rotate ? `rotate(${rotate}deg)` : undefined,
              outline: controlsVisible ? '2px solid var(--accent)' : 'none',
              outlineOffset: 2,
            }}
          />

          {controlsVisible && (
            <>
              <div style={TOOLBAR_STYLE}>
                <button type="button" style={tbBtn(align === 'left')}   onClick={() => updateAttributes({ align: 'left' })}   title="Links">◀</button>
                <button type="button" style={tbBtn(align === 'center')} onClick={() => updateAttributes({ align: 'center' })} title="Mitte">▶◀</button>
                <button type="button" style={tbBtn(align === 'right')}  onClick={() => updateAttributes({ align: 'right' })}  title="Rechts">▶</button>
                <span style={DIVIDER} />
                <label title="Breite in Pixel" style={{ display: 'inline-flex', alignItems: 'center', height: 24, gap: 3, padding: '0 5px', color: '#a9a9b8', fontSize: 11 }}>
                  <input
                    type="number"
                    min={80}
                    max={maxImageWidth}
                    step={10}
                    value={currentWidth}
                    placeholder="auto"
                    onMouseDown={e => e.stopPropagation()}
                    onChange={e => setWidthFromInput(e.currentTarget.value)}
                    style={{
                      width: 52,
                      height: 20,
                      padding: '0 4px',
                      border: '1px solid #3a3a50',
                      borderRadius: 4,
                      background: '#242438',
                      color: '#e8e8f0',
                      fontFamily: 'inherit',
                      fontSize: 11,
                      outline: 'none',
                    }}
                  />
                  px
                </label>
                <button
                  type="button"
                  style={tbBtn()}
                  onClick={rotateImage}
                  title="90 Grad drehen"
                >⟳</button>
                <span style={DIVIDER} />
                <button type="button" style={{ ...tbBtn(), color: '#ef4444' }} onClick={() => deleteNode()} title="Löschen">×</button>
              </div>
              <div onMouseDown={onMouseDown} style={RESIZE_HANDLE} title="Größe ziehen" />
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
  draggable: true,

  addOptions() {
    return {
      ...this.parent?.(),
      allowBase64: true,
    }
  },

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
      rotate: {
        default: 0,
        parseHTML: el => Number(el.getAttribute('data-rotate') || 0),
        renderHTML: attrs => attrs.rotate ? { 'data-rotate': attrs.rotate, style: `transform:rotate(${attrs.rotate}deg)` } : {},
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
})
