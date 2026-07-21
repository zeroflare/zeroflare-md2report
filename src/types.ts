export interface CoverMeta {
  title: string
  subtitle: string
  company: string
  date: string
}

export interface TocEntry {
  id: string
  text: string
  level: 2 | 3
}

/** Centered caption lines starting with 表 / 圖 */
export interface CaptionEntry {
  id: string
  text: string
  kind: 'table' | 'figure'
}
