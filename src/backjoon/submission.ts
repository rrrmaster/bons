import { Page } from 'playwright'
import { solve } from 'recaptcha-solver'
import chalk from 'chalk'
import { Element, parseHtml } from 'libxmljs2'
import { logger } from '../config/config'

export async function login(page: Page, username: string, password: string) {
  try {
    logger.info('website login page load')

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

    logger.info('login success')
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error('Network timeout during login')
    }
    throw new Error(`Unexpected login error: ${err.message}`)
  }
}

export async function getSubmissionById(submissionId: number, page: Page): Promise<SubmissionDetail> {
  const response = await page.request.get(`https://www.acmicpc.net/source/${submissionId}`)
  const body = await response.body()
  const doc = parseHtml(body.toString('utf-8'))

  const id = doc.find<Element>("//table[.//th[contains(normalize-space(), '제출 번호')]]/tbody/tr/td[position()=1]")[0].text()
  const problemId = doc.find<Element>("//table[.//th[contains(normalize-space(), '제출 번호')]]/tbody/tr/td[position()=3]")[0].text()
  const problemTitle = doc.find<Element>("//table[.//th[contains(normalize-space(), '제출 번호')]]/tbody/tr/td[position()=4]")[0].text()

  const memoryUsaged = parseInt(doc.find<Element>("//table[.//th[contains(normalize-space(), '제출 번호')]]/tbody/tr/td[position()=6]")[0].text())

  const cpuTimeUsaged = parseInt(doc.find<Element>("//table[.//th[contains(normalize-space(), '제출 번호')]]/tbody/tr/td[position()=7]")[0].text())

  const displayLanguageName = doc.find<Element>("//table[.//th[contains(normalize-space(), '제출 번호')]]/tbody/tr/td[position()=8]")[0].text()
  const languageID = parseInt(doc.find<Element>('//input[@id="language"]')[0].attr('value')!!.value() ?? '')

  const codeLength = Number(doc.find<Element>("//table[.//th[contains(normalize-space(), '제출 번호')]]/tbody/tr/td[position()=9]")[0].text())

  const code = doc.find<Element>('//textarea[@name="source"]')[0].text()
  const ext = getSubmissionExtension(languageID)

  return { id, code, problemId, problemTitle, cpuTimeUsaged, memoryUsaged, languageID, codeLength, displayLanguageName, ext }
}

export const getSubmissionList = async (username: string, page: Page): Promise<Submission[]> => {
  const submissions: Submission[] = []
  let pageNumber = 1 // 페이지 번호를 추적하기 위한 변수
  let baseUrl = `/status?from_mine=1&user_id=${username}`
  while (true) {
    const response = await page.request.get(`https://www.acmicpc.net${baseUrl}`)
    const body = (await response.body()).toString()
    const doc = parseHtml(body)
    // logger.info(`➡️ 현재 ${pageNumber}번째 페이지의 제출 목록을 가져오는 중...`)

    const submissionElements = doc.find<Element>("//table[@id='status-table']//tbody//tr")
    const validStatuses: SubmissionStatus[] = ['AC', 'WA', 'PE', 'TLE', 'MLE', 'OLE', 'RTE', 'CE']

    for (const element of submissionElements) {
      const submissionIDText = element.find<Element>('.//td[position()=1]')[0].text()
      const problemIdText = element.find<Element>('.//td[position()=3]')[0].text()
      const status = element.find<Element>('.//td[position()=4]//span')[0].attr('data-color').value()

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
      if (!validStatuses.includes(upperCaseStatus)) {
        // logger.info(`ℹ️ 상태가 유효하지 않아 (${status}) 건너뜁니다.`)
        continue
      }
      submissions.push({ id: submissionID, status: upperCaseStatus, problemId: problemId })
    }

    const nextButton = doc.find<Element>("//a[@id='next_page']")

    if (nextButton.length == 0) {
      logger.info(chalk.blueBright.bold(`Pagination Finish!`))
      break
    }
    baseUrl = nextButton[0].attr(`href`).value()
    pageNumber++
    logger.info(chalk.blueBright.bold(`Move Next Page ${pageNumber - 1} -> ${pageNumber} (Submission Count : ${submissionElements.length})`))
  }
  return submissions
}

/*
 * https://help.acmicpc.net/language/info 참고
 */
const getSubmissionExtension = (languageID: number): string => {
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
