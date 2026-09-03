// Vorlagen fuer neue Artikel. Bewusst als TipTap-JSON und nicht als Markdown:
// createNote schreibt den Inhalt direkt in die Spalte, ein Umweg ueber den
// Markdown-Import wuerde nur eine zweite Fehlerquelle aufmachen.
//
// Jeder Block ist eine eigene Section — genau die Form, die
// normalizeArticleContent im Editor ohnehin herstellt.

interface Block {
  type: string
  attrs?: Record<string, unknown>
  content?: unknown[]
}

function section(...blocks: Block[]) {
  return { type: 'section', content: blocks }
}

function heading(level: number, text: string): Block {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }
}

function paragraph(text?: string): Block {
  return text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' }
}

function bullets(...items: string[]): Block {
  return {
    type: 'bulletList',
    content: items.map(text => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    })),
  }
}

function todos(...items: string[]): Block {
  return {
    type: 'taskList',
    content: items.map(text => ({
      type: 'taskItem',
      attrs: { checked: false },
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    })),
  }
}

function doc(...sections: object[]) {
  return { type: 'doc', attrs: { wikiMode: 'article' }, content: sections }
}

export interface ArticleTemplate {
  key: string
  label: string
  description: string
  emoji: string | null
  content: object
}

export const ARTICLE_TEMPLATES: ArticleTemplate[] = [
  {
    key: 'blank',
    label: 'Leerer Artikel',
    description: 'Nur eine leere Zeile — der Standard.',
    emoji: null,
    content: doc(section(paragraph())),
  },
  {
    key: 'recipe',
    label: 'Rezept',
    description: 'Zutaten, Zubereitung, Notizen.',
    emoji: '🍳',
    content: doc(
      section(heading(2, 'Zutaten')),
      section(bullets('', '', '')),
      section(heading(2, 'Zubereitung')),
      section(paragraph()),
      section(heading(2, 'Notizen')),
      section(paragraph()),
    ),
  },
  {
    key: 'howto',
    label: 'Anleitung',
    description: 'Ziel, Voraussetzungen, Schritte, Fallstricke.',
    emoji: '🛠️',
    content: doc(
      section(heading(2, 'Ziel')),
      section(paragraph()),
      section(heading(2, 'Voraussetzungen')),
      section(todos('', '')),
      section(heading(2, 'Schritte')),
      section(paragraph()),
      section(heading(2, 'Fallstricke')),
      section(paragraph()),
    ),
  },
  {
    key: 'cheatsheet',
    label: 'Cheatsheet',
    description: 'Kurze Abschnitte mit Befehlen und Erklärung.',
    emoji: '📋',
    content: doc(
      section(heading(2, 'Grundlagen')),
      section(paragraph()),
      section(heading(2, 'Häufig gebraucht')),
      section(paragraph()),
      section(heading(2, 'Selten, aber wichtig')),
      section(paragraph()),
    ),
  },
]

export function templateByKey(key: string): ArticleTemplate {
  return ARTICLE_TEMPLATES.find(template => template.key === key) ?? ARTICLE_TEMPLATES[0]
}
