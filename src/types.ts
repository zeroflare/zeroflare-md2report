export interface CoverMeta {
  title: string
  subtitle: string
  company: string
  date: string
}

export interface TocEntry {
  id: string
  text: string
  level: 1 | 2 | 3
}
