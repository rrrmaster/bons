type SubmissionStatus = 'AC' | 'WA' | 'PE' | 'TLE' | 'MLE' | 'OLE' | 'RTE' | 'CE'
type Scope = 'first' | 'last' | 'all'

interface SubmissionDetail {
  id: string
  code: string
  problemId: string | null
  problemTitle: string | null
  cpuTimeUsaged: number
  memoryUsaged: number
  codeLength: number
  languageID: number
  displayLanguageName: string | null
}

interface Submission {
  id: number
  problemId: number
  status: SubmissionStatus
}
