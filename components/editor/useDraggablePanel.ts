'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Position = { left: number; top: number }

function clampToViewport(pos: Position, el: HTMLElement): Position {
  const w = el.offsetWidth
  const h = el.offsetHeight
  return {
    left: Math.min(Math.max(pos.left, 0), Math.max(0, window.innerWidth - w)),
    top: Math.min(Math.max(pos.top, 0), Math.max(0, window.innerHeight - h)),
  }
}

// Macht ein schwebendes Panel (Blockliste, Werkzeugleiste) per Griff frei
// verschiebbar. Vor dem ersten Ziehen bleibt `position` null und der
// Default-Ort ist reine CSS-Platzierung — sonst gaebe es einen
// Server/Client-Hydration-Mismatch, sobald eine gespeicherte Position aus
// localStorage vom CSS-Default abweicht (gleiches Muster wie
// `desktopCollapsed` in RightSidebar.tsx).
export function useDraggablePanel(storageKey: string) {
  const panelRef = useRef<HTMLElement | null>(null)
  const [position, setPosition] = useState<Position | null>(null)

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) setPosition(clampToViewport(JSON.parse(stored), panel))
    } catch {}
  }, [storageKey])

  const onHandlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, select, [draggable="true"]')) return
    const panel = panelRef.current
    if (!panel) return
    e.preventDefault()
    const rect = panel.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const originLeft = rect.left
    const originTop = rect.top

    function onMove(ev: PointerEvent) {
      setPosition(clampToViewport(
        { left: originLeft + (ev.clientX - startX), top: originTop + (ev.clientY - startY) },
        panel!,
      ))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setPosition(curr => {
        try { if (curr) localStorage.setItem(storageKey, JSON.stringify(curr)) } catch {}
        return curr
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [storageKey])

  return { panelRef, position, onHandlePointerDown }
}
