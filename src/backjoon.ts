import { chromium, devices, Page } from 'playwright'
import { solve } from 'recaptcha-solver'
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { getSubmission, getSubmissionExtension, getSubmissionList, scopeSubmissionList } from './submission.js'
import cliProgress from 'cli-progress'

import path from 'path'
import { parseTemplate } from './util.js'

export const run = async (
  username: string,
  password: string,
  option: {
    output: string
    status: SubmissionStatus[]
    scope: 'first' | 'last' | 'all'
  }
) => {
  const { output, status, scope } = option
  const browser = await chromium.launch({ headless: false, channel: 'chromium' })
  const context = await browser.newContext(devices['Desktop Chrome'])
  try {
    const page = await context.newPage()
    console.log('Desktop Chrome browser open')
    console.log('website login page load')

    await page.goto('https://www.acmicpc.net/login?next=%2F', { waitUntil: 'load' })

    await page.locator('input[name="login_user_id"]').pressSequentially(username, { delay: 20 })
    await page.locator('input[name="login_password"]').pressSequentially(password, { delay: 20 })

    await page.waitForTimeout(2500.0)
    await page.locator('button[id="submit_button"]').click()
    await page.waitForTimeout(2500.0)

    if ((await page.locator('form p[class="color-red"]').count()) > 0) {
      console.error('username or password invalid')
      return
    }
    if ((await page.locator("iframe[src*='recaptcha']").count()) > 0) {
      await solve(page)
    }
    await page.waitForTimeout(2500.0)
    await page.waitForURL('https://www.acmicpc.net/')

    console.log('login success')
    await page.goto(`https://www.acmicpc.net/status?from_mine=1&user_id=${username}`)

    console.log(`submission list load start`)
    const submissions = await getSubmissionList(page)
    console.log(`total submission count : ${submissions.length}`)

    console.log(`└AC count : ${submissions.filter((e) => e.status == 'AC').length}`)
    console.log(`└fail submission count : ${submissions.filter((e) => e.status != 'AC').length}`)
    console.log(`└─WA count : ${submissions.filter((e) => e.status == 'WA').length}`)
    console.log(`└─TLE(Time Limit Error) count : ${submissions.filter((e) => e.status == 'TLE').length}`)
    console.log(`└─CE(Compile Error) count : ${submissions.filter((e) => e.status == 'CE').length}`)

    const filterSubmissions = submissions.filter((e) => status.includes(e.status))
    console.log(` submission filted : ${submissions.length} -> ${filterSubmissions.length}`)
    const scopingSub = scopeSubmissionList(filterSubmissions, scope)
    console.log(` submission scoping : ${filterSubmissions.length} -> ${scopingSub.length}`)
    const b1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)

    b1.start(scopingSub.length, 0, { speed: 'N/A' })

    for (const submission of scopingSub) {
      const submissionDetail = await getSubmission(submission.id, page)
      const ext = getSubmissionExtension(submissionDetail.languageID)
      const outputPath = parseTemplate(output, {
        username: username,
        ext: ext,
        problem_id: submission.problemId.toString(),
        submission_id: submission.id.toString(),
      })

      const basePath = path.dirname(outputPath)
      if (!existsSync(basePath)) {
        mkdirSync(basePath, { recursive: true })
      }

      writeFileSync(outputPath, submissionDetail.code)

      await page.waitForTimeout(1000.0)
      b1.increment()
    }
    b1.stop()
  } finally {
    await context.close()
    await browser.close()
  }
  console.log('backjoon sync success')
}
