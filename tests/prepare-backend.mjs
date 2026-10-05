import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { backendTestEnvironment } from './backend-environment.ts'

// Validate before any migration or generated-file write. Never load the backend .env.
const env = { ...process.env, ...backendTestEnvironment() }
const cwd = fileURLToPath(new URL('../../coffee_shop_be/', import.meta.url))
const pnpm = process.env.npm_execpath
if (!pnpm) throw new Error('Run this harness with pnpm test:integration')
for (const args of [
  ['prisma:validate'], ['prisma:generate'], ['typecheck'], ['exec', 'prisma', 'migrate', 'deploy'], ['build'],
]) {
  const result = spawnSync(process.execPath, [pnpm, ...args], { cwd, env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// Resolve pnpm's real client location; never duplicate Prisma in the frontend package.
const requireBackend = createRequire(resolve(cwd, 'package.json'))
const client = requireBackend.resolve('.prisma/client/default', { paths: [dirname(requireBackend.resolve('@prisma/client'))] })
const output = fileURLToPath(new URL('../.runtime/', import.meta.url))
mkdirSync(output, { recursive: true })
writeFileSync(resolve(output, 'backend-client.d.ts'),
  `export { PrismaClient } from '${relative(output, client).split(sep).join('/')}';\n`)
