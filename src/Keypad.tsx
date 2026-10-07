type KeypadProps = {
  onDigit: (digit: string) => void
  onBackspace: () => void
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function Keypad({ onDigit, onBackspace }: KeypadProps) {
  return (
    <div className="keypad">
      <div className="keypad-grid">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            className="keypad-key"
            aria-label={d}
            onClick={() => onDigit(d)}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className="keypad-key keypad-key-zero"
          aria-label="0"
          onClick={() => onDigit('0')}
        >
          0
        </button>
        <button
          type="button"
          className="keypad-key keypad-backspace"
          aria-label="Стереть"
          onClick={onBackspace}
        >
          ⌫
        </button>
      </div>
      <button type="submit" className="keypad-submit" aria-label="Ответить">
        ✓
      </button>
    </div>
  )
}
