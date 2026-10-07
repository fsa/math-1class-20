export type HistoryEntry = {
  text: string
  given: number
  correct: number
  ok: boolean
  ts: number
}

export type Progress = {
  count: number
  wrongCount: number
  history: HistoryEntry[]
}

const STORAGE_KEY = 'math1class20:progress:v1'
export const MAX_HISTORY = 50

export function emptyProgress(): Progress {
  return { count: 0, wrongCount: 0, history: [] }
}

const clampInt = (value: unknown): number => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

const isHistoryEntry = (value: unknown): value is HistoryEntry => {
  if (!value || typeof value !== 'object') return false
  const e = value as Partial<HistoryEntry>
  return (
    typeof e.text === 'string' &&
    typeof e.given === 'number' &&
    typeof e.correct === 'number' &&
    typeof e.ok === 'boolean' &&
    typeof e.ts === 'number'
  )
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyProgress()
    const data = JSON.parse(raw) as Partial<Progress>
    if (!data || typeof data !== 'object') return emptyProgress()
    return {
      count: clampInt(data.count),
      wrongCount: clampInt(data.wrongCount),
      history: Array.isArray(data.history)
        ? data.history.filter(isHistoryEntry).slice(0, MAX_HISTORY)
        : [],
    }
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // приватный режим или переполненное хранилище — работаем без сохранения
  }
}
