import chalk from 'chalk'
import prompts from 'prompts'
import { program } from 'commander'
import { run } from './backjoon.js'
import { createRequire } from 'module'
const packageJson = createRequire(import.meta.url)('../package.json')

export async function main() {
  program
    .name(packageJson.name)
    .description(packageJson.description)
    .version(packageJson.version)
    .requiredOption('-u, --username <string>', 'backjoon username')
    .option('--password-stdin', 'backjoon password')
    .option('-o, --output <string>', 'backjoon output folorder', './backjoon/[problem_id]/[submission_id].[ext]')
    .option('-s, --status [letters...]', 'as', 'AC')
    .option('--scope <string>', '', 'last')
    .parse()
  const options = program.opts()

  let password = undefined
  const fromStdin = options['password-stdin'] ? true : false
  if (process.env.PASSWORD && !fromStdin) {
    password = process.env.PASSWORD
  } else if (fromStdin || !process.env.PASSWORD) {
    password = await prompts({
      type: 'password',
      name: 'value',
      message: 'Enter your password:',
    })
    if (password === null) {
      return 1
    }
  }

  const { username, output, status, scope } = options
  await run(username, password.value, {
    output,
    status,
    scope,
  })
}
