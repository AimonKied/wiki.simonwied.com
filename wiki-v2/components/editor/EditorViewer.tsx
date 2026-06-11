'use client'

import dynamic from 'next/dynamic'

const Editor = dynamic(() => import('./Editor'), { ssr: false })

export default function EditorViewer({ content }: { content: object | null }) {
  return <Editor content={content} editable={false} />
}
