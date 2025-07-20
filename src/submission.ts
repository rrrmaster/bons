import { Page } from 'playwright'
import { groupBy } from './util.js'

export const scopeSubmissionList = (submission: Submission[], scope: Scope): Submission[] => {
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

export async function getSubmission(submissionId: number, page: Page): Promise<SubmissionDetail> {
  await page.goto(`https://www.acmicpc.net/source/${submissionId}`)

  const id = await page.locator("div[class*='content'] table tbody tr td:nth-child(1)").textContent()

  const problemId = await page.locator("div[class*='content'] table tbody tr td:nth-child(3)").textContent()

  const problemTitle = await page.locator("div[class*='content'] table tbody tr td:nth-child(4)").textContent()

  const memoryUsaged = parseInt(
    await page.locator("div[class*='content'] table tbody tr td:nth-child(6)").textContent()
  )

  const cpuTimeUsaged = parseInt(
    await page.locator("div[class*='content'] table tbody tr td:nth-child(7)").textContent()
  )

  const displayLanguageName = await page.locator("div[class*='content'] table tbody tr td:nth-child(8)").textContent()
  const languageID = parseInt((await page.locator('input[id="language"]').getAttribute('value')) ?? '')

  const codeLength = Number(await page.locator("div[class*='content'] table tbody tr td:nth-child(9)").textContent())

  const code = await page.locator('textarea[name="source"]').textContent()
  return {
    id,
    code,
    problemId,
    problemTitle,
    cpuTimeUsaged,
    memoryUsaged,
    languageID,
    codeLength,
    displayLanguageName,
  }
}
export const getSubmissionList = async (page: Page): Promise<Submission[]> => {
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
/*
 * https://help.acmicpc.net/language/info 참고
 */
export const getSubmissionExtension = (languageID: number): string => {
  switch (languageID) {
    case 0: // 0 -> C99
      return 'c'
    case 114: // 114 -> C++ 23
    case 95: // 95 -> C++ 20
    case 85: // 85 -> C++ 17(Clang)
    case 84: // 84 -> C++ 17
    case 88: // 88 -> C++ 14
    case 49: // 49 -> C++ 11
      return 'cpp'
    case 86:
      return 'cs'
    case 93: // 93 -> Java 11
      return 'java'
    case 6: // 6 -> Python2
    case 28: // 28 -> Python3
    case 32: // 32 -> PyPy2
    case 73: // 73 -> PyPy3
      return 'py'
    case 68: // 68 -> Ruby
      return 'rb'
    case 69:
      return 'kt'
    case 74:
      return 'swift'
    case 17:
      return 'js'
    case 12:
      return 'go'
  }
  return 'txt'
}
