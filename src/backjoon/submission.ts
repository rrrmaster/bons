import { Page } from 'playwright'
import { groupBy } from '../util.js'
import { solve } from 'recaptcha-solver'
import chalk from 'chalk'

export async function login(page: Page, username: string, password: string) {
  try {
    console.log('website login page load')

    await page.goto('https://www.acmicpc.net/login?next=%2F', { waitUntil: 'load' })

    await page.locator('input[name="login_user_id"]').pressSequentially(username, { delay: 20 })
    await page.locator('input[name="login_password"]').pressSequentially(password, { delay: 20 })

    await page.waitForTimeout(2500.0)
    await page.locator('button[id="submit_button"]').click()
    await page.waitForTimeout(2500.0)

    if ((await page.locator('form p[class="color-red"]').count()) > 0) {
      console.error('username or password invalid')
      throw new Error('Invalid username or password')
    }

    if ((await page.locator("iframe[src*='recaptcha']").count()) > 0) {
      await solve(page)
    }

    await page.waitForURL('https://www.acmicpc.net/', { timeout: 5000 })

    console.log('login success')
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error('Network timeout during login')
    }
    throw new Error(`Unexpected login error: ${err.message}`)
  }
}

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
  const id = await page.locator("//table[.//th[contains(normalize-space(), '제출 번호')]]/tbody/tr/td[position()=1]").textContent()
  const problemId = await page.locator("//table[.//th[contains(normalize-space(), '제출 번호')]]/tbody/tr/td[position()=3]").textContent()
  const problemTitle = await page.locator("//table[.//th[contains(normalize-space(), '제출 번호')]]/tbody/tr/td[position()=4]").textContent()

  const memoryUsaged = parseInt(await page.locator("//table[.//th[contains(normalize-space(), '제출 번호')]]/tbody/tr/td[position()=6]").textContent())

  const cpuTimeUsaged = parseInt(await page.locator("//table[.//th[contains(normalize-space(), '제출 번호')]]/tbody/tr/td[position()=7]").textContent())

  const displayLanguageName = await page.locator("//table[.//th[contains(normalize-space(), '제출 번호')]]/tbody/tr/td[position()=8]").textContent()
  const languageID = parseInt((await page.locator('input[id="language"]').getAttribute('value')) ?? '')

  const codeLength = Number(await page.locator("//table[.//th[contains(normalize-space(), '제출 번호')]]/tbody/tr/td[position()=9]").textContent())

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
  let pageNumber = 1 // 페이지 번호를 추적하기 위한 변수

  while (true) {
    // console.log(`➡️ 현재 ${pageNumber}번째 페이지의 제출 목록을 가져오는 중...`)

    const submissionElements = await page.locator("table[id='status-table'] tbody tr").all()

    for (const element of submissionElements) {
      const submissionIDText = await element.locator('td:nth-child(1)').textContent()
      const problemIdText = await element.locator('td:nth-child(3)').textContent()
      const status = await element.locator("td:nth-child(4) span[class*='result-text']").getAttribute('data-color')

      const submissionID = Number(submissionIDText)
      const problemId = Number(problemIdText)

      if (isNaN(submissionID)) {
        // console.warn(`⚠️ 경고: 제출 ID가 숫자가 아닙니다. (${submissionIDText}) - 건너뜁니다.`)
        continue
      }
      if (isNaN(problemId)) {
        // console.warn(`⚠️ 경고: 문제 ID가 숫자가 아닙니다. (${problemIdText}) - 건너뜁니다.`)
        continue
      }

      const upperCaseStatus = status?.toUpperCase() as SubmissionStatus
      const validStatuses: SubmissionStatus[] = ['AC', 'WA', 'PE', 'TLE', 'MLE', 'OLE', 'RTE', 'CE']
      if (!validStatuses.includes(upperCaseStatus)) {
        // console.log(`ℹ️ 상태가 유효하지 않아 (${status}) 건너뜁니다.`)
        continue
      }

      submissions.push({
        id: submissionID,
        status: upperCaseStatus,
        problemId: problemId,
      })
    }

    const nextButton = page.locator("a[id='next_page']")
    const isNextVisible = await nextButton.isVisible()

    if (!isNextVisible) {
      console.log(chalk.blueBright.bold(`Pagination Finish!`))

      break
    }

    pageNumber++
    console.log(chalk.blueBright.bold(`Move Next Page ${pageNumber - 1} -> ${pageNumber} (Submission Count : ${submissionElements.length})`))
    await nextButton.click()

    await page.waitForLoadState('networkidle')
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
