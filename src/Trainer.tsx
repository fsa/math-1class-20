import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  emptyProgress,
  loadProgress,
  saveProgress,
  MAX_HISTORY,
  type HistoryEntry,
  type Progress,
} from './storage.ts'
import type { Question } from './questions.ts'
import { useIsTouch } from './useIsTouch.ts'
import { Keypad } from './Keypad.tsx'

type TrainerProps = {
  storageKey: string
  generate: () => Question
  answerMaxLength?: number
}

export function Trainer({ storageKey, generate, answerMaxLength = 2 }: TrainerProps) {
  const answerId = useId()
  const [progress, setProgress] = useState<Progress & { current: Question }>(() => {
    const p = loadProgress(storageKey)
    return { ...p, current: p.current ?? generate() }
  })
  const current = progress.current
  const [answer, setAnswer] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isTouch = useIsTouch()

  useEffect(() => {
    saveProgress(storageKey, progress)
  }, [storageKey, progress])

  useEffect(() => {
    inputRef.current?.setAttribute('virtualkeyboardpolicy', isTouch ? 'manual' : 'auto')
  }, [isTouch])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAnswer(e.target.value.replace(/\D/g, '').slice(0, answerMaxLength))
  }

  const pressDigit = (digit: string) => {
    setAnswer((prev) => (prev === '0' ? digit : (prev + digit).slice(0, answerMaxLength)))
  }

  const pressBackspace = () => {
    setAnswer((prev) => prev.slice(0, -1))
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!answer) {
      return
    }
    const given = Number(answer)
    const ok = given === current.answer
    const entry: HistoryEntry = {
      text: current.text,
      given,
      correct: current.answer,
      ok,
      ts: Date.now(),
    }

    const next = ok ? generate() : current

    if (ok) {
      setMessage(`Правильно! ${current.text}=${current.answer}`)
    } else {
      setMessage(`Неправильно! ${given} — это неверный ответ!`)
    }
    setIsCorrect(ok)
    setProgress((p) => ({
      ...p,
      count: p.count + (ok ? 1 : 0),
      wrongCount: p.wrongCount + (ok ? 0 : 1),
      history: [entry, ...p.history].slice(0, MAX_HISTORY),
      current: next,
    }))
    setAnswer('')
    if (!isTouch) {
      inputRef.current?.focus()
    }
  }

  const clearHistory = () => {
    setProgress({ ...emptyProgress(), current })
    if (!isTouch) {
      inputRef.current?.focus()
    }
  }

  const messageClass = isCorrect === null ? '' : isCorrect ? 'success-text' : 'error-text'

  return (
    <form className="card" onSubmit={onSubmit}>
      <div className="answer-row">
        <p className="question">{current.text}=</p>
        <label htmlFor={answerId}>Ответ</label>
        <input
          id={answerId}
          ref={inputRef}
          type="text"
          inputMode={isTouch ? 'none' : 'numeric'}
          readOnly={isTouch}
          pattern="[0-9]*"
          maxLength={answerMaxLength}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="?"
          value={answer}
          onChange={onChange}
        />
        <button type="submit" aria-label="Ответить">
          ✓
        </button>
      </div>
      <p className={`message ${messageClass}`} aria-live="polite">
        {message}
      </p>
      <p className="stats">
        <span className="success">Правильных ответов: {progress.count}</span>
        <span className="warning">Неверных ответов: {progress.wrongCount}</span>
      </p>

      <details className="history">
        <summary>История ({progress.history.length})</summary>
        <div className="history-body">
          <button type="button" className="history-clear" onClick={clearHistory}>
            Очистить
          </button>
          {progress.history.length === 0 ? (
            <p className="history-empty">Пока нет ответов</p>
          ) : (
            <ul className="history-list">
              {progress.history.map((entry, i) => (
                <li key={`${entry.ts}-${i}`} className="history-item">
                  <span className="history-q">
                    {entry.text}=
                    <span className={entry.ok ? undefined : 'history-wrong'}>{entry.given}</span>
                  </span>
                  <span className={entry.ok ? 'history-ok' : 'history-err'}>
                    {entry.ok ? '✓' : '✗'}
                  </span>
                  <time className="history-time" dateTime={new Date(entry.ts).toISOString()}>
                    {new Date(entry.ts).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
      {isTouch && <Keypad onDigit={pressDigit} onBackspace={pressBackspace} />}
    </form>
  )
}
