'use client'

import dynamic from 'next/dynamic'

const Editor = dynamic(() => import('./Editor'), { ssr: false })
const ArticleEditor = dynamic(() => import('./ArticleEditor'), { ssr: false })

function isArticleContent(content: object | null | undefined) {
  if (!content || typeof content !== 'object') return false
  const doc = content as { attrs?: { wikiMode?: string }, content?: Array<{ type?: string }> }
  return doc.attrs?.wikiMode === 'article' || (!!doc.content?.length && doc.content.some(node => node.type !== 'section'))
}

export default function EditorViewer({
  content,
  contentType,
}: {
  content: object | null
  contentType?: 'article' | 'workspace'
}) {
  // Prefer the note's declared type; fall back to sniffing the content shape.
  const isArticle = contentType ? contentType === 'article' : isArticleContent(content)
  return isArticle
    ? <ArticleEditor content={content} editable={false} />
    : <Editor content={content} editable={false} />
}
