const { spawn, spawnSync } = require('node:child_process')
const path = require('node:path')

const BASE_URL = process.env.E2E_URL ?? 'http://localhost:4173/math-1class-20'
const TESTS = ['smoke.cjs', 'verify-history.cjs', 'verify-tabs.cjs', 'verify-keypad.cjs', 'verify.cjs']

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function isUp() {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

async function waitForServer(timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isUp()) return true
    await wait(300)
  }
  return false
}

async function main() {
  let preview = null
  if (!(await isUp())) {
    console.log('preview is not running, starting...')
    preview = spawn('npm', ['run', 'preview', '--', '--port', '4173', '--strictPort'], {
      stdio: 'ignore',
      detached: true,
      cwd: path.join(__dirname, '..'),
    })
    if (!(await waitForServer(15000))) {
      console.error('preview did not start in time')
      preview.kill('SIGTERM')
      process.exit(1)
    }
  }

  let failed = 0
  for (const file of TESTS) {
    console.log(`\n=== ${file} ===`)
    const res = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' })
    if (res.status !== 0) {
      failed++
      console.log(`--- ${file} FAILED (exit ${res.status})`)
    }
  }

  if (preview) {
    try {
      process.kill(-preview.pid, 'SIGTERM')
    } catch {
      preview.kill('SIGTERM')
    }
  }

  console.log(`\n${failed === 0 ? 'ALL SUITES PASSED' : `${failed} suite(s) FAILED`}`)
  process.exit(failed ? 1 : 0)
}

main()
