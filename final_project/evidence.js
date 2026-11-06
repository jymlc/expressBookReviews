const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { mkdir, writeFile } = require('node:fs/promises')
const app = require('./index')
const { getAllBooks, getBooksByISBN, getBooksByAuthor, getBooksByTitle } = require('./router/general')

const base = process.env.BOOK_API_URL || 'http://127.0.0.1:5000'
const curl = process.platform === 'win32' ? 'curl.exe' : 'curl'
const output = process.env.EVIDENCE_DIR || 'evidence'
const credentials = { username: 'bookshop_demo', password: 'local-demo-password' }
let token

function runCurl(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(curl, ['--silent', '--show-error', '--max-time', '15', '--write-out', '\n%{http_code}', ...args])
    let body = ''
    let error = ''
    child.stdout.setEncoding('utf8').on('data', (data) => { body += data })
    child.stderr.setEncoding('utf8').on('data', (data) => { error += data })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(error || `curl exited with ${code}`))
      const separator = body.lastIndexOf('\n')
      try {
        resolve({ status: Number(body.slice(separator + 1)), data: JSON.parse(body.slice(0, separator)) })
      } catch (err) {
        reject(err)
      }
    })
  })
}

async function capture(name, args, expected, redact = false) {
  const { status, data } = await runCurl(args)
  assert.equal(status, expected, JSON.stringify(data))
  if (!name) return data
  const visibleArgs = args.map((arg) => arg.startsWith('Authorization:') ? 'Authorization: Bearer $TOKEN' : arg)
  const command = 'curl ' + visibleArgs.map((arg) => arg.includes('$TOKEN') ? `"${arg}"` : `'${arg}'`).join(' ')
  const visibleData = redact ? { ...data, token: '[demo token redacted]' } : data
  await writeFile(`${output}/${name}.txt`, `${command}\n\nHTTP ${status}\n${JSON.stringify(visibleData, null, 2)}\n`)
  return data
}

async function main() {
  await mkdir(output, { recursive: true })
  const api = new URL(base)
  const server = app.listen(Number(api.port), api.hostname)
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })

  try {
    const repo = process.env.GITHUB_REPOSITORY
    if (repo) {
      const url = `https://api.github.com/repos/${repo}`
      const { status, data } = await runCurl([url])
      assert.equal(status, 200)
      assert.equal(data.fork, true)
      assert.equal(data.parent.full_name, 'ibm-developer-skills-network/expressBookReviews')
      const proof = { full_name: data.full_name, private: data.private, fork: data.fork, parent: { full_name: data.parent.full_name } }
      await writeFile(`${output}/githubrepo.txt`, `curl '${url}'\n\nHTTP ${status}\n${JSON.stringify(proof, null, 2)}\n\nRelevant fields from the GitHub API response.\n`)
    }
    const get = (name, path) => capture(name, [base + path], 200)
    const json = (body) => ['-H', 'Content-Type: application/json', '--data', JSON.stringify(body)]
    const all = await get('getallbooks', '/')
    assert.equal(Object.keys(all).length, 10)
    const isbn = await get('getbooksbyISBN', '/isbn/1')
    const author = await get('getbooksbyauthor', '/author/Unknown')
    const title = await get('getbooksbytitle', '/title/Things%20Fall%20Apart')
    assert.equal(isbn.title, 'Things Fall Apart')
    assert.equal(Object.keys(author).length, 4)
    assert.deepEqual(title, { 1: isbn })
    assert.deepEqual(await Promise.all([
      getAllBooks(), getBooksByISBN(1), getBooksByAuthor('Unknown'), getBooksByTitle('Things Fall Apart'),
    ]), [all, isbn, author, title])
    assert.deepEqual(await get('getbookreview', '/review/1'), {})
    const account = async (name, path, status, body = credentials) =>
      capture(name, ['-X', 'POST', base + path, ...json(body)], status, name === 'login')
    await account('register', '/register', 201)
    await account(null, '/register', 409)
    await account(null, '/customer/login', 401, { ...credentials, password: 'wrong' })
    token = (await account('login', '/customer/login', 200)).token
    const reviewUrl = base + '/customer/auth/review/1'
    const auth = () => ['-H', `Authorization: Bearer ${token}`]
    const put = (name, review) => capture(name, ['-X', 'PUT', reviewUrl, ...auth(), ...json({ review })], 200)
    await capture(null, ['-X', 'DELETE', reviewUrl], 401)
    assert.equal((await put('reviewadded', 'A memorable novel.')).reviews[credentials.username], 'A memorable novel.')
    assert.equal((await put('reviewupdated', 'A memorable novel with a powerful ending.')).message, 'Review updated.')
    const other = { username: 'another_reader', password: 'other-demo-password' }
    await account(null, '/register', 201, other)
    const otherToken = (await account(null, '/customer/login', 200, other)).token
    await capture(null, ['-X', 'DELETE', reviewUrl, '-H', `Authorization: Bearer ${otherToken}`], 404)
    assert.deepEqual((await capture('deletereview', ['-X', 'DELETE', reviewUrl, ...auth()], 200)).reviews, {})
    assert.deepEqual(await get(null, '/review/1'), {})
    console.log('All API and Axios checks passed. Evidence is in ' + output)
  } finally {
    server.close()
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
