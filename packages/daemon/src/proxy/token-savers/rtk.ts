import type { ContentBlock, MessagesRequest } from '../../core/anthropic/types.js'

const RAW_CAP = 10 * 1024 * 1024
const MIN_COMPRESS_SIZE = 500
const DETECT_WINDOW = 1024
const GIT_DIFF_HUNK_MAX_LINES = 100
const GREP_PER_FILE_MAX = 10
const FIND_PER_DIR_MAX = 10
const FIND_TOTAL_DIR_MAX = 20
const STATUS_MAX_FILES = 10
const STATUS_MAX_UNTRACKED = 10
const DEDUP_LINE_MAX = 2000
const SMART_TRUNCATE_HEAD = 120
const SMART_TRUNCATE_TAIL = 60
const SMART_TRUNCATE_MIN_LINES = 250
const READ_NUMBERED_MIN_HIT_RATIO = 0.7
const SEARCH_LIST_PER_DIR_MAX = 10
const SEARCH_LIST_TOTAL_DIR_MAX = 20
const TREE_MAX_LINES = 200

type Filter = ((input: string) => string) & { filterName?: string }

export type RtkCompressionStats = {
  bytesBefore: number
  bytesAfter: number
  hits: Array<{ shape: string; filter: string; saved: number }>
}

export function compressMessages(req: MessagesRequest, enabled: boolean): RtkCompressionStats | null {
  if (!enabled) return null

  const stats: RtkCompressionStats = { bytesBefore: 0, bytesAfter: 0, hits: [] }
  try {
    for (const message of req.messages) {
      if (!Array.isArray(message.content)) continue
      for (const block of message.content) {
        if (block.type !== 'tool_result' || block.is_error === true) continue
        if (typeof block.content === 'string') {
          block.content = compressText(block.content, stats, 'claude-string')
        } else if (Array.isArray(block.content)) {
          for (const part of block.content) {
            if (part.type === 'text') {
              part.text = compressText(part.text, stats, 'claude-array')
            }
          }
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[RTK] compressMessages error: ${message}`)
    return null
  }

  return stats
}

export function formatRtkLog(stats: RtkCompressionStats | null): string | null {
  if (!stats?.hits.length) return null
  const saved = stats.bytesBefore - stats.bytesAfter
  const pct = stats.bytesBefore > 0 ? ((saved / stats.bytesBefore) * 100).toFixed(1) : '0'
  const filters = Array.from(new Set(stats.hits.map(hit => hit.filter))).join(',')
  return `saved ${saved}B / ${stats.bytesBefore}B (${pct}%) via [${filters}] hits=${stats.hits.length}`
}

function compressText(text: string, stats: RtkCompressionStats, shape: string): string {
  const bytesIn = text.length
  stats.bytesBefore += bytesIn

  if (bytesIn < MIN_COMPRESS_SIZE || bytesIn > RAW_CAP) {
    stats.bytesAfter += bytesIn
    return text
  }

  const filter = autoDetectFilter(text)
  if (!filter) {
    stats.bytesAfter += bytesIn
    return text
  }

  const out = safeApply(filter, text)
  if (!out || out.length === 0 || out.length >= bytesIn) {
    stats.bytesAfter += bytesIn
    return text
  }

  stats.bytesAfter += out.length
  stats.hits.push({ shape, filter: filter.filterName ?? filter.name, saved: bytesIn - out.length })
  return out
}

function safeApply(filter: Filter, text: string): string {
  try {
    const out = filter(text)
    return typeof out === 'string' ? out : text
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[rtk] warning: filter '${filter.filterName ?? filter.name}' failed; passing through raw output: ${message}`)
    return text
  }
}

function autoDetectFilter(text: string): Filter | null {
  const head = text.length > DETECT_WINDOW ? text.slice(0, DETECT_WINDOW) : text
  if (/^diff --git /m.test(head) || /^@@ /m.test(head)) return gitDiff
  if (/^On branch |^nothing to commit|^Changes (not |to be )|^Untracked files:/m.test(head) || isMostlyPorcelain(head)) return gitStatus

  const lines = head.split('\n')
  const totalLines = text.split('\n').length
  const nonEmpty = lines.filter(line => line.trim().length > 0)
  if (nonEmpty.slice(0, 5).some(isGrepLine)) return grep
  if (nonEmpty.length >= 3 && nonEmpty.every(isPathLike)) return find
  if (/[├└]──|│  /.test(head)) return tree
  if (/^total \d+$/m.test(head) || countMatches(head, /^[-dlbcps][rwx-]{9}/m) >= 3) return ls
  if (SEARCH_LIST_HEADER_RE.test(head)) return searchList
  if (totalLines >= SMART_TRUNCATE_MIN_LINES && isLineNumbered(lines)) return readNumbered
  if (nonEmpty.length >= 5 && hasDuplicateRun(nonEmpty)) return dedupLog
  if (totalLines >= SMART_TRUNCATE_MIN_LINES) return smartTruncate
  return null
}

function hasDuplicateRun(lines: string[]): boolean {
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === lines[i - 1]) return true
  }
  return false
}

function isGrepLine(line: string): boolean {
  const first = line.indexOf(':')
  if (first === -1) return false
  const second = line.indexOf(':', first + 1)
  if (second === -1) return false
  return /^\d+$/.test(line.slice(first + 1, second))
}

function isPathLike(line: string): boolean {
  const t = line.trim()
  if (!t || t.includes(':')) return false
  return t.startsWith('.') || t.startsWith('/') || t.includes('/')
}

function isMostlyPorcelain(head: string): boolean {
  const lines = head.split('\n').filter(line => line.trim())
  if (lines.length < 3) return false
  const hits = lines.filter(line => /^[ MADRCU?!][ MADRCU?!] \S/m.test(line)).length
  return hits / lines.length >= 0.6
}

function isLineNumbered(lines: string[]): boolean {
  let hits = 0
  let nonEmpty = 0
  for (const line of lines.slice(0, 100)) {
    if (!line) continue
    nonEmpty += 1
    if (READ_NUMBERED_LINE_RE.test(line)) hits += 1
  }
  return nonEmpty >= 5 && hits / nonEmpty >= READ_NUMBERED_MIN_HIT_RATIO
}

function countMatches(text: string, re: RegExp): number {
  return text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`))?.length ?? 0
}

const gitDiff: Filter = (diff: string, maxLines = 500): string => {
  const result: string[] = []
  let currentFile = ''
  let added = 0
  let removed = 0
  let inHunk = false
  let hunkShown = 0
  let hunkSkipped = 0
  let wasTruncated = false

  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git')) {
      if (hunkSkipped > 0) {
        result.push(`  ... (${hunkSkipped} lines truncated)`)
        wasTruncated = true
        hunkSkipped = 0
      }
      if (currentFile && (added > 0 || removed > 0)) result.push(`  +${added} -${removed}`)
      currentFile = line.split(' b/').slice(1).join(' b/') || 'unknown'
      result.push(`\n${currentFile}`)
      added = 0
      removed = 0
      inHunk = false
      hunkShown = 0
    } else if (line.startsWith('@@')) {
      if (hunkSkipped > 0) {
        result.push(`  ... (${hunkSkipped} lines truncated)`)
        wasTruncated = true
        hunkSkipped = 0
      }
      inHunk = true
      hunkShown = 0
      result.push(`  ${line}`)
    } else if (inHunk) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        added += 1
        if (hunkShown < GIT_DIFF_HUNK_MAX_LINES) result.push(`  ${line}`)
        else hunkSkipped += 1
        hunkShown += 1
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removed += 1
        if (hunkShown < GIT_DIFF_HUNK_MAX_LINES) result.push(`  ${line}`)
        else hunkSkipped += 1
        hunkShown += 1
      } else if (hunkShown < GIT_DIFF_HUNK_MAX_LINES && !line.startsWith('\\') && hunkShown > 0) {
        result.push(`  ${line}`)
        hunkShown += 1
      }
    }
    if (result.length >= maxLines) {
      result.push('\n... (more changes truncated)')
      wasTruncated = true
      break
    }
  }

  if (hunkSkipped > 0) {
    result.push(`  ... (${hunkSkipped} lines truncated)`)
    wasTruncated = true
  }
  if (currentFile && (added > 0 || removed > 0)) result.push(`  +${added} -${removed}`)
  if (wasTruncated) result.push('[full diff: rtk git diff --no-compact]')
  return result.join('\n')
}
gitDiff.filterName = 'git-diff'

const gitStatus: Filter = (input: string): string => {
  const stagedFiles: string[] = []
  const modifiedFiles: string[] = []
  const untrackedFiles: string[] = []
  let branch = ''
  let staged = 0
  let modified = 0
  let untracked = 0
  let conflicts = 0
  let inStagedSection = false

  for (const raw of input.split('\n')) {
    if (!raw.trim()) continue
    const longBranch = raw.match(/^On branch (\S+)/)
    if (longBranch) {
      branch = longBranch[1] ?? ''
      continue
    }
    if (raw.startsWith('##')) {
      branch = raw.replace(/^##\s*/, '')
      continue
    }
    if (raw.includes('Changes to be committed:')) {
      inStagedSection = true
      continue
    }
    if (raw.includes('Changes not staged for commit:') || raw.includes('Untracked files:') || raw.includes('Unmerged paths:')) {
      inStagedSection = false
      continue
    }
    if (/^[ MADRCU?!][ MADRCU?!] /.test(raw)) {
      const x = raw[0]
      const y = raw[1]
      const file = raw.slice(3)
      if (raw.slice(0, 2) === '??') {
        untracked += 1
        untrackedFiles.push(file)
        continue
      }
      if ('MADRC'.includes(x)) {
        staged += 1
        stagedFiles.push(file)
      } else if (x === 'U') conflicts += 1
      if (y === 'M' || y === 'D') {
        modified += 1
        modifiedFiles.push(file)
      }
      continue
    }
    const longMatch = raw.match(/^\s*(modified|new file|deleted|renamed|both modified):\s+(.+)$/)
    if (!longMatch) continue
    const kind = longMatch[1]
    const file = longMatch[2]?.trim() ?? ''
    if (kind === 'both modified') conflicts += 1
    else if (inStagedSection) {
      staged += 1
      stagedFiles.push(file)
    } else {
      modified += 1
      modifiedFiles.push(file)
    }
  }

  let out = branch ? `* ${branch}\n` : ''
  out += statusSection('+ Staged', staged, stagedFiles, STATUS_MAX_FILES)
  out += statusSection('~ Modified', modified, modifiedFiles, STATUS_MAX_FILES)
  out += statusSection('? Untracked', untracked, untrackedFiles, STATUS_MAX_UNTRACKED)
  if (conflicts > 0) out += `conflicts: ${conflicts} files\n`
  if (staged === 0 && modified === 0 && untracked === 0 && conflicts === 0) out += 'clean - nothing to commit\n'
  return out.replace(/\n+$/, '')
}
gitStatus.filterName = 'git-status'

function statusSection(title: string, count: number, files: string[], max: number): string {
  if (count <= 0) return ''
  let out = `${title}: ${count} files\n`
  for (const file of files.slice(0, max)) out += `   ${file}\n`
  if (files.length > max) out += `   ... +${files.length - max} more\n`
  return out
}

const grep: Filter = (input: string): string => {
  const byFile = new Map<string, Array<[string, string]>>()
  let total = 0
  for (const line of input.split('\n')) {
    const first = line.indexOf(':')
    const second = first === -1 ? -1 : line.indexOf(':', first + 1)
    if (first === -1 || second === -1) continue
    const lineNum = line.slice(first + 1, second)
    if (!/^\d+$/.test(lineNum)) continue
    const file = line.slice(0, first)
    total += 1
    const matches = byFile.get(file) ?? []
    matches.push([lineNum, line.slice(second + 1)])
    byFile.set(file, matches)
  }
  if (total === 0) return input
  let out = `${total} matches in ${byFile.size}F:\n\n`
  for (const file of Array.from(byFile.keys()).sort()) {
    const matches = byFile.get(file) ?? []
    out += `[file] ${file} (${matches.length}):\n`
    for (const [lineNum, content] of matches.slice(0, GREP_PER_FILE_MAX)) out += `  ${lineNum.padStart(4)}: ${content.trim()}\n`
    if (matches.length > GREP_PER_FILE_MAX) out += `  +${matches.length - GREP_PER_FILE_MAX}\n`
    out += '\n'
  }
  return out
}
grep.filterName = 'grep'

const find: Filter = (input: string): string => {
  const lines = input.split('\n').filter(line => line.trim())
  if (!lines.length) return input
  const byDir = new Map<string, string[]>()
  for (const p of lines) {
    const slash = p.lastIndexOf('/')
    const dir = slash === -1 ? '.' : p.slice(0, slash) || '/'
    const basename = slash === -1 ? p : p.slice(slash + 1)
    byDir.set(dir, [...(byDir.get(dir) ?? []), basename])
  }
  const dirs = Array.from(byDir.keys()).sort()
  let out = `${lines.length} files in ${dirs.length} dirs:\n\n`
  for (const dir of dirs.slice(0, FIND_TOTAL_DIR_MAX)) {
    const files = byDir.get(dir) ?? []
    out += `${dir}/ (${files.length}):\n`
    for (const file of files.slice(0, FIND_PER_DIR_MAX)) out += `  ${file}\n`
    if (files.length > FIND_PER_DIR_MAX) out += `  +${files.length - FIND_PER_DIR_MAX}\n`
    out += '\n'
  }
  if (dirs.length > FIND_TOTAL_DIR_MAX) out += `+${dirs.length - FIND_TOTAL_DIR_MAX} more dirs\n`
  return out
}
find.filterName = 'find'

const dedupLog: Filter = (input: string): string => {
  const out: string[] = []
  let prev: string | null = null
  let runCount = 0
  let blankStreak = 0
  const flushRun = () => {
    if (prev !== null && runCount > 1) out.push(`  ... (${runCount - 1} duplicate lines)`)
  }
  for (const line of input.split('\n')) {
    if (line.trim() === '') {
      if (blankStreak < 1) out.push(line)
      blankStreak += 1
      flushRun()
      prev = null
      runCount = 0
      continue
    }
    blankStreak = 0
    if (line === prev) {
      runCount += 1
      continue
    }
    flushRun()
    out.push(line)
    prev = line
    runCount = 1
    if (out.length >= DEDUP_LINE_MAX) return `${out.join('\n')}\n... (truncated at ${DEDUP_LINE_MAX} lines)`
  }
  flushRun()
  return out.join('\n')
}
dedupLog.filterName = 'dedup-log'

const smartTruncate: Filter = (input: string): string => truncateLines(input, '... +{cut} lines truncated')
smartTruncate.filterName = 'smart-truncate'

const READ_NUMBERED_LINE_RE = /^\s*\d+\|/
const readNumbered: Filter = (input: string): string => truncateLines(input, '... +{cut} lines truncated (file continues)')
readNumbered.filterName = 'read-numbered'

function truncateLines(input: string, marker: string): string {
  const lines = input.split('\n')
  if (lines.length < SMART_TRUNCATE_MIN_LINES) return input
  const head = lines.slice(0, SMART_TRUNCATE_HEAD)
  const tail = lines.slice(lines.length - SMART_TRUNCATE_TAIL)
  const cut = lines.length - head.length - tail.length
  return [...head, marker.replace('{cut}', String(cut)), ...tail].join('\n')
}

const tree: Filter = (input: string): string => {
  const filtered = input
    .split('\n')
    .filter(line => !(line.includes('director') && line.includes('file')))
  while (filtered.length > 0 && filtered[0]?.trim() === '') filtered.shift()
  while (filtered.length > 0 && filtered[filtered.length - 1]?.trim() === '') filtered.pop()
  if (filtered.length > TREE_MAX_LINES) return `${filtered.slice(0, TREE_MAX_LINES).join('\n')}\n... +${filtered.length - TREE_MAX_LINES} more lines`
  return filtered.join('\n')
}
tree.filterName = 'tree'

const SEARCH_LIST_HEADER_RE = /^Result of search in '[^']*' \(total (\d+) files?\):/
const searchList: Filter = (input: string): string => {
  const lines = input.split('\n')
  const header = lines[0] ?? ''
  const paths = lines.slice(1).map(line => line.trim()).filter(line => line.startsWith('- ')).map(line => line.slice(2))
  if (!paths.length) return input
  const byDir = new Map<string, string[]>()
  for (const p of paths) {
    const slash = p.lastIndexOf('/')
    const dir = slash === -1 ? '.' : p.slice(0, slash) || '/'
    const name = slash === -1 ? p : p.slice(slash + 1)
    byDir.set(dir, [...(byDir.get(dir) ?? []), name])
  }
  const dirs = Array.from(byDir.keys()).sort()
  let out = `${header}\n${paths.length} files in ${dirs.length} dirs:\n\n`
  for (const dir of dirs.slice(0, SEARCH_LIST_TOTAL_DIR_MAX)) {
    const names = byDir.get(dir) ?? []
    out += `${dir}/ (${names.length}):\n`
    for (const name of names.slice(0, SEARCH_LIST_PER_DIR_MAX)) out += `  ${name}\n`
    if (names.length > SEARCH_LIST_PER_DIR_MAX) out += `  +${names.length - SEARCH_LIST_PER_DIR_MAX}\n`
    out += '\n'
  }
  if (dirs.length > SEARCH_LIST_TOTAL_DIR_MAX) out += `+${dirs.length - SEARCH_LIST_TOTAL_DIR_MAX} more dirs\n`
  return out.replace(/\n+$/, '')
}
searchList.filterName = 'search-list'

const LS_DATE_RE = /\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+(\d{4}|\d{2}:\d{2})\s+/
const LS_NOISE_DIRS = new Set(['node_modules', '.git', 'target', '__pycache__', '.next', 'dist', 'build', '.venv', 'venv', '.cache', '.idea', '.vscode', '.DS_Store'])

const ls: Filter = (input: string): string => {
  const dirs: string[] = []
  const files: Array<[string, string]> = []
  const byExt = new Map<string, number>()
  for (const line of input.split('\n')) {
    if (line.startsWith('total ') || !line) continue
    const parsed = parseLsLine(line)
    if (!parsed || parsed.name === '.' || parsed.name === '..' || LS_NOISE_DIRS.has(parsed.name)) continue
    if (parsed.fileType === 'd') dirs.push(parsed.name)
    else if (parsed.fileType === '-' || parsed.fileType === 'l') {
      const dot = parsed.name.lastIndexOf('.')
      const ext = dot > 0 ? parsed.name.slice(dot) : 'no ext'
      byExt.set(ext, (byExt.get(ext) ?? 0) + 1)
      files.push([parsed.name, humanSize(parsed.size)])
    }
  }
  if (dirs.length === 0 && files.length === 0) return input
  let out = ''
  for (const dir of dirs) out += `${dir}/\n`
  for (const [name, size] of files) out += `${name}  ${size}\n`
  let summary = `\nSummary: ${files.length} files, ${dirs.length} dirs`
  if (byExt.size > 0) {
    const ext = Array.from(byExt.entries()).sort((a, b) => b[1] - a[1])
    summary += ` (${ext.slice(0, 5).map(([e, c]) => `${c} ${e}`).join(', ')}`
    if (ext.length > 5) summary += `, +${ext.length - 5} more`
    summary += ')'
  }
  return out + summary
}
ls.filterName = 'ls'

function parseLsLine(line: string): { fileType: string; size: number; name: string } | null {
  const match = LS_DATE_RE.exec(line)
  if (!match) return null
  const beforeParts = line.slice(0, match.index).split(/\s+/).filter(Boolean)
  if (beforeParts.length < 4) return null
  const perms = beforeParts[0] ?? ''
  let size = 0
  for (let i = beforeParts.length - 1; i >= 0; i -= 1) {
    const n = Number(beforeParts[i])
    if (Number.isInteger(n) && String(n) === beforeParts[i]) {
      size = n
      break
    }
  }
  return { fileType: perms.charAt(0), size, name: line.slice(match.index + match[0].length) }
}

function humanSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)}M`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}K`
  return `${bytes}B`
}

export function cloneMessagesRequest(req: MessagesRequest): MessagesRequest {
  return structuredClone(req) as MessagesRequest
}

export function extractToolResultText(block: Extract<ContentBlock, { type: 'tool_result' }>): string {
  if (typeof block.content === 'string') return block.content
  return block.content.filter(part => part.type === 'text').map(part => part.text).join('\n')
}
