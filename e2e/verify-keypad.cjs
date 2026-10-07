const puppeteer = require('puppeteer-core')
const { patchMatchMedia } = require('./media-patch.cjs')

const URL = process.env.E2E_URL ?? 'http://localhost:4173/math-1class-20'
const P = '#panel-sum '
let fail = 0
const check = (label, cond, extra = '') => {
  if (!cond) fail++
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label} ${extra}`)
}

const answerFromText = (q) => {
  const m = q.match(/^(\d+)([+·:-])(\d+)=?$/)
  const a = Number(m[1])
  const b = Number(m[3])
  if (m[2] === '+') return a + b
  if (m[2] === '·') return a * b
  if (m[2] === ':') return a / b
  return a - b
}

const kpSel = (panel, inner) => `${panel} .keypad ${inner}`
const pressDigit = (page, panel, d) => page.click(kpSel(panel, `button[aria-label="${d}"]`))
const pressBackspace = (page, panel) => page.click(kpSel(panel, 'button[aria-label="Стереть"]'))
const pressSubmit = (page, panel) => page.click(kpSel(panel, '.keypad-submit'))
const typeAnswer = async (page, panel, value) => {
  for (const d of String(value)) await pressDigit(page, panel, d)
}

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--hide-scrollbars'],
  })

  // --- тач-режим ---
  const page = await browser.newPage()
  await patchMatchMedia(page, true)
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await page.setViewport({ width: 360, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.goto(URL, { waitUntil: 'networkidle0' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle0' })

  const inp = await page.evaluate(() => {
    const i = document.querySelector('#panel-sum input')
    return {
      readOnly: i.readOnly,
      inputMode: i.getAttribute('inputmode'),
      vkb: i.getAttribute('virtualkeyboardpolicy'),
    }
  })
  check('touch: input readOnly', inp.readOnly === true, JSON.stringify(inp))
  check('touch: inputMode=none', inp.inputMode === 'none', String(inp.inputMode))
  check('touch: virtualkeyboardpolicy=manual', inp.vkb === 'manual', String(inp.vkb))

  const kpState = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.keypad')]
    const visible = all.filter((k) => k.getBoundingClientRect().height > 0)
    const rowBtn = document.querySelector('#panel-sum .answer-row button[type=submit]')
    const submit = document.querySelector('#panel-sum .keypad .keypad-submit')
    return {
      total: all.length,
      visible: visible.length,
      rowSubmitHidden: getComputedStyle(rowBtn).display === 'none',
      submitVisible: submit.getBoundingClientRect().height > 0,
      submitText: submit.textContent.trim(),
      submitLabel: submit.getAttribute('aria-label'),
      keys: visible[0] ? visible[0].querySelectorAll('button').length : 0,
    }
  })
  check('two keypads in DOM', kpState.total === 2, `total=${kpState.total}`)
  check('exactly one keypad visible', kpState.visible === 1, `visible=${kpState.visible}`)
  check('answer-row submit hidden on touch', kpState.rowSubmitHidden)
  check('keypad Ответить visible', kpState.submitVisible)
  check('keypad submit is ✓ with aria-label', kpState.submitText === '✓' && kpState.submitLabel === 'Ответить', JSON.stringify(kpState))
  check('keypad has 12 buttons', kpState.keys === 12, `keys=${kpState.keys}`)

  const geo = await page.evaluate(() => {
    const q = document.querySelector('#panel-sum .question').getBoundingClientRect()
    const i = document.querySelector('#panel-sum input').getBoundingClientRect()
    const k = document.querySelector('#panel-sum .keypad').getBoundingClientRect()
    return {
      scrollY: window.scrollY,
      qTop: Math.round(q.top),
      qBottom: Math.round(q.bottom),
      iTop: Math.round(i.top),
      iBottom: Math.round(i.bottom),
      kTop: Math.round(k.top),
      kBottom: Math.round(k.bottom),
      kLeft: Math.round(k.left),
      kRight: Math.round(k.right),
      vh: innerHeight,
      vw: innerWidth,
      hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })
  check('starts at scroll top', geo.scrollY === 0, `scrollY=${geo.scrollY}`)
  check('no horizontal scroll', !geo.hOverflow, JSON.stringify(geo))
  check('question visible above keypad', geo.qTop >= 0 && geo.qBottom <= geo.kTop, JSON.stringify(geo))
  check('touch: input on same line as question', geo.iTop < geo.qBottom, `iTop=${geo.iTop} qBottom=${geo.qBottom}`)
  check('input above keypad', geo.iBottom <= geo.kTop, `iBottom=${geo.iBottom} kTop=${geo.kTop}`)
  check('keypad flush to viewport bottom', Math.abs(geo.kBottom - geo.vh) <= 1, `kBottom=${geo.kBottom} vh=${geo.vh}`)
  check('keypad within viewport width', geo.kLeft >= 0 && geo.kRight <= geo.vw, `left=${geo.kLeft} right=${geo.kRight} vw=${geo.vw}`)

  await pressDigit(page, '#panel-sum', '1')
  await pressDigit(page, '#panel-sum', '2')
  let val = await page.$eval(P + 'input', (i) => i.value)
  check('digits enter field', val === '12', `value="${val}"`)
  await pressDigit(page, '#panel-sum', '5')
  val = await page.$eval(P + 'input', (i) => i.value)
  check('third digit ignored', val === '12', `value="${val}"`)
  await pressBackspace(page, '#panel-sum')
  val = await page.$eval(P + 'input', (i) => i.value)
  check('backspace removes one digit', val === '1', `value="${val}"`)
  await pressBackspace(page, '#panel-sum')
  await pressBackspace(page, '#panel-sum')
  val = await page.$eval(P + 'input', (i) => i.value)
  check('backspace on empty is safe', val === '', `value="${val}"`)

  const q1 = await page.$eval(P + '.question', (e) => e.textContent)
  await typeAnswer(page, '#panel-sum', answerFromText(q1))
  await pressSubmit(page, '#panel-sum')
  const afterOk = await page.evaluate(() => ({
    msg: document.querySelector('#panel-sum .message').textContent,
    stats: document.querySelector('#panel-sum .stats').textContent,
    hist: document.querySelector('#panel-sum .history summary').textContent,
    inputVal: document.querySelector('#panel-sum input').value,
    activeIsInput: document.activeElement === document.querySelector('#panel-sum input'),
  }))
  check(
    'keypad submit: correct answer',
    afterOk.msg.startsWith('Правильно') && afterOk.stats.includes('Правильных ответов: 1') && afterOk.hist === 'История (1)',
    JSON.stringify(afterOk),
  )
  check('field cleared after submit', afterOk.inputVal === '', `value="${afterOk.inputVal}"`)
  check('no focus steal on touch', !afterOk.activeIsInput)

  await typeAnswer(page, '#panel-sum', 99)
  await pressSubmit(page, '#panel-sum')
  const afterBad = await page.evaluate(() => ({
    msg: document.querySelector('#panel-sum .message').textContent,
    stats: document.querySelector('#panel-sum .stats').textContent,
    strike: (() => {
      const w = document.querySelector('#panel-sum .history-wrong')
      return w ? getComputedStyle(w).textDecorationLine : null
    })(),
  }))
  check(
    'keypad submit: wrong answer recorded',
    afterBad.msg.includes('Неправильно') && afterBad.stats.includes('Неверных ответов: 1') && afterBad.strike === 'line-through',
    JSON.stringify(afterBad),
  )

  const endGeo = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight)
    const hist = document.querySelector('#panel-sum .history summary').getBoundingClientRect()
    const msg = document.querySelector('#panel-sum .message').getBoundingClientRect()
    const k = document.querySelector('#panel-sum .keypad').getBoundingClientRect()
    return { histBottom: Math.round(hist.bottom), msgBottom: Math.round(msg.bottom), kTop: Math.round(k.top) }
  })
  check(
    'content stays above keypad at scroll end',
    endGeo.histBottom <= endGeo.kTop && endGeo.msgBottom <= endGeo.kTop,
    JSON.stringify(endGeo),
  )
  await page.evaluate(() => window.scrollTo(0, 0))

  await page.click('#tab-multiply')
  const mul = await page.evaluate(() => ({
    sumKpH: document.querySelector('#panel-sum .keypad').getBoundingClientRect().height,
    mulKpH: document.querySelector('#panel-multiply .keypad').getBoundingClientRect().height,
    mulReadOnly: document.querySelector('#panel-multiply input').readOnly,
  }))
  check('keypad switches with tab', mul.sumKpH === 0 && mul.mulKpH > 0, JSON.stringify(mul))
  check('multiply input readOnly too', mul.mulReadOnly === true)
  const qm = await page.$eval('#panel-multiply .question', (e) => e.textContent)
  await typeAnswer(page, '#panel-multiply', answerFromText(qm))
  await pressSubmit(page, '#panel-multiply')
  const mulStats = await page.$eval('#panel-multiply .stats', (e) => e.textContent)
  check('multiply keypad answer works', mulStats.includes('Правильных ответов: 1'), mulStats)

  // --- десктоп: кейпада нет, ввод обычный ---
  const d = await browser.newPage()
  await patchMatchMedia(d, false)
  await d.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await d.setViewport({ width: 1280, height: 800 })
  await d.goto(URL, { waitUntil: 'networkidle0' })
  await d.evaluate(() => localStorage.clear())
  await d.reload({ waitUntil: 'networkidle0' })

  const desk = await d.evaluate(() => ({
    keypads: document.querySelectorAll('.keypad').length,
    readOnly: document.querySelector('input').readOnly,
    inputMode: document.querySelector('input').getAttribute('inputmode'),
    vkb: document.querySelector('input').getAttribute('virtualkeyboardpolicy'),
    rowSubmit: getComputedStyle(document.querySelector('.answer-row button[type=submit]')).display,
    rowSubmitText: document.querySelector('.answer-row button[type=submit]').textContent.trim(),
    qBottom: Math.round(document.querySelector('.question').getBoundingClientRect().bottom),
    inputTop: Math.round(document.querySelector('input').getBoundingClientRect().top),
    hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }))
  check('desktop: no keypad rendered', desk.keypads === 0, JSON.stringify(desk))
  check('desktop: input editable + numeric', desk.readOnly === false && desk.inputMode === 'numeric', JSON.stringify(desk))
  check('desktop: virtualkeyboardpolicy=auto', desk.vkb === 'auto', String(desk.vkb))
  check('desktop: answer-row submit visible', desk.rowSubmit !== 'none', desk.rowSubmit)
  check('desktop: submit is ✓ symbol', desk.rowSubmitText === '✓', desk.rowSubmitText)
  check('desktop: input on same line as question', desk.inputTop < desk.qBottom && !desk.hOverflow, JSON.stringify(desk))

  await d.click('input')
  const dq = await d.$eval('.question', (e) => e.textContent)
  await d.type('input', String(answerFromText(dq)))
  await d.click('.answer-row button[type=submit]')
  const dStats = await d.$eval('.stats', (e) => e.textContent)
  check('desktop: typing + submit works', dStats.includes('Правильных ответов: 1'), dStats)

  await browser.close()
  console.log(fail === 0 ? '\nALL PASSED' : `\nFAILURES: ${fail}`)
  process.exit(fail ? 1 : 0)
})()
