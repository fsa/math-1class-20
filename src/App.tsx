import { useEffect, useState } from 'react'
import { Trainer } from './Trainer.tsx'
import { generateMultiplyDivide, generateSumDiff } from './questions.ts'
import { STORAGE_KEY_MULTIPLY, STORAGE_KEY_SUM } from './storage.ts'

type TabId = 'sum' | 'multiply'

const tabFromHash = (): TabId => (window.location.hash === '#multiply' ? 'multiply' : 'sum')

const TABS: { id: TabId; label: string }[] = [
  { id: 'sum', label: 'Сложение и вычитание' },
  { id: 'multiply', label: 'Умножение и деление' },
]

export function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash)

  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const selectTab = (next: TabId) => {
    setTab(next)
    history.replaceState(null, '', `#${next}`)
  }

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Режим">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className="tab"
            onClick={() => selectTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="panel-sum"
        aria-labelledby="tab-sum"
        hidden={tab !== 'sum'}
        className="tab-panel"
      >
        <Trainer storageKey={STORAGE_KEY_SUM} generate={generateSumDiff} />
      </div>

      <div
        role="tabpanel"
        id="panel-multiply"
        aria-labelledby="tab-multiply"
        hidden={tab !== 'multiply'}
        className="tab-panel"
      >
        <Trainer storageKey={STORAGE_KEY_MULTIPLY} generate={generateMultiplyDivide} />
      </div>
    </>
  )
}
