import assert from 'node:assert/strict'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { parse } from 'parse5'

const expectedBase = process.argv[2] ?? './'
assert.match(expectedBase, /^(?:\.\/|\/[A-Za-z0-9._-]+\/$)/, 'Expected an exact relative or project Pages base')
const distRoot = resolve(process.cwd(), 'dist')
const distRootInfo = await lstat(distRoot)
assert.ok(distRootInfo.isDirectory() && !distRootInfo.isSymbolicLink(), 'dist must be a real non-symlink directory')
const physicalDistRoot = await realpath(distRoot)
const indexPath = resolve(distRoot, 'index.html')
const indexInfo = await lstat(indexPath)
assert.ok(indexInfo.isFile() && !indexInfo.isSymbolicLink(), 'dist/index.html must be a regular non-symlink file')
const physicalIndexPath = await realpath(indexPath)
assert.ok(physicalIndexPath.startsWith(`${physicalDistRoot}${sep}`), 'Physical index.html must remain beneath dist')
const html = await readFile(indexPath, 'utf8')
const assetsRoot = resolve(distRoot, 'assets')
const assetsRootInfo = await lstat(assetsRoot)
assert.ok(assetsRootInfo.isDirectory() && !assetsRootInfo.isSymbolicLink(), 'dist/assets must be a real directory')
const physicalAssetsRoot = await realpath(assetsRoot)
assert.ok(
  physicalAssetsRoot.startsWith(`${physicalDistRoot}${sep}`),
  'Physical assets directory must remain beneath dist',
)

const parseErrors = []
const document = parse(html, { onParseError: (error) => parseErrors.push(error) })
assert.equal(parseErrors.length, 0, `index.html contains parse errors: ${parseErrors.map((error) => error.code).join(', ')}`)
const elements = []
const visit = (node) => {
  if (node.tagName) elements.push(node)
  for (const child of node.childNodes ?? []) visit(child)
}
visit(document)
const attribute = (node, name) => node.attrs?.find((candidate) => candidate.name === name)?.value

const allowedAttributes = {
  html: new Set(['lang']),
  head: new Set(),
  meta: new Set(['charset', 'name', 'content']),
  title: new Set(),
  link: new Set(['rel', 'type', 'href', 'crossorigin', 'as']),
  script: new Set(['type', 'crossorigin', 'src']),
  body: new Set(),
  div: new Set(['id']),
}
for (const element of elements) {
  const allowed = allowedAttributes[element.tagName]
  assert.ok(allowed, `Unexpected HTML element <${element.tagName}> in portable build`)
  for (const attr of element.attrs ?? []) {
    assert.ok(allowed.has(attr.name), `Unexpected attribute ${attr.name} on <${element.tagName}>`)
    assert.ok(!/^\s*javascript:/i.test(attr.value), `javascript: URL prohibited in ${attr.name}`)
  }
}
assert.equal(elements.filter((element) => element.tagName === 'html').length, 1, 'Expected one html element')
assert.equal(attribute(elements.find((element) => element.tagName === 'html'), 'lang'), 'en', 'Expected html lang=en')
const roots = elements.filter((element) => element.tagName === 'div')
assert.equal(roots.length, 1, 'Expected exactly one root div')
assert.equal(attribute(roots[0], 'id'), 'root', 'Expected div#root')

const scriptUrls = []
for (const element of elements.filter((candidate) => candidate.tagName === 'script')) {
  const src = attribute(element, 'src')
  assert.ok(src, 'Inline or source-less scripts are prohibited in the portable build')
  scriptUrls.push(src)
}

const stylesheetUrls = []
const modulePreloadUrls = []
const iconUrls = []
for (const element of elements.filter((candidate) => candidate.tagName === 'link')) {
  const rel = (attribute(element, 'rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  assert.equal(rel.length, 1, `Link must have exactly one supported rel token: ${rel.join(' ')}`)
  const href = attribute(element, 'href')
  assert.ok(href, 'Link elements must include href')
  if (rel[0] === 'stylesheet') {
    stylesheetUrls.push(href)
  } else if (rel[0] === 'modulepreload') {
    modulePreloadUrls.push(href)
  } else if (rel[0] === 'icon') {
    iconUrls.push(href)
  } else if (rel[0] === 'preload') {
    const as = (attribute(element, 'as') ?? '').toLowerCase()
    if (as === 'script') modulePreloadUrls.push(href)
    else if (as === 'style') stylesheetUrls.push(href)
    else assert.fail(`Unsupported preload type: ${as || '(missing)'}`)
  } else {
    assert.fail(`Unsupported link rel: ${rel[0] || '(missing)'}`)
  }
}

assert.ok(scriptUrls.length >= 1, 'Expected at least one built JavaScript script reference')
assert.ok(stylesheetUrls.length >= 1, 'Expected at least one built CSS stylesheet reference')

const verifyAsset = async (url, extension) => {
  assert.ok(url.startsWith(expectedBase), `Asset ${url} does not start with exact base ${expectedBase}`)
  const relativePath = url.slice(expectedBase.length)
  const segments = relativePath.split('/')
  assert.ok(
    segments[0] === 'assets' && segments.every((segment) => segment !== '.' && segment !== '..'),
    `Asset ${url} contains a noncanonical path segment`,
  )
  const safeAssetPattern = new RegExp(`^assets/(?:[A-Za-z0-9._-]+/)*[A-Za-z0-9._-]+\\.${extension}$`)
  assert.match(relativePath, safeAssetPattern, `Asset ${url} is not a canonical ${extension} asset path`)
  const filePath = resolve(distRoot, relativePath)
  assert.ok(filePath.startsWith(`${assetsRoot}${sep}`), `Asset ${url} escapes dist/assets`)
  // Walk every path component from dist through to leaf — reject any symlink
  let current = distRoot
  for (const segment of segments) {
    current = resolve(current, segment)
    const info = await lstat(current)
    assert.ok(!info.isSymbolicLink(), `Path component ${current} is a symlink — rejected`)
  }
  const file = await lstat(filePath)
  assert.ok(file.isFile() && !file.isSymbolicLink(), `Asset ${url} is not a regular non-symlink file`)
  const physicalFilePath = await realpath(filePath)
  assert.ok(
    physicalFilePath.startsWith(`${physicalAssetsRoot}${sep}`),
    `Physical asset ${url} escapes dist/assets`,
  )
}

const verifyPublicFile = async (url, expectedRelativePath) => {
  assert.equal(url, `${expectedBase}${expectedRelativePath}`, `Public file URL must be exactly ${expectedBase}${expectedRelativePath}`)
  const filePath = resolve(distRoot, expectedRelativePath)
  const info = await lstat(filePath)
  assert.ok(info.isFile() && !info.isSymbolicLink(), `Public file ${url} must be a regular non-symlink file`)
  const physicalPath = await realpath(filePath)
  assert.ok(physicalPath.startsWith(`${physicalDistRoot}${sep}`), `Physical public file ${url} escapes dist`)
}

for (const url of scriptUrls) {
  await verifyAsset(url, 'js')
}
for (const url of modulePreloadUrls) {
  await verifyAsset(url, 'js')
}
for (const url of stylesheetUrls) {
  await verifyAsset(url, 'css')
}
for (const url of iconUrls) {
  await verifyPublicFile(url, 'favicon.svg')
}
console.log(
  `Portable build verified: ${scriptUrls.length + modulePreloadUrls.length} JavaScript and ${stylesheetUrls.length} CSS asset(s) use ${expectedBase}`,
)
