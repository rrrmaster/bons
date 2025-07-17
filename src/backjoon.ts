import { chromium, devices, Page } from 'playwright'
import { solve, exists } from 'recaptcha-solver'
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { getSubmission, getSubmissionExtension, scopeSubmissionList } from './submission.js'
import path from 'path'

function parseTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\[([^\]]+)\]/g, (_, key) => values[key] || '')
}

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
  const browser = await chromium.launch({
    headless: false,
    channel: 'chromium',
  })
  const context = await browser.newContext(devices['Desktop Chrome'])
  const page = await context.newPage()
  console.log('Desktop Chrome browser open')
  console.log('website login page load')

  await page.goto('https://www.acmicpc.net/login?next=%2F', {
    waitUntil: 'load',
  })

  await page.locator('input[name="login_user_id"]').pressSequentially(username, { delay: 20 })
  await page.locator('input[name="login_password"]').pressSequentially(password, { delay: 20 })

  await page.waitForTimeout(2500.0)
  await page.locator('button[id="submit_button"]').click()
  if (await exists(page)) await solve(page)
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

  for (let i = 0; i < scopingSub.length; i++) {
    const submission = scopingSub[i]
    await page.goto(`https://www.acmicpc.net/source/${submission.id}`)
    const submissionDetail = await getSubmission(page)
    console.log(`submission success : ${submission.id} [${i + 1}/${scopingSub.length}]`)

    const ext = getSubmissionExtension(submissionDetail.languageID)
    const outputPath = parseTemplate(output, {
      username: username,
      ext: ext,
      problem_id: submission.problemId.toString(),
      submission_id: submission.id.toString(),
    })

    const basePath = path.dirname(outputPath)
    console.log(basePath)
    if (!existsSync(basePath)) {
      mkdirSync(basePath, { recursive: true })
    }

    writeFileSync(outputPath, submissionDetail.code)

    await page.waitForTimeout(1000.0)
  }
  await context.close()
  await browser.close()
}

const getSubmissionList = async (page: Page): Promise<Submission[]> => {
  const submissions: Submission[] = []
  while (true) {
    const submissionElements = await page.locator("table[id='status-table'] tbody tr").all()
    for (const element of submissionElements) {
      const submissionID = await element.locator('td:nth-child(1)').textContent()
      const problemId = await element.locator('td:nth-child(3)').textContent()
      const status = await element.locator("td:nth-child(4) span[class*='result-text']").getAttribute('data-color')
      if (isNaN(Number(submissionID))) {
        console.warn('submission id is not number')
        continue
      }
      if (isNaN(Number(problemId))) {
        console.warn('problem id is not number')
        continue
      }
      if (!['AC', 'WA', 'PE', 'TLE', 'MLE', 'OLE', 'RTE', 'CE'].includes(status.toUpperCase())) {
        continue
      }
      submissions.push({
        id: Number(submissionID),
        status: status.toUpperCase() as SubmissionStatus,
        problemId: Number(problemId),
      })
    }

    console.log(`submission element count : ${submissions.length}`)

    const isNextVisible = await page.locator("a[id='next_page']").isVisible()
    if (!isNextVisible) {
      break
    }

    page.waitForTimeout(1000.0)
    const href = await page.locator("a[id='next_page']").getAttribute('href')
    await page.locator("a[id='next_page']").click()
    await page.waitForURL('https://www.acmicpc.net' + href)
  }
  return submissions
}
