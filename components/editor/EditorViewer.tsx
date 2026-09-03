'use client'

import dynamic from 'next/dynamic'

const ArticleEditor = dynamic(() => import('./ArticleEditor'), { ssr: false })

export default function EditorViewer({ content }: { content: object | null }) {
  return <ArticleEditor content={content} editable={false} />
}
