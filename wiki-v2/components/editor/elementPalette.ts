export interface ElementPaletteItem {
  key: string
  label: string
  icon: string
  group: string
  keywords: string
}

// Shared block palette — used by the slash ("/") menu, the tool palette aside,
// and the block popover on the ⠿ handle so all three offer the same elements.
export const ELEMENT_PALETTE: ElementPaletteItem[] = [
  { key: 'paragraph',   label: 'Textblock',        icon: 'T',   group: 'Basic', keywords: 'text paragraph absatz normal schreiben' },
  { key: 'h1',          label: 'Titel',             icon: 'H1',  group: 'Basic', keywords: 'titel heading headline ueberschrift gross' },
  { key: 'h2',          label: 'Ueberschrift',      icon: 'H2',  group: 'Basic', keywords: 'heading headline ueberschrift h2' },
  { key: 'h3',          label: 'Untertitel',        icon: 'H3',  group: 'Basic', keywords: 'untertitel heading h3 klein' },
  { key: 'blockquote',  label: 'Zitat',             icon: '"',   group: 'Basic', keywords: 'quote zitat callout' },
  { key: 'bulletList',  label: 'Liste',             icon: 'UL',  group: 'Listen', keywords: 'bullet liste unordered punkte' },
  { key: 'orderedList', label: 'Numm. Liste',       icon: '1.',  group: 'Listen', keywords: 'nummeriert ordered liste zahl' },
  { key: 'taskList',    label: 'To-do-Liste',       icon: '☑',   group: 'Listen', keywords: 'todo task checkbox checkliste aufgabe haken abhaken erledigt' },
  { key: 'table',       label: 'Tabelle',           icon: 'TB',  group: 'Media', keywords: 'table tabelle grid daten' },
  { key: 'image',       label: 'Bild',              icon: 'IMG', group: 'Media', keywords: 'image img bild foto jpg png' },
  { key: 'codeBlock',   label: 'Codeblock',         icon: '</>', group: 'Media', keywords: 'code programmieren snippet pre' },
  { key: 'hr',          label: 'Trennlinie',        icon: '-',   group: 'Basic', keywords: 'linie divider separator trennlinie' },
  { key: 'toggle',      label: 'Toggle',            icon: '▶T',  group: 'Toggle', keywords: 'toggle aufklappen details' },
  { key: 'toggleH1',    label: 'Toggle Titel',      icon: '▶H1', group: 'Toggle', keywords: 'toggle titel aufklappen gross' },
  { key: 'toggleH2',    label: 'Toggle H2',         icon: '▶H2', group: 'Toggle', keywords: 'toggle h2 ueberschrift' },
  { key: 'toggleH3',    label: 'Toggle H3',         icon: '▶H3', group: 'Toggle', keywords: 'toggle h3 untertitel' },
]
