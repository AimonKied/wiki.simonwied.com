export interface ElementPaletteItem {
  key: string
  label: string
  icon: string
  group: string
  keywords: string
  description: string
}

// Filter + rank palette items for the slash menu. Substring matching alone is
// too loose ("hr" is contained in "Ueberschrift"), so exact key matches and
// label/keyword prefixes rank first — like Notion's slash search.
export function filterPalette(query: string): ElementPaletteItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return ELEMENT_PALETTE

  function score(item: ElementPaletteItem): number {
    const label = item.label.toLowerCase()
    const words = `${item.key} ${label} ${item.keywords}`.toLowerCase().split(/\s+/)
    if (item.key.toLowerCase() === q || label === q) return 0
    if (words.some(w => w === q)) return 1
    if (item.key.toLowerCase().startsWith(q) || label.startsWith(q)) return 2
    if (words.some(w => w.startsWith(q))) return 3
    if (`${label} ${item.key} ${item.keywords}`.toLowerCase().includes(q)) return 4
    return -1
  }

  return ELEMENT_PALETTE
    .map(item => ({ item, s: score(item) }))
    .filter(x => x.s >= 0)
    .sort((a, b) => a.s - b.s)
    .map(x => x.item)
}

// Shared block palette — used by the slash ("/") menu, the tool palette aside,
// and the block popover on the ⠿ handle so all three offer the same elements.
export const ELEMENT_PALETTE: ElementPaletteItem[] = [
  { key: 'paragraph',   label: 'Textblock',        icon: 'T',   group: 'Basic', keywords: 'text paragraph absatz normal schreiben', description: 'Normaler Text' },
  { key: 'h1',          label: 'Titel',             icon: 'H1',  group: 'Basic', keywords: 'titel heading headline ueberschrift überschrift gross groß', description: 'Große Überschrift' },
  { key: 'h2',          label: 'Überschrift',      icon: 'H2',  group: 'Basic', keywords: 'heading headline ueberschrift überschrift h2', description: 'Mittlere Überschrift' },
  { key: 'h3',          label: 'Untertitel',        icon: 'H3',  group: 'Basic', keywords: 'untertitel heading h3 klein', description: 'Kleine Überschrift' },
  { key: 'blockquote',  label: 'Zitat',             icon: '"',   group: 'Basic', keywords: 'quote zitat', description: 'Hervorgehobenes Zitat' },
  { key: 'callout',     label: 'Callout',           icon: '💡',  group: 'Basic', keywords: 'callout hinweis info warnung tipp box notiz achtung wichtig', description: 'Hinweisbox mit Emoji und Farbe' },
  { key: 'bulletList',  label: 'Liste',             icon: 'UL',  group: 'Listen', keywords: 'bullet liste unordered punkte', description: 'Aufzählung' },
  { key: 'orderedList', label: 'Numm. Liste',       icon: '1.',  group: 'Listen', keywords: 'nummeriert ordered liste zahl', description: 'Nummerierte Liste' },
  { key: 'taskList',    label: 'To-do-Liste',       icon: '☑',   group: 'Listen', keywords: 'todo task checkbox checkliste aufgabe haken abhaken erledigt', description: 'Checkboxen zum Abhaken' },
  { key: 'table',       label: 'Tabelle',           icon: 'TB',  group: 'Media', keywords: 'table tabelle grid daten', description: 'Tabelle mit 3 × 3 Zellen' },
  { key: 'image',       label: 'Bild',              icon: 'IMG', group: 'Media', keywords: 'image img bild foto jpg png', description: 'Bild über URL oder Datei' },
  { key: 'codeBlock',   label: 'Codeblock',         icon: '</>', group: 'Media', keywords: 'code programmieren snippet pre', description: 'Codeblock mit Highlighting' },
  { key: 'hr',          label: 'Trennlinie',        icon: '-',   group: 'Basic', keywords: 'linie divider separator trennlinie', description: 'Horizontale Linie' },
  { key: 'toggle',      label: 'Toggle',            icon: '▶T',  group: 'Toggle', keywords: 'toggle aufklappen details', description: 'Einklappbarer Block' },
  { key: 'toggleH1',    label: 'Toggle Titel',      icon: '▶H1', group: 'Toggle', keywords: 'toggle titel aufklappen gross', description: 'Toggle in Titelgröße' },
  { key: 'toggleH2',    label: 'Toggle H2',         icon: '▶H2', group: 'Toggle', keywords: 'toggle h2 ueberschrift überschrift', description: 'Toggle in H2-Größe' },
  { key: 'toggleH3',    label: 'Toggle H3',         icon: '▶H3', group: 'Toggle', keywords: 'toggle h3 untertitel', description: 'Toggle in H3-Größe' },
]
