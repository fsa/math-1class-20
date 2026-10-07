const puppeteer = require('puppeteer-core')
const { patchMatchMedia } = require('./media-patch.cjs')

const URL = process.env.E2E_URL ?? 'http://localhost:4173/math-1class-20'
const P = '#panel-sum ' // скоуп на панель сложения
let fail = 0
const check = (label, cond, extra = '') => {
  if (!cond) fail++
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label} ${extra}`)
}

const answerCurrent = async (page, correct) => {
  const q = await page.$eval(P + '.question', (el) => el.textContent)
  const m = q.match(/^(\d+)([+-])(\d+)=?$/)
  const ans = m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3])
  await page.click(P + 'input')
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type(P + 'input', String(correct ? ans : 99))
  await page.click(P + 'button[type=submit]')
  return q
}

const inRange = (q, range) => {
  const m = q.match(/^(\d+)([+-])(\d+)=?$/)
  if (!m) return false
  const [a, op, b] = [Number(m[1]), m[2], Number(m[3])]
  if (a > range || b > range) return false
  if (op === '+' && a + b > range) return false
  if (op === '-' && a - b < 0) return false
  return true
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

  // чистый старт
  await page.goto(URL, { waitUntil: 'networkidle0' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle0' })

  check('clean start: counters 0', (await page.$eval(P + '.stats', (e) => e.textContent)).includes('Правильных ответов: 0'))

  // 2 верных + 1 неверный
  await answerCurrent(page, true)
  await answerCurrent(page, true)
  await answerCurrent(page, false)

  const stats1 = await page.$eval(P + '.stats', (e) => e.textContent)
  check('counters 2/1', stats1.includes('Правильных ответов: 2') && stats1.includes('Неверных ответов: 1'), stats1)
  check('history length 3', (await page.$eval(P + '.history summary', (e) => e.textContent)) === 'История (3)')

  // история: без подсказки верного ответа
  await page.click(P + '.history summary')
  const hist = await page.$$eval(P + '.history-item', (els) => els.map((e) => e.textContent))
  check('history newest first', hist.length === 3 && hist[0].includes('99') && hist[0].includes('✗') && !hist[0].includes('верно:'), hist[0])
  const histOk = await page.$$eval(P + '.history-item', (els) => els.map((e) => e.querySelector('.history-ok, .history-err').className))
  check('history order err,ok,ok', histOk[0].includes('err') && histOk[1].includes('ok') && histOk[2].includes('ok'), histOk.join(','))

  // зачёркивание неверного ответа
  const strike = await page.evaluate(() => {
    const w = document.querySelector('#panel-sum .history-wrong')
    return w ? getComputedStyle(w).textDecorationLine : null
  })
  check('wrong answer struck through', strike === 'line-through', String(strike))

  // перезагрузка: прогресс и текущий пример сохранены, ввод/сообщение сброшены
  await page.type(P + 'input', '7')
  const qBeforeReload = await page.$eval(P + '.question', (e) => e.textContent)
  await page.reload({ waitUntil: 'networkidle0' })
  const after = await page.evaluate(() => {
    const stats = document.querySelector('#panel-sum .stats').textContent
    const hist = document.querySelector('#panel-sum .history summary').textContent
    const input = document.querySelector('#panel-sum input').value
    const msg = document.querySelector('#panel-sum .message').textContent
    return {
      stats, hist, input, msg,
      q: document.querySelector('#panel-sum .question').textContent,
      ls: localStorage.getItem('math1class20:progress:v1') ? 'yes' : 'no',
    }
  })
  check('reload keeps counters', after.stats.includes('Правильных ответов: 2') && after.stats.includes('Неверных ответов: 1'), after.stats)
  check('reload keeps history', after.hist === 'История (3)', after.hist)
  check('reload drops input session', after.input === '' && after.msg === '', JSON.stringify(after))
  check('reload keeps current question', after.q === qBeforeReload, `${qBeforeReload} -> ${after.q}`)
  check('localStorage present', after.ls === 'yes')

  // переключателя диапазона больше нет
  const toggleCount = await page.$$eval('.range-group, [aria-pressed]:not([role=tab])', (els) => els.length)
  check('no range toggle', toggleCount === 0, `found ${toggleCount}`)

  // все примеры в пределах 20
  let ok20 = true
  for (let i = 0; i < 60; i++) {
    const q = await page.$eval(P + '.question', (el) => el.textContent)
    if (!inRange(q, 20)) { ok20 = false; console.log('  out of range:', q); break }
    await answerCurrent(page, true)
  }
  check('60 questions all within 20', ok20)
  check('counters continue (62)', (await page.$eval(P + '.stats', (e) => e.textContent)).includes('Правильных ответов: 62'))

  // кнопка очистки недоступна, пока история закрыта
  const clearHidden = await page.evaluate(() => {
    const d = document.querySelector('#panel-sum .history')
    const r = d.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + 10, r.top + r.height - 10)
    return !hit.classList.contains('history-clear')
  })
  check('clear button hidden while history closed', clearHidden)

  // очистка истории и счётчиков (без диалога)
  await page.click(P + '.history summary')
  const qBeforeClear = await page.$eval(P + '.question', (e) => e.textContent)
  const dialogShown = await page.evaluate(() => {
    let shown = false
    window.confirm = () => { shown = true; return true }
    document.querySelector('#panel-sum .history-clear').click()
    return shown
  })
  check('clear without confirm dialog', !dialogShown)
  const cleared = await page.evaluate(() => ({
    stats: document.querySelector('#panel-sum .stats').textContent,
    hist: document.querySelector('#panel-sum .history summary').textContent,
    empty: !!document.querySelector('#panel-sum .history-empty'),
    q: document.querySelector('#panel-sum .question').textContent,
    ls: JSON.parse(localStorage.getItem('math1class20:progress:v1')),
  }))
  check('clear resets history+counters', cleared.stats.includes('Правильных ответов: 0') && cleared.stats.includes('Неверных ответов: 0') && cleared.hist === 'История (0)' && cleared.empty, JSON.stringify(cleared))
  check('localStorage cleared', cleared.ls.count === 0 && cleared.ls.wrongCount === 0 && cleared.ls.history.length === 0)
  check('clear keeps current question', cleared.q === qBeforeClear, `${qBeforeClear} -> ${cleared.q}`)

  // ввод работает после очистки
  await answerCurrent(page, true)
  check('answers work after clear', (await page.$eval(P + '.stats', (e) => e.textContent)).includes('Правильных ответов: 1'))

  // нет горизонтального скролла с открытой историей
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  check('no horizontal scroll with history open', !overflow)

  await browser.close()
  console.log(fail === 0 ? '\nALL PASSED' : `\nFAILURES: ${fail}`)
  process.exit(fail ? 1 : 0)
})()
