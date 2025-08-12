import { chromium, devices } from 'playwright'
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { getSubmission, getSubmissionExtension, getSubmissionList, login, scopeSubmissionList } from './submission.js'
import path from 'path'
import { parseTemplate } from '../util.js'
import chalk from 'chalk'

export const run = async (username: string, password: string, option: { output: string; status: SubmissionStatus[]; scope: 'first' | 'last' | 'all' }) => {
  const { output, status, scope } = option
  const browser = await chromium.launch({ headless: true, channel: 'chromium' })
  const context = await browser.newContext(devices['Desktop Chrome'])
  try {
    const page = await context.newPage()
    console.log(chalk.cyan.bold('🚀 Desktop Chrome browser open'))

    await login(page, username, password)

    await page.goto(`https://www.acmicpc.net/status?from_mine=1&user_id=${username}`)

    console.log(chalk.yellow.bold('\n[1] Submission list load start...'))
    const submissions = await getSubmissionList(page)
    console.log(chalk.green(`✔ Total submissions: ${submissions.length}`))
    if (submissions.length == 0) {
      console.log(chalk.yellow(`Submissions Empty`))
      return
    }
    const filterSubmissions = submissions.filter((e) => status.includes(e.status))
    console.log(chalk.yellow.bold(`\n[2] Filter submissions by status:`) + ` ${chalk.dim(submissions.length)} -> ${chalk.bold(filterSubmissions.length)}`)
    const scopingSub = scopeSubmissionList(filterSubmissions, scope)
    console.log(chalk.yellow.bold(`[3] Scope submissions (${scope}):`) + ` ${chalk.dim(filterSubmissions.length)} -> ${chalk.bold(scopingSub.length)}`)
    if (scopingSub.length == 0) {
      console.log(chalk.yellow(`Submissions Empty`))
      return
    }
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
        console.log(chalk.gray(`Created directory: ${basePath}`))
      }

      writeFileSync(outputPath, submissionDetail.code)
      console.log(chalk.green(`Saved submission ${submission.id} (${submission.problemId}) as ${ext}`))

      await page.waitForTimeout(1000.0)
    }
  } finally {
    await context.close()
    await browser.close()
  }
  console.log(chalk.green.bold('\nBackjoon sync success! All submissions saved.'))
}
