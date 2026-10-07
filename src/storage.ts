import type { Question } from './questions.ts'

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
  current?: Question
}

export const STORAGE_KEY_SUM = 'math1class20:progress:v1'
export const STORAGE_KEY_MULTIPLY = 'math1class20:multiply:v1'
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

const isQuestion = (value: unknown): value is Question => {
  if (!value || typeof value !== 'object') return false
  const q = value as Partial<Question>
  return typeof q.text === 'string' && typeof q.answer === 'number' && Number.isFinite(q.answer)
}

export function loadProgress(key: string): Progress {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return emptyProgress()
    const data = JSON.parse(raw) as Partial<Progress>
    if (!data || typeof data !== 'object') return emptyProgress()
    return {
      count: clampInt(data.count),
      wrongCount: clampInt(data.wrongCount),
      history: Array.isArray(data.history)
        ? data.history.filter(isHistoryEntry).slice(0, MAX_HISTORY)
        : [],
      current: isQuestion(data.current) ? data.current : undefined,
    }
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(key: string, progress: Progress): void {
  try {
    localStorage.setItem(key, JSON.stringify(progress))
  } catch {
    // приватный режим или переполненное хранилище — работаем без сохранения
  }
}
