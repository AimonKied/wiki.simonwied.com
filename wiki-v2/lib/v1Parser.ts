import { parse as parseHtml } from 'node-html-parser'
import type { HTMLElement as HtmlEl } from 'node-html-parser'

interface TipNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TipNode[]
  text?: string
  marks?: Array<{ type: string }>
}

export interface V1PageMeta {
  title: string
  emoji: string | null
  description: string | null
}

// ── Inline helpers ────────────────────────────────────────────────────────────

function textNode(text: string, marks: Array<{ type: string }> = []): TipNode {
  return marks.length ? { type: 'text', text, marks } : { type: 'text', text }
}

function para(content: TipNode[]): TipNode {
  return { type: 'paragraph', content: content.length ? content : [{ type: 'text', text: '' }] }
}

function heading(level: 1 | 2 | 3, content: TipNode[]): TipNode {
  return { type: 'heading', attrs: { level }, content }
}

/** Recursively extract inline nodes from an element, applying marks from HTML tags. */
function inlineNodes(el: HtmlEl, marks: Array<{ type: string }> = []): TipNode[] {
  const nodes: TipNode[] = []
  for (const child of el.childNodes) {
    if (child.nodeType === 3) {
      const text = child.text
      if (text) nodes.push(textNode(text, marks))
      continue
    }
    const c = child as HtmlEl
    const tag = c.tagName?.toLowerCase() ?? ''
    const childMarks = [...marks]
    if (tag === 'strong' || tag === 'b') childMarks.push({ type: 'bold' })
    else if (tag === 'em' || tag === 'i') childMarks.push({ type: 'italic' })
    else if (tag === 'code' || c.classList?.contains('hl-func') || c.classList?.contains('hl-key') || c.classList?.contains('hl-str') || c.classList?.contains('hl-var') || c.classList?.contains('hl-num') || c.classList?.contains('hl-comment') || c.classList?.contains('hl-good')) {
      // syntax-highlighted spans → inline code mark (only if no nested structure)
      const raw = c.text
      if (raw.trim()) nodes.push(textNode(raw, [...marks, { type: 'code' }]))
      continue
    }
    nodes.push(...inlineNodes(c, childMarks))
  }
  return nodes
}

/** Strip all HTML tags and return plain text. */
function plainText(el: HtmlEl): string {
  return el.text.replace(/\s+/g, ' ').trim()
}

/** Convert a <pre> element to a codeBlock node. */
function convertPre(el: HtmlEl): TipNode {
  const code = el.text
  return { type: 'codeBlock', attrs: { language: null }, content: [{ type: 'text', text: code }] }
}

/** Convert a <table> element to a TipTap table node. */
function convertTable(el: HtmlEl): TipNode {
  const rows = el.querySelectorAll('tr')
  const tableRows: TipNode[] = rows.map((row, ri) => {
    const cells = row.querySelectorAll('th, td')
    return {
      type: 'tableRow',
      content: cells.map(cell => ({
        type: ri === 0 && cell.tagName === 'TH' ? 'tableHeader' : 'tableCell',
        content: [para(inlineNodes(cell))],
      })),
    }
  }).filter(r => (r.content?.length ?? 0) > 0)
  return { type: 'table', content: tableRows }
}

/** Convert div.steps (containing div.step children) to an ordered list. */
function convertSteps(el: HtmlEl): TipNode {
  const steps = el.querySelectorAll('.step')
  const items: TipNode[] = steps.map(step => {
    // Step text: strip the step-num span, keep the rest
    const numSpan = step.querySelector('.step-num')
    if (numSpan) numSpan.remove()
    const text = step.text.replace(/\s+/g, ' ').trim()
    return { type: 'listItem', content: [para([textNode(text)])] }
  })
  return { type: 'orderedList', content: items.length ? items : [{ type: 'listItem', content: [para([])] }] }
}

/** Convert a <ul> to a bullet list. */
function convertUl(el: HtmlEl): TipNode {
  const items = el.querySelectorAll('li').map(li => ({
    type: 'listItem',
    content: [para(inlineNodes(li))],
  }))
  return { type: 'bulletList', content: items.length ? items : [{ type: 'listItem', content: [para([])] }] }
}

/** Convert a <ol> to an ordered list. */
function convertOl(el: HtmlEl): TipNode {
  const items = el.querySelectorAll('li').map(li => ({
    type: 'listItem',
    content: [para(inlineNodes(li))],
  }))
  return { type: 'orderedList', content: items.length ? items : [{ type: 'listItem', content: [para([])] }] }
}

/** Main block-level converter — returns 0..n TipTap nodes from one HTML element. */
function convertBlock(el: HtmlEl): TipNode[] {
  const tag = el.tagName?.toLowerCase() ?? ''
  const cls = el.classNames ?? ''

  // Headings
  if (tag === 'h1') return [heading(1, inlineNodes(el))]
  if (tag === 'h2') return [heading(2, inlineNodes(el))]
  if (tag === 'h3') return [heading(3, inlineNodes(el))]
  if (tag === 'h4') return [heading(3, inlineNodes(el))]

  // Paragraph
  if (tag === 'p') {
    const inline = inlineNodes(el)
    if (!inline.length || inline.every(n => !n.text?.trim())) return []
    return [para(inline)]
  }

  // Code block
  if (tag === 'pre') return [convertPre(el)]

  // Table
  if (tag === 'table') return [convertTable(el)]

  // Lists
  if (tag === 'ul') return [convertUl(el)]
  if (tag === 'ol') return [convertOl(el)]

  // div.steps → ordered list
  if (tag === 'div' && cls.includes('steps')) return [convertSteps(el)]

  // div.cmd-block → h3 + content
  if (tag === 'div' && cls.includes('cmd-block')) return extractChildren(el)

  // div.subcategory → extract sub-title as H3 + sub-content
  if (tag === 'div' && cls.includes('subcategory')) {
    const blocks: TipNode[] = []
    const subTitle = el.querySelector('.sub-title')
    if (subTitle) blocks.push(heading(3, [textNode(plainText(subTitle))]))
    const subContent = el.querySelector('.sub-content')
    if (subContent) blocks.push(...extractChildren(subContent))
    return blocks
  }

  // div.category-content / div.section-content / div.content → recurse
  if (tag === 'div' && (cls.includes('category-content') || cls.includes('section-content') || cls.includes('content'))) {
    return extractChildren(el)
  }

  // div.how-it-works / div.defense-block → H3 heading + content
  if (tag === 'div' && (cls.includes('how-it-works') || cls.includes('defense-block'))) {
    const blocks: TipNode[] = []
    const h4 = el.querySelector('h4')
    if (h4) blocks.push(heading(3, [textNode(plainText(h4))]))
    for (const child of el.childNodes) {
      if (child.nodeType !== 1) continue
      const c = child as HtmlEl
      if (c.tagName?.toLowerCase() === 'h4') continue
      blocks.push(...convertBlock(c))
    }
    return blocks
  }

  // blockquote / callout → blockquote node
  if (tag === 'blockquote' || (tag === 'div' && cls.includes('callout'))) {
    const text = plainText(el)
    if (!text) return []
    return [{ type: 'blockquote', content: [para([textNode(text)])] }]
  }

  // div with meaningful text but no special class → try to extract as paragraph
  if (tag === 'div') {
    return extractChildren(el)
  }

  // Ignore nav/header/footer/script/style/button/span at block level
  return []
}

/** Visit all direct children of a container and collect block nodes. */
function extractChildren(container: HtmlEl): TipNode[] {
  const blocks: TipNode[] = []
  for (const child of container.childNodes) {
    if (child.nodeType !== 1) continue
    const el = child as HtmlEl
    const tag = el.tagName?.toLowerCase() ?? ''
    // Skip structural elements that aren't content
    if (['script', 'style', 'nav', 'header', 'footer', 'button', 'input', 'noscript'].includes(tag)) continue
    // Skip category-header / sub-header (headings extracted separately)
    const cls = el.classNames ?? ''
    if (cls.includes('category-header') || cls.includes('section-header') || cls.includes('section-header-row') || cls.includes('sub-header')) continue
    blocks.push(...convertBlock(el))
  }
  return blocks
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface ParsedV1Page {
  meta: V1PageMeta
  content: object
}

export function parseV1Html(html: string): ParsedV1Page {
  const root = parseHtml(html)

  // Metadata
  const emojiEl = root.querySelector('.page-emoji')
  const titleEl = root.querySelector('h1.page-title')
  const subtitleEl = root.querySelector('.page-subtitle')

  const meta: V1PageMeta = {
    title: titleEl ? plainText(titleEl) : 'Untitled',
    emoji: emojiEl ? emojiEl.text.trim() : null,
    description: subtitleEl ? plainText(subtitleEl) || null : null,
  }

  // Sections: div.category or section.page-section
  const sectionEls = root.querySelectorAll('div.category, section.page-section')

  const sections: TipNode[] = []

  for (const sectionEl of sectionEls) {
    const sectionBlocks: TipNode[] = []

    // Section heading — cat-title
    const h2El = sectionEl.querySelector('h2.cat-title, h2')
    if (h2El) sectionBlocks.push(heading(2, [textNode(plainText(h2El))]))

    // Content — everything except the category-header wrapper
    const contentEl = sectionEl.querySelector('.category-content, .section-content')
    if (contentEl) {
      sectionBlocks.push(...extractChildren(contentEl))
    } else {
      // No explicit content wrapper — extract direct children (skip header)
      for (const child of sectionEl.childNodes) {
        if (child.nodeType !== 1) continue
        const el = child as HtmlEl
        const cls = el.classNames ?? ''
        if (cls.includes('category-header') || cls.includes('section-header') || cls.includes('section-header-row')) continue
        sectionBlocks.push(...convertBlock(el))
      }
    }

    if (sectionBlocks.length) {
      sections.push({ type: 'section', content: sectionBlocks })
    }
  }

  // Fallback: if no sections found, wrap entire main content
  if (!sections.length) {
    const main = root.querySelector('main') ?? root
    const fallback = extractChildren(main)
    sections.push({ type: 'section', content: fallback.length ? fallback : [para([])] })
  }

  const content = {
    type: 'doc',
    attrs: { wikiMode: 'article' },
    content: sections,
  }

  return { meta, content }
}
