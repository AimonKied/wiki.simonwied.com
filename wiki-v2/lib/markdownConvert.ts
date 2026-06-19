interface MdNode {
  type: string
  attrs?: Record<string, unknown>
  content?: MdNode[]
  text?: string
  marks?: Array<{ type: string }>
}

// ── Inline parser ─────────────────────────────────────────────────────────────

function parseInline(text: string): MdNode[] {
  const result: MdNode[] = []

  // Split on backtick-code first (no further parsing inside)
  const codeParts = text.split(/(`[^`]+`)/g)
  for (const part of codeParts) {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      result.push({ type: 'text', text: part.slice(1, -1), marks: [{ type: 'code' }] })
      continue
    }
    // Bold **
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g)
    for (const bp of boldParts) {
      if (bp.startsWith('**') && bp.endsWith('**') && bp.length > 4) {
        result.push({ type: 'text', text: bp.slice(2, -2), marks: [{ type: 'bold' }] })
        continue
      }
      // Strike ~~
      const strikeParts = bp.split(/(~~[^~]+~~)/g)
      for (const sp of strikeParts) {
        if (sp.startsWith('~~') && sp.endsWith('~~') && sp.length > 4) {
          result.push({ type: 'text', text: sp.slice(2, -2), marks: [{ type: 'strike' }] })
          continue
        }
        // Italic * or _
        const italicParts = sp.split(/(\*[^*]+\*|_[^_]+_)/g)
        for (const ip of italicParts) {
          if (ip.length > 2 && ((ip.startsWith('*') && ip.endsWith('*')) || (ip.startsWith('_') && ip.endsWith('_')))) {
            result.push({ type: 'text', text: ip.slice(1, -1), marks: [{ type: 'italic' }] })
          } else if (ip) {
            result.push({ type: 'text', text: ip })
          }
        }
      }
    }
  }

  return result.filter(n => n.text !== '')
}

function para(content: MdNode[]): MdNode {
  return { type: 'paragraph', content: content.length ? content : [{ type: 'text', text: '' }] }
}

function heading(level: number, content: MdNode[]): MdNode {
  return { type: 'heading', attrs: { level }, content }
}

// ── Markdown → TipTap JSON ────────────────────────────────────────────────────

export function mdToArticleJson(md: string): object {
  const lines = md.split('\n')
  const sections: MdNode[][] = [[]]
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const current = sections[sections.length - 1]

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || null
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      current.push({ type: 'codeBlock', attrs: { language: lang }, content: [{ type: 'text', text: codeLines.join('\n') }] })
      i++
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
      current.push({ type: 'horizontalRule' })
      i++
      continue
    }

    // Heading
    const hm = line.match(/^(#{1,6})\s+(.+)/)
    if (hm) {
      const level = Math.min(hm[1].length, 3) as 1 | 2 | 3
      const content = parseInline(hm[2].trim())
      if (level === 2) {
        // H2 starts a new section
        sections.push([heading(2, content)])
      } else {
        current.push(heading(level, content))
      }
      i++
      continue
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].slice(1).trim())
        i++
      }
      current.push({ type: 'blockquote', content: [para(parseInline(quoteLines.join(' ')))] })
      continue
    }

    // Bullet list
    if (/^[*\-+]\s/.test(line)) {
      const items: MdNode[] = []
      while (i < lines.length && /^[*\-+]\s/.test(lines[i])) {
        items.push({ type: 'listItem', content: [para(parseInline(lines[i].replace(/^[*\-+]\s/, '')))] })
        i++
      }
      current.push({ type: 'bulletList', content: items })
      continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: MdNode[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push({ type: 'listItem', content: [para(parseInline(lines[i].replace(/^\d+\.\s/, '')))] })
        i++
      }
      current.push({ type: 'orderedList', content: items })
      continue
    }

    // Table (line contains |)
    if (line.includes('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i])
        i++
      }
      // Filter out separator rows (only dashes/pipes/colons/spaces)
      const dataRows = tableLines.filter(l => !/^[\s|:=-]+$/.test(l.replace(/-/g, '')))
      if (dataRows.length) {
        const tableRows: MdNode[] = dataRows.map((row, ri) => {
          const cells = row.split('|').slice(1, -1).map(c => c.trim())
          return {
            type: 'tableRow',
            content: cells.map(c => ({
              type: ri === 0 ? 'tableHeader' : 'tableCell',
              content: [para(parseInline(c))],
            })),
          }
        })
        current.push({ type: 'table', content: tableRows })
      }
      continue
    }

    // <details> toggle block
    if (line.trim().toLowerCase() === '<details>') {
      i++
      let summaryText = ''
      if (i < lines.length) {
        const sm = lines[i].match(/^<summary>(.*?)<\/summary>$/i)
        if (sm) { summaryText = sm[1].trim(); i++ }
      }
      const bodyLines: string[] = []
      while (i < lines.length && lines[i].trim().toLowerCase() !== '</details>') {
        bodyLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++ // skip </details>

      // Determine title block type from summaryText prefix
      const hm2 = summaryText.match(/^(#{1,3})\s+(.+)/)
      const titleBlock: MdNode = hm2
        ? heading(Math.min(hm2[1].length, 3), parseInline(hm2[2].trim()))
        : para(parseInline(summaryText))

      const bodyJson = mdToArticleJson(bodyLines.join('\n'))
      const bodyDoc = bodyJson as { content?: Array<{ content?: MdNode[] }> }
      const bodyBlocks: MdNode[] = bodyDoc.content?.flatMap(s => s.content ?? []) ?? []

      current.push({
        type: 'toggle',
        attrs: { open: true },
        content: [titleBlock, ...(bodyBlocks.length ? bodyBlocks : [para([])])],
      })
      continue
    }

    // Blank line
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph — collect until blank line or block element
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^#{1,6}\s/) &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('>') &&
      !/^[*\-+]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !lines[i].includes('|')
    ) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length) {
      current.push(para(parseInline(paraLines.join(' '))))
    }
  }

  const sectionNodes = sections
    .filter(s => s.length > 0)
    .map(s => ({ type: 'section', content: s }))

  return {
    type: 'doc',
    attrs: { wikiMode: 'article' },
    content: sectionNodes.length
      ? sectionNodes
      : [{ type: 'section', content: [para([{ type: 'text', text: '' }])] }],
  }
}

/** Extract the first H1 title from a markdown string, or null if none. */
export function mdExtractTitle(md: string): string | null {
  const m = md.match(/^#\s+(.+)/m)
  return m ? m[1].trim() : null
}

// ── TipTap JSON → Markdown ────────────────────────────────────────────────────

function inlineToMd(nodes: MdNode[] = []): string {
  return nodes.map(node => {
    if (node.type !== 'text') return nodeToMd(node)
    let text = node.text ?? ''
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold')   text = `**${text}**`
      if (mark.type === 'italic') text = `*${text}*`
      if (mark.type === 'strike') text = `~~${text}~~`
      if (mark.type === 'code')   text = `\`${text}\``
    }
    return text
  }).join('')
}

function nodeToMd(node: MdNode): string {
  switch (node.type) {
    case 'doc':
    case 'section':
      return (node.content ?? []).map(nodeToMd).join('\n\n')

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      return `${'#'.repeat(level)} ${inlineToMd(node.content)}`
    }

    case 'paragraph':
      return inlineToMd(node.content)

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? ''
      const code = node.content?.[0]?.text ?? ''
      return `\`\`\`${lang}\n${code}\n\`\`\``
    }

    case 'blockquote': {
      const inner = (node.content ?? []).map(nodeToMd).join('\n')
      return inner.split('\n').map(l => `> ${l}`).join('\n')
    }

    case 'bulletList':
      return (node.content ?? []).map(item =>
        `- ${(item.content ?? []).map(nodeToMd).join(' ')}`
      ).join('\n')

    case 'orderedList':
      return (node.content ?? []).map((item, i) =>
        `${i + 1}. ${(item.content ?? []).map(nodeToMd).join(' ')}`
      ).join('\n')

    case 'horizontalRule':
      return '---'

    case 'table': {
      const rows = node.content ?? []
      if (!rows.length) return ''
      const mdRows = rows.map(row =>
        '| ' + (row.content ?? []).map(cell =>
          (cell.content ?? []).map(nodeToMd).join(' ')
        ).join(' | ') + ' |'
      )
      if (mdRows.length >= 1) {
        const cols = (rows[0].content ?? []).length
        mdRows.splice(1, 0, '| ' + Array(cols).fill('---').join(' | ') + ' |')
      }
      return mdRows.join('\n')
    }

    case 'toggle': {
      const [titleNode, ...rest] = node.content ?? []
      const summaryText = titleNode ? inlineToMd(titleNode.content) : ''
      const summaryPrefix =
        titleNode?.type === 'heading' ? '#'.repeat((titleNode.attrs?.level as number) ?? 1) + ' ' : ''
      const bodyMd = rest.map(nodeToMd).filter(Boolean).join('\n\n')
      const inner = bodyMd ? `\n\n${bodyMd}\n\n` : '\n'
      return `<details>\n<summary>${summaryPrefix}${summaryText}</summary>${inner}</details>`
    }

    default:
      return (node.content ?? []).map(nodeToMd).join('')
  }
}

export function articleJsonToMd(json: object): string {
  return nodeToMd(json as MdNode).replace(/\n{3,}/g, '\n\n').trim()
}
