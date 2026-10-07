import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  emptyProgress,
  loadProgress,
  saveProgress,
  MAX_HISTORY,
  type HistoryEntry,
  type Progress,
} from './storage.ts'

type Question = {
  text: string
  answer: number
}

const MAX_SUM = 20

function generateQuestion(): Question {
  if (Math.random() > 0.5) {
    const a = 1 + Math.floor(Math.random() * (MAX_SUM - 1))
    const b = 1 + Math.floor(Math.random() * (MAX_SUM - a))
    return { text: `${a}+${b}`, answer: a + b }
  }
  const minuend = 2 + Math.floor(Math.random() * (MAX_SUM - 1))
  const subtrahend = 1 + Math.floor(Math.random() * (minuend - 1))
  return { text: `${minuend}-${subtrahend}`, answer: minuend - subtrahend }
}

export function MathSumDiff20() {
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [current, setCurrent] = useState<Question>(generateQuestion)
  const [answer, setAnswer] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAnswer(e.target.value.replace(/\D/g, '').slice(0, 2))
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

    if (ok) {
      setMessage(`Правильно! ${current.text}=${current.answer}`)
      setCurrent(generateQuestion())
    } else {
      setMessage(`Неправильно! ${given} — это неверный ответ!`)
    }
    setIsCorrect(ok)
    setProgress((p) => ({
      ...p,
      count: p.count + (ok ? 1 : 0),
      wrongCount: p.wrongCount + (ok ? 0 : 1),
      history: [entry, ...p.history].slice(0, MAX_HISTORY),
    }))
    setAnswer('')
    inputRef.current?.focus()
  }

  const messageClass = isCorrect === null ? '' : isCorrect ? 'success-text' : 'error-text'

  const clearHistory = () => {
    setProgress(emptyProgress())
    inputRef.current?.focus()
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <p className="question">{current.text}=</p>
      <div className="answer-row">
        <label htmlFor="answer">Ответ</label>
        <input
          id="answer"
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="?"
          value={answer}
          onChange={onChange}
        />
        <button type="submit">Ответить</button>
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
    </form>
  )
}
