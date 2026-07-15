import { useCallback, useEffect, useState } from 'react'
import type { CoverMeta } from './types'
import { SAMPLE_MARKDOWN } from './lib/markdown'
import { exportWord } from './lib/exportWord'
import { loadDraft, saveDraft } from './lib/draftStorage'
import { EditorPanel } from './components/EditorPanel'
import { PreviewPanel } from './components/PreviewPanel'
import './App.css'

function todayChinese(): string {
  const d = new Date()
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

function createSampleMeta(): CoverMeta {
  return {
    title: '國家資通安全研究院\n資安顧問案',
    subtitle: '結案報告',
    company: '零曜科技有限公司',
    date: todayChinese(),
  }
}

function getInitialState(): { meta: CoverMeta; markdown: string } {
  const draft = loadDraft()
  if (draft) {
    return { meta: draft.meta, markdown: draft.markdown }
  }
  return { meta: createSampleMeta(), markdown: SAMPLE_MARKDOWN }
}

export default function App() {
  const initial = getInitialState()
  const [meta, setMeta] = useState<CoverMeta>(initial.meta)
  const [markdown, setMarkdown] = useState(initial.markdown)

  useEffect(() => {
    const id = window.setTimeout(() => {
      saveDraft(meta, markdown)
    }, 250)
    return () => window.clearTimeout(id)
  }, [meta, markdown])

  const handleExportPdf = useCallback(() => {
    window.print()
  }, [])

  const handleExportWord = useCallback(async () => {
    await exportWord(meta, markdown)
  }, [meta, markdown])

  const handleResetSample = useCallback(() => {
    const sampleMeta = createSampleMeta()
    setMeta(sampleMeta)
    setMarkdown(SAMPLE_MARKDOWN)
  }, [])

  return (
    <div className="app-shell">
      <EditorPanel
        meta={meta}
        markdown={markdown}
        onMetaChange={setMeta}
        onMarkdownChange={setMarkdown}
      />
      <PreviewPanel
        meta={meta}
        markdown={markdown}
        onExportPdf={handleExportPdf}
        onExportWord={handleExportWord}
        onResetSample={handleResetSample}
      />
    </div>
  )
}
