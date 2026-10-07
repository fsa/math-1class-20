export type Question = {
  text: string
  answer: number
}

const MAX_SUM = 20

export function generateSumDiff(): Question {
  if (Math.random() > 0.5) {
    const a = 1 + Math.floor(Math.random() * (MAX_SUM - 1))
    const b = 1 + Math.floor(Math.random() * (MAX_SUM - a))
    return { text: `${a}+${b}`, answer: a + b }
  }
  const minuend = 2 + Math.floor(Math.random() * (MAX_SUM - 1))
  const subtrahend = 1 + Math.floor(Math.random() * (minuend - 1))
  return { text: `${minuend}-${subtrahend}`, answer: minuend - subtrahend }
}

const MAX_FACTOR = 9

export function generateMultiply(): Question {
  const a = 1 + Math.floor(Math.random() * MAX_FACTOR)
  const b = 1 + Math.floor(Math.random() * MAX_FACTOR)
  return { text: `${a}×${b}`, answer: a * b }
}
