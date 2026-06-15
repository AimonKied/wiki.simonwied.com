'use client'

import dynamic from 'next/dynamic'

const Editor = dynamic(() => import('./Editor'), { ssr: false })
const ArticleEditor = dynamic(() => import('./ArticleEditor'), { ssr: false })

function isArticleContent(content: object | null | undefined) {
  if (!content || typeof content !== 'object') return false
  const doc = content as { attrs?: { wikiMode?: string }, content?: Array<{ type?: string }> }
  return doc.attrs?.wikiMode === 'article' || (!!doc.content?.length && doc.content.some(node => node.type !== 'section'))
}

export default function EditorViewer({ content }: { content: object | null }) {
  return isArticleContent(content)
    ? <ArticleEditor content={content} editable={false} />
    : <Editor content={content} editable={false} />
}
