// Publishes the app to GitHub Pages: type check, tests, build, then dist/ is
// force-pushed as the only commit of the gh-pages branch of `origin`.
// Only the build goes out; the sources stay in this repository.
import { execFileSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = fileURLToPath(new URL('../dist', import.meta.url))

// the same node that runs this script, so it works without node on PATH
const node = (...args) => execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' })
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

node('node_modules/typescript/bin/tsc', '--noEmit')
node('node_modules/vitest/vitest.mjs', 'run')
await build({ root })
// serve the files as they are, without Jekyll
writeFileSync(`${dist}/.nojekyll`, '')

const remote = git(root, 'remote', 'get-url', 'origin')
const source = git(root, 'rev-parse', '--short', 'HEAD') + (git(root, 'status', '--porcelain') ? ' с незакоммиченными правками' : '')
// the build is committed under the author of the last source commit
const author = ['-c', `user.name=${git(root, 'log', '-1', '--format=%an')}`, '-c', `user.email=${git(root, 'log', '-1', '--format=%ae')}`]

// a fresh repository every time, so the branch really holds this one commit
// (Vite keeps dist/.git when it empties the folder)
rmSync(`${dist}/.git`, { recursive: true, force: true })
git(dist, 'init', '-q', '-b', 'gh-pages')
// publish the files byte for byte, whatever core.autocrlf says
git(dist, 'config', 'core.autocrlf', 'false')
git(dist, 'add', '-A')
git(dist, ...author, 'commit', '-q', '-m', `Сборка из ${source}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`)
execFileSync('git', ['push', '--force', remote, 'gh-pages'], { cwd: dist, stdio: 'inherit' })
console.log(`Опубликовано: ${remote}, ветка gh-pages`)
