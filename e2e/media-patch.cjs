const patchMatchMedia = (page, touch) =>
  page.evaluateOnNewDocument((touch) => {
    const orig = window.matchMedia.bind(window)
    window.matchMedia = (query) => {
      const mql = orig(query)
      if (typeof query === 'string' && query.includes('pointer: coarse')) {
        return {
          matches: touch,
          media: mql.media,
          onchange: null,
          addEventListener: (type, h) => mql.addEventListener(type, h),
          removeEventListener: (type, h) => mql.removeEventListener(type, h),
          addListener: (h) => mql.addListener(h),
          removeListener: (h) => mql.removeListener(h),
          dispatchEvent: (e) => mql.dispatchEvent(e),
        }
      }
      return mql
    }
  }, touch)

module.exports = { patchMatchMedia }
