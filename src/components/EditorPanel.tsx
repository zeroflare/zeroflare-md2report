import type { CoverMeta } from '../types'
import './EditorPanel.css'

interface EditorPanelProps {
  meta: CoverMeta
  markdown: string
  onMetaChange: (meta: CoverMeta) => void
  onMarkdownChange: (value: string) => void
}

export function EditorPanel({
  meta,
  markdown,
  onMetaChange,
  onMarkdownChange,
}: EditorPanelProps) {
  function update<K extends keyof CoverMeta>(key: K, value: CoverMeta[K]) {
    onMetaChange({ ...meta, [key]: value })
  }

  return (
    <aside className="editor-panel no-print">
      <header className="editor-brand">
        <img
          className="editor-brand-mark"
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt=""
          width={36}
          height={36}
        />
        <div>
          <h1 className="editor-brand-name">Zeroflare Markdown 轉報告</h1>
        </div>
      </header>

      <section className="editor-section">
        <div className="editor-fields">
          <div className="editor-fields-row">
            <label className="editor-field">
              <span>標題</span>
              <textarea
                className="editor-textarea"
                rows={2}
                value={meta.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="報告標題"
              />
            </label>
            <label className="editor-field">
              <span>副標題</span>
              <textarea
                className="editor-textarea"
                rows={2}
                value={meta.subtitle}
                onChange={(e) => update('subtitle', e.target.value)}
                placeholder="副標題（選填）"
              />
            </label>
          </div>
          <div className="editor-fields-row">
            <label className="editor-field">
              <span>公司名稱</span>
              <input
                type="text"
                value={meta.company}
                onChange={(e) => update('company', e.target.value)}
                placeholder="公司名稱"
              />
            </label>
            <label className="editor-field">
              <span>日期</span>
              <input
                type="text"
                value={meta.date}
                onChange={(e) => update('date', e.target.value)}
                placeholder="2026 年 7 月 15 日"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="editor-section editor-section-grow">
        <label className="editor-field editor-field-grow">
          <span>Markdown</span>
          <textarea
            className="editor-markdown"
            value={markdown}
            onChange={(e) => onMarkdownChange(e.target.value)}
            spellCheck={false}
            placeholder="在此輸入 Markdown…"
          />
        </label>
      </section>
    </aside>
  )
}
