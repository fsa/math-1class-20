const puppeteer = require('puppeteer-core')
const { patchMatchMedia } = require('./media-patch.cjs')

const URL = process.env.E2E_URL ?? 'http://localhost:4173/math-1class-20'
let fail = 0
const check = (label, cond, extra = '') => {
  if (!cond) fail++
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label} ${extra}`)
}

const answerIn = async (page, panel, correct, wrongValue = 99) => {
  const q = await page.$eval(`${panel} .question`, (el) => el.textContent)
  const m = q.match(/^(\d+)([+·:-])(\d+)=?$/)
  const ans = m[2] === '+' ? Number(m[1]) + Number(m[3])
    : m[2] === '·' ? Number(m[1]) * Number(m[3])
    : m[2] === ':' ? Number(m[1]) / Number(m[3])
    : Number(m[1]) - Number(m[3])
  await page.click(`${panel} input`)
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type(`${panel} input`, String(correct ? ans : wrongValue))
  await page.click(`${panel} button[type=submit]`)
  return q
}

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--hide-scrollbars'],
  })
  const page = await browser.newPage()
  await patchMatchMedia(page, false)
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await page.setViewport({ width: 360, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: false })

  await page.goto(URL, { waitUntil: 'networkidle0' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle0' })

  // --- структура вкладок ---
  const tabs = await page.$$eval('[role=tab]', (els) => els.map((e) => ({
    text: e.textContent, selected: e.getAttribute('aria-selected'),
  })))
  check('two tabs present', tabs.length === 2, JSON.stringify(tabs))
  check('sum tab active by default', tabs[0].selected === 'true' && tabs[1].selected === 'false')
  const vis = await page.evaluate(() => ({
    sum: !document.querySelector('#panel-sum').hasAttribute('hidden'),
    mul: !document.querySelector('#panel-multiply').hasAttribute('hidden'),
  }))
  check('only sum panel visible', vis.sum && !vis.mul, JSON.stringify(vis))

  // --- на сложении делаем прогресс ---
  await answerIn(page, '#panel-sum', true)
  await answerIn(page, '#panel-sum', true)

  // --- переходим на таблицу умножения ---
  await page.click('#tab-multiply')
  const afterSwitch = await page.evaluate(() => ({
    sumHidden: document.querySelector('#panel-sum').hasAttribute('hidden'),
    mulVisible: !document.querySelector('#panel-multiply').hasAttribute('hidden'),
    stats: document.querySelector('#panel-multiply .stats').textContent,
    hist: document.querySelector('#panel-multiply .history summary').textContent,
    lsMul: localStorage.getItem('math1class20:multiply:v1') ? 'yes' : 'no',
  }))
  check('switch shows multiply panel', afterSwitch.sumHidden && afterSwitch.mulVisible, JSON.stringify(afterSwitch))
  check('multiply counters start 0', afterSwitch.stats.includes('Правильных ответов: 0'), afterSwitch.stats)
  check('multiply history empty', afterSwitch.hist === 'История (0)', afterSwitch.hist)
  check('multiply storage separate key', afterSwitch.lsMul === 'yes')

  // --- все примеры умножения корректны ---
  let mulOk = true
  for (let i = 0; i < 60; i++) {
    const q = await page.$eval('#panel-multiply .question', (el) => el.textContent)
    const m = q.match(/^(\d+)([·:])(\d+)=?$/)
    let valid = false
    if (m) {
      const x = Number(m[1])
      const y = Number(m[3])
      valid = m[2] === '·'
        ? x <= 9 && y <= 9 && x * y <= 81
        : y >= 1 && y <= 9 && x <= 81 && x % y === 0 && x / y >= 1 && x / y <= 9
    }
    if (!valid) {
      mulOk = false
      console.log('  bad multiply/divide question:', q)
      break
    }
    await answerIn(page, '#panel-multiply', true)
  }
  check('60 multiply/divide questions valid', mulOk)
  check('multiply counters continue (60)', (await page.$eval('#panel-multiply .stats', (e) => e.textContent)).includes('Правильных ответов: 60'))

  // --- неверный ответ в умножении ---
  await answerIn(page, '#panel-multiply', false, 77)
  const mulHist = await page.$$eval('#panel-multiply .history-item', (els) => els.map((e) => e.textContent))
  check('multiply wrong answer recorded', mulHist[0].includes('77') && mulHist[0].includes('✗') && !mulHist[0].includes('верно:'), mulHist[0])
  const mulStrike = await page.evaluate(() => {
    const w = document.querySelector('#panel-multiply .history-wrong')
    return w ? getComputedStyle(w).textDecorationLine : null
  })
  check('multiply wrong struck through', mulStrike === 'line-through', String(mulStrike))

  // --- счётчики независимы: возвращаемся на сложение ---
  await page.click('#tab-sum')
  const backToSum = await page.evaluate(() => ({
    stats: document.querySelector('#panel-sum .stats').textContent,
    hist: document.querySelector('#panel-sum .history summary').textContent,
    sumVisible: !document.querySelector('#panel-sum').hasAttribute('hidden'),
  }))
  check('sum progress preserved on return', backToSum.stats.includes('Правильных ответов: 2') && backToSum.hist === 'История (2)', JSON.stringify(backToSum))

  // --- очистка на умножении не трогает сложение ---
  await page.click('#tab-multiply')
  await page.click('#panel-multiply .history summary')
  await page.click('#panel-multiply .history-clear')
  const afterClear = await page.evaluate(() => ({
    mul: JSON.parse(localStorage.getItem('math1class20:multiply:v1')),
    sum: JSON.parse(localStorage.getItem('math1class20:progress:v1')),
  }))
  check('multiply cleared', afterClear.mul.count === 0 && afterClear.mul.history.length === 0, JSON.stringify(afterClear.mul))
  check('sum untouched by multiply clear', afterClear.sum.count === 2 && afterClear.sum.history.length === 2, JSON.stringify(afterClear.sum))

  // --- сохранение/перезагрузка обеих вкладок ---
  const qBeforeReload = await page.$eval('#panel-multiply .question', (e) => e.textContent)
  await page.reload({ waitUntil: 'networkidle0' })
  const afterReload = await page.evaluate(() => ({
    tab: document.querySelector('[role=tab][aria-selected=true]').id,
    sum: JSON.parse(localStorage.getItem('math1class20:progress:v1')).count,
    mul: JSON.parse(localStorage.getItem('math1class20:multiply:v1')).count,
    q: document.querySelector('#panel-multiply .question').textContent,
  }))
  check('reload keeps current tab (multiply)', afterReload.tab === 'tab-multiply', JSON.stringify(afterReload))
  check('reload keeps both progress', afterReload.sum === 2 && afterReload.mul === 0, JSON.stringify(afterReload))
  check('reload keeps current question', afterReload.q === qBeforeReload, `${qBeforeReload} -> ${afterReload.q}`)

  // --- ввод на умножении: 3 цифры (макс. 81) ---
  await page.click('#tab-multiply')
  await answerIn(page, '#panel-multiply', true)
  const typed = await page.evaluate(() => document.querySelector('#panel-multiply input').value)
  const digitsOk = await page.evaluate(() => {
    const i = document.querySelector('#panel-multiply input')
    i.focus()
    i.value = ''
    i.dispatchEvent(new Event('input', { bubbles: true }))
    return i.maxLength
  })
  check('multiply input accepts up to 2 digits', digitsOk === 2, `maxLength=${digitsOk}`)
  void typed

  // --- нет горизонтального скролла с вкладками ---
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  check('no horizontal scroll with tabs', !overflow)

  // --- дубли id не должны появляться ---
  const dupIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id)
    return ids.filter((id, i) => ids.indexOf(id) !== i)
  })
  check('no duplicate element ids', dupIds.length === 0, JSON.stringify(dupIds))

  // --- режим вкладки в URL (hash) ---
  await page.click('#tab-sum')
  const hashAfterClick = await page.evaluate(() => location.hash)
  check('tab click writes hash', hashAfterClick === '#sum', hashAfterClick)
  await page.goto(URL + '#multiply', { waitUntil: 'networkidle0' })
  const opened = await page.evaluate(() => ({
    tab: document.querySelector('[role=tab][aria-selected=true]').id,
    panelVisible: !document.querySelector('#panel-multiply').hasAttribute('hidden'),
  }))
  check('page opens on #multiply tab', opened.tab === 'tab-multiply' && opened.panelVisible, JSON.stringify(opened))

  await browser.close()
  console.log(fail === 0 ? '\nALL PASSED' : `\nFAILURES: ${fail}`)
  process.exit(fail ? 1 : 0)
})()
