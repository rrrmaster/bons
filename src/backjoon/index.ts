import { chromium, devices, Page } from 'playwright'
import { existsSync } from 'node:fs'
import { getSubmissionById, getSubmissionList, login } from './submission.js'
import path from 'path'
import { groupBy, parseTemplate } from '../util.js'
import chalk from 'chalk'
import pLimit from 'p-limit'
import { mkdir, writeFile } from 'node:fs/promises'
import { logger } from '../config/config.js'

const scopeSubmissionList = (submission: Submission[], scope: Scope): Submission[] => {
  if (scope == 'all') return submission
  else if (scope == 'first') {
    const temp: Submission[] = []
    const result = groupBy(submission, (s: Submission) => s.problemId)
    for (const key of result.keys()) {
      temp.push(result.get(key).sort((a, b) => a.id - b.id)[0])
    }
    return temp
  } else if (scope == 'last') {
    const temp: Submission[] = []
    const result = groupBy(submission, (s: Submission) => s.problemId)
    for (const key of result.keys()) {
      temp.push(result.get(key).sort((a, b) => b.id - a.id)[0])
    }
    return temp
  }
}
const downloadSubmission = async (username: string, output: string, page: Page, submission: Submission) => {
  const submissionDetail = await getSubmissionById(submission.id, page)
  const outputPath = parseTemplate(output, { username: username, ext: submissionDetail.ext, problem_id: submission.problemId.toString(), submission_id: submission.id.toString() })
  const basePath = path.dirname(outputPath)
  if (!existsSync(basePath)) {
    await mkdir(basePath, { recursive: true })
    logger.debug(chalk.gray(`Created directory: ${basePath}`))
  }

  await writeFile(outputPath, submissionDetail.code)
  logger.info(chalk.green(`Saved submission ${submission.id} (${submission.problemId}) as ${submissionDetail.ext}`))
  await new Promise((r) => setTimeout(r, 200))
}
export const run = async (username: string, password: string, option: { output: string; status: SubmissionStatus[]; scope: 'first' | 'last' | 'all' }) => {
  const { output, status, scope } = option
  const browser = await chromium.launch({ headless: false, channel: 'chromium' })
  const context = await browser.newContext(devices['Desktop Chrome'])
  try {
    const page = await context.newPage()
    logger.info(chalk.cyan.bold('🚀 Desktop Chrome browser open'))

    await login(page, username, password)

    logger.info(chalk.yellow.bold('\n[1] Submission list load start...'))
    const submissions = await getSubmissionList(username, page)
    logger.info(chalk.green(`✔ Total submissions: ${submissions.length}`))
    if (submissions.length == 0) {
      logger.info(`Submissions Empty`)
      return
    }
    const filterSubmissions = submissions.filter((e) => status.includes(e.status))
    logger.info(chalk.yellow.bold(`\n[2] Filter submissions by status:`) + ` ${chalk.dim(submissions.length)} -> ${chalk.bold(filterSubmissions.length)}`)
    const scopingSub = scopeSubmissionList(filterSubmissions, scope)
    logger.info(chalk.yellow.bold(`[3] Scope submissions (${scope}):`) + ` ${chalk.dim(filterSubmissions.length)} -> ${chalk.bold(scopingSub.length)}`)
    if (scopingSub.length == 0) {
      logger.info(`Submissions Empty`)
      return
    }
    const limit = pLimit(2)
    const tasks = scopingSub.map((sub) => limit(() => downloadSubmission(username, output, page, sub)))
    const results = await Promise.allSettled(tasks)

    const success = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    logger.info(`✅ ${success} downloads, ❌ ${failed} failed`)
  } finally {
    await context.close()
    await browser.close()
  }
  logger.info('Backjoon sync success! All submissions saved.')
}
