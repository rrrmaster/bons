import prompts from 'prompts'
import { program } from 'commander'
import { run } from './backjoon/index.js'
import { createRequire } from 'module'
const packageJson = createRequire(import.meta.url)('../package.json')

export async function main() {
  program
    .name(packageJson.name)
    .description(packageJson.description)
    .version(packageJson.version)
    .requiredOption('-u, --username <string>', 'Backjoon username')
    .option('--password-stdin', 'Read Backjoon password from stdin')
    .option('-o, --output <string>', 'Backjoon output folder', './backjoon/[problem_id]/[submission_id].[ext]')
    .option('-s, --status [letters...]', 'Filter by status', 'AC')
    .option('--scope <string>', 'Scope of results', 'last')
    .parse()

  const options = program.opts()

  const password = await getPassword(options)

  // 3. 실행
  await run(options.username, password, {
    output: options.output,
    status: options.status,
    scope: options.scope,
  })
}

async function getPassword(options) {
  const fromStdin = !!options['password-stdin']

  if (process.env.PASSWORD && !fromStdin) {
    return process.env.PASSWORD
  }

  const { value } = await prompts({
    type: 'password',
    name: 'value',
    message: 'Enter your password:',
  })

  if (!value) {
    process.exit(1)
  }

  return value
}
