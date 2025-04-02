import { useState, useEffect } from 'react'

export function MathSumDiff20() {
  const [answer, setAnswer] = useState('')
  const [question, setQuestion] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [rightAnswer, setRightAnswer] = useState<number>()
  const [count, setCount] = useState<number>(0)
  const [wrongCount, setWrongCount] = useState<number>(0)

  useEffect(() => {
    createQuestion()
  }, [])

  const onKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onAnswer()
    }
    if (e.key === 'Backspace') {
      return
    }
    if (!/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  }

  const onAnswer = () => {
    if (!answer) {
      return
    }
    let yourAnswer = Number(answer)
    if (rightAnswer == yourAnswer) {
      setMessage('Правильно! ' + question + '=' + rightAnswer)
      createQuestion()
      setCount(count + 1)
    } else {
      console.log(yourAnswer, rightAnswer)
      setMessage('Неправильно! ' + yourAnswer + ' — это неверный ответ!')
      setWrongCount(wrongCount + 1)
    }
    setAnswer('')
  }

  const createQuestion = () => {
    const firstDigit = Math.floor(Math.random() * 10) + 1;
    const secondDigit = Math.floor(Math.random() * 10) + 1;
    const sumDigit = firstDigit + secondDigit
    if (Math.random() > 0.5) {
      setRightAnswer(sumDigit)
      setQuestion(firstDigit + "+" + secondDigit)
    } else {
      if (Math.random() > 0.5) {
        setRightAnswer(firstDigit)
        setQuestion(sumDigit + "-" + secondDigit)
      } else {
        setRightAnswer(secondDigit)
        setQuestion(sumDigit + "-" + firstDigit)
      }
    }
  }

  return (
    <>
      <div className="card">
        <p>{question}=
          <input type="text" value={answer} onKeyDown={onKeyPress} onChange={(e) => setAnswer(e.target.value)} />
          <button type="button" onClick={onAnswer}>Ответить</button></p>
        <p>{message}</p>
        <p>Правильных ответов: {count}</p>
        <p>Неверных ответов: {wrongCount}</p>
      </div>
    </>
  )
}
