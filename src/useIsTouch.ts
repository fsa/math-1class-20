import { useEffect, useState } from 'react'

const TOUCH_QUERY = '(hover: none) and (pointer: coarse)'

export function useIsTouch() {
  const [isTouch, setIsTouch] = useState(() => matchMedia(TOUCH_QUERY).matches)

  useEffect(() => {
    const mql = matchMedia(TOUCH_QUERY)
    const onChange = () => setIsTouch(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isTouch
}
