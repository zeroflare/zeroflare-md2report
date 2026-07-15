import type { CoverMeta } from '../types'

const STORAGE_KEY = 'zeroflare-md2report-draft'

export interface DraftData {
  meta: CoverMeta
  markdown: string
  savedAt: string
}

export function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<DraftData>
    if (!data.meta || typeof data.markdown !== 'string') return null
    if (
      typeof data.meta.title !== 'string' ||
      typeof data.meta.subtitle !== 'string' ||
      typeof data.meta.company !== 'string' ||
      typeof data.meta.date !== 'string'
    ) {
      return null
    }
    return {
      meta: data.meta,
      markdown: data.markdown,
      savedAt: typeof data.savedAt === 'string' ? data.savedAt : '',
    }
  } catch {
    return null
  }
}

export function saveDraft(meta: CoverMeta, markdown: string): DraftData {
  const data: DraftData = {
    meta,
    markdown,
    savedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  return data
}
