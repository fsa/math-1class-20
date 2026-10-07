const puppeteer = require('puppeteer-core')
const { patchMatchMedia } = require('./media-patch.cjs')

const URL = process.env.E2E_URL ?? 'http://localhost:4173/math-1class-20'
const devices = [
  { name: 'iphone-se-320', width: 320, height: 568 },
  { name: 'android-360', width: 360, height: 740 },
  { name: 'tablet-768', width: 768, height: 1024 },
]

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--hide-scrollbars'],
  })
  let fail = 0
  const check = (label, cond, extra = '') => {
    if (!cond) fail++
    console.log(`${cond ? 'OK  ' : 'FAIL'} ${label} ${extra}`)
  }

  for (const scheme of ['light', 'dark']) {
    for (const d of devices) {
      const page = await browser.newPage()
      await patchMatchMedia(page, false)
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])
      await page.setViewport({ width: d.width, height: d.height, deviceScaleFactor: 2, isMobile: true, hasTouch: false })
      await page.goto(URL, { waitUntil: 'networkidle0' })
      await page.evaluate(() => localStorage.clear())
      await page.reload({ waitUntil: 'networkidle0' })
      const tag = `${d.name}/${scheme}`

      // 1. нет горизонтального скролла
      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      check(`${tag} no horizontal scroll`, !overflowX)

      // 2. карточка отцентрирована по горизонтали
      const geo = await page.evaluate(() => {
        const c = document.querySelector('.card').getBoundingClientRect()
        const q = document.querySelector('.question').getBoundingClientRect()
        const t = document.querySelector('.tabs').getBoundingClientRect()
        const rootStyle = getComputedStyle(document.querySelector('#root'))
        const input = document.querySelector('input').getBoundingClientRect()
        const btn = document.querySelector('button').getBoundingClientRect()
        const st = getComputedStyle(document.querySelector('button'))
        const si = getComputedStyle(document.querySelector('input'))
        const root = getComputedStyle(document.querySelector('#root'))
        return {
          cardCenter: c.left + c.width / 2,
          cardTop: Math.round(c.top),
          cardBottom: Math.round(c.bottom),
          tabsTop: Math.round(t.top),
          padTop: parseFloat(rootStyle.paddingTop),
          padBottom: parseFloat(rootStyle.paddingBottom),
          vw: innerWidth,
          vh: innerHeight,
          questionFont: parseFloat(getComputedStyle(document.querySelector('.question')).fontSize),
          questionRight: Math.round(q.right),
          qBottom: Math.round(q.bottom),
          inputTop: Math.round(input.top),
          inputH: Math.round(input.height),
          btnH: Math.round(btn.height),
          btnBg: st.backgroundColor,
          inputBg: si.backgroundColor,
          inputBorder: si.borderColor,
          rootFontSize: parseFloat(root.fontSize),
        }
      })
      check(`${tag} card centered X`, Math.abs(geo.cardCenter - geo.vw / 2) < 2, `center=${geo.cardCenter} vw=${geo.vw}`)
      check(
        `${tag} content centered Y`,
        Math.abs(geo.tabsTop - geo.padTop - (geo.vh - geo.padBottom - geo.cardBottom)) < 4,
        `top=${geo.tabsTop} bottomGap=${geo.vh - geo.padBottom - geo.cardBottom}`,
      )
      check(`${tag} question fits width`, geo.questionRight <= geo.vw, `right=${geo.questionRight}`)
      check(`${tag} input on same line as question`, geo.inputTop < geo.qBottom, `inputTop=${geo.inputTop} qBottom=${geo.qBottom}`)
      check(`${tag} tap targets >= 44px`, geo.inputH >= 44 && geo.btnH >= 44, `input=${geo.inputH} btn=${geo.btnH}`)

      // 3. ввод: фильтрация не-цифр и maxLength
      await page.click('input')
      await page.type('input', 'a1b2c3')
      const val = await page.$eval('input', (el) => el.value)
      check(`${tag} digits only, max 2`, val === '12', `value="${val}"`)

      // 4. неверный ответ: сообщение не ломает вёрстку
      const correct = await page.$eval('.question', (el) => el.textContent)
      await page.click('input')
      await page.keyboard.down('Control')
      await page.keyboard.press('KeyA')
      await page.keyboard.up('Control')
      await page.keyboard.press('Backspace')
      const cleared = await page.$eval('input', (el) => el.value)
      check(`${tag} field cleared after select-all+backspace`, cleared === '', `"${cleared}"`)
      await page.type('input', '99')
      await page.click('button[type=submit]')
      const msg = await page.evaluate(() => {
        const m = document.querySelector('.message')
        const r = m.getBoundingClientRect()
        return {
          text: m.textContent,
          right: Math.round(r.right),
          vh: innerHeight,
          scrollH: document.documentElement.scrollHeight,
          color: getComputedStyle(m).color,
        }
      })
      check(`${tag} wrong-answer message shown`, msg.text.includes('Неправильно'), `"${msg.text}"`)
      check(`${tag} message within viewport`, msg.right <= geo.vw && msg.scrollH <= geo.vh, `right=${msg.right} scrollH=${msg.scrollH}`)

      // 5. после ответа фокус остаётся в поле ввода, поле очищено
      const state = await page.evaluate(() => ({
        focused: document.activeElement === document.querySelector('input'),
        cleared: document.querySelector('input').value === '',
        stats: document.querySelector('.stats').textContent,
      }))
      check(`${tag} focus kept in input + cleared`, state.focused && state.cleared, JSON.stringify(state.stats))

      // 6. верный ответ
      const q2 = await page.$eval('.question', (el) => el.textContent)
      const m = q2.match(/^(\d+)([+-])(\d+)=?$/)
      const ans = m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3])
      await page.type('input', String(ans))
      await page.click('button[type=submit]')
      const after = await page.evaluate(() => ({
        msg: document.querySelector('.message').textContent,
        color: getComputedStyle(document.querySelector('.message')).color,
        stats: document.querySelector('.stats').textContent,
        newQ: document.querySelector('.question').textContent,
      }))
      check(`${tag} correct answer accepted`, after.msg.startsWith('Правильно') && after.stats.includes('Правильных ответов: 1'), JSON.stringify(after.stats))
      check(`${tag} new question generated`, after.newQ !== q2, `${q2} -> ${after.newQ}`)

      await page.close()
    }
  }
  await browser.close()
  console.log(fail === 0 ? '\nALL PASSED' : `\nFAILURES: ${fail}`)
  process.exit(fail ? 1 : 0)
})()
