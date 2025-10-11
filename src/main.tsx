import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MathSumDiff20 } from './MathSumDiff20.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MathSumDiff20 />
  </StrictMode>,
)
