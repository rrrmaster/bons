import { program } from 'commander'
import packageJson from '../package.json'
import prompts from 'prompts'

import { run } from './backjoon.js'

export const mainFunction = main

async function main() {
  program
    .name(packageJson.name)
    .description(packageJson.description)
    .version(packageJson.version)
    .option('-u, --username <string>', 'backjoon username')
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
  }

  const { username, output, status, scope } = options
  await run(username, password.value, {
    output,
    status,
    scope,
  })
}

main()
