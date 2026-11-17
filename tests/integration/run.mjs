import fs from 'node:fs'
import vm from 'node:vm'

import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BUNDLE = path.resolve(HERE, '../../dist/main.js')

// 可配置的宿主行为桩
const makeHost = (opts = {}) => {
  const calls = []
  const commands = new Map()
  const state = { saved: null, inputQueue: [...(opts.inputs ?? ['晴天 周杰伦'])], messageResponses: [...(opts.messageResponses ?? [])], savePath: opts.savePath ?? 'D:/out/song.mp3' }
  const cfg = {
    enabledScripts: opts.enabledScripts ?? ['inj'],
    apiBase: opts.apiBase ?? 'https://music-api.gdstudio.xyz/api.php',
    searchSource: 'netease',
    quality: opts.quality ?? '320k',
    fileNameTemplate: opts.template ?? '{name} - {singer}',
    embedCover: opts.embedCover ?? false,
    embedLyric: opts.embedLyric ?? false,
    embedTranslatedLyric: opts.embedTranslatedLyric ?? false,
    importedScriptSources: [],
    enabledSourceLogout: false,
  }
  const host = {
    logcat: { info: () => {}, error: (...a) => calls.push(['ext.error', String(a.join(' ')).slice(0, 120)]), warn: () => {}, debug: () => {} },
    registerResourceAction: (a) => { host.__RA = a },
    request: async (url, ropts) => {
      calls.push(['request', url.slice(0, 200), !!ropts?.needRaw])
      if (opts.requestOverride) return opts.requestOverride(url, ropts)
      if (ropts?.needRaw) {
        const isCover = url.includes('cover') || url.includes('big')
        // 聚合 API 的 pic / lyric 端点返回 JSON
        if (url.includes('types=pic')) {
          return { statusCode: 200, body: { url: 'https://stub.test/cover.jpg' }, raw: new Uint8Array(), headers: {}, history: [url] }
        }
        if (url.includes('types=lyric')) {
          const l = opts.lyricBody ?? { lyric: '[00:01.00]stub', tlyric: '' }
          return { statusCode: 200, body: l, raw: new Uint8Array(), headers: {}, history: [url] }
        }
        if (isCover) {
          const size = opts.coverSize ?? 4096
          const b = new Uint8Array(size)
          b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xe0 // 合法 JPEG 魔数
          return { statusCode: 200, raw: b, body: b, headers: { 'content-type': 'image/jpeg' }, history: [url] }
        }
        const b = new Uint8Array(opts.rawSize ?? 4096)
        b[0] = 0x49; b[1] = 0x44; b[2] = 0x33
        return { statusCode: 200, raw: b, body: b, headers: {}, history: [url] }
      }
      const res = await fetch(url)
      const buf = new Uint8Array(await res.arrayBuffer())
      let body = buf
      try { body = JSON.parse(Buffer.from(buf).toString('utf8')) } catch {}
      return { statusCode: res.status, body, raw: buf, headers: Object.fromEntries(res.headers), history: [url] }
    },
    t: (k, d) => String(k),
    utils: { crypto: {}, iconv: {}, zlib: {}, dataConverter: {}, createIsolateContext: undefined },
    storage: { writeFile: async () => {}, readFile: async () => '', removeFile: async () => {}, listFiles: async () => [], fileExists: async () => false, statFile: async () => null },
    configuration: { getConfigs: async (ks) => ks.map((k) => cfg[k] ?? null), setConfigs: async () => {}, onConfigChanged: () => {} },
    musicUtils: { createProxyUrl: async () => 'x', writeProxyCache: async () => 'x' },
    command: { registerCommand: async (n, f) => { commands.set(n, f); calls.push(['register', n]) }, executeCommand: async () => {}, getCommands: async () => [] },
    app: {
      showMessage: async (m, o) => {
        const btns = (o?.buttons || []).map((b) => b.text)
        calls.push(['msg', String(m).slice(0, 50), btns])
        const r = state.messageResponses.length ? state.messageResponses.shift() : 0
        return r
      },
      showInputDialog: async () => { const v = state.inputQueue.length ? state.inputQueue.shift() : ''; calls.push(['input', v]); return v },
      showOpenDialog: async () => [],
      showSaveDialog: async (o) => { calls.push(['saveDialog', o?.canSelectFolder ?? false, o?.defaultFileName]); return state.savePath },
      readOpenDialogFile: async () => '',
      writeSaveDialogFile: async (p, n, c) => { state.saved = { p, n, len: c?.length }; calls.push(['write', p, JSON.stringify(n), c?.length]); return p },
    },
    env: { clientType: 'desktop', version: '1.4.0', platform: 'win32', arch: 'x64', locale: 'zh-cn', publicKey: '', extensionVersion: '0.1.0', onLocaleChanged: () => () => {} },
    constants: { storageDir: '@s', extensionDir: '@r' },
  }
  return { host, calls, commands, state }
}

const runBundle = (host, scriptSources = { wy: ['128k','320k','flac','flac24bit'] }, media = {}) => {
  let code = fs.readFileSync(BUNDLE, 'utf8')
  const picExpr = media.pic === null ? 'null' : media.pic ? JSON.stringify(media.pic) : "'https://stub.test/cover.jpg'"
  const lyricExpr = media.lyric === null ? 'null' : media.lyric
    ? '({ lyric: ' + JSON.stringify(media.lyric.lyric ?? '') + ', tlyric: ' + JSON.stringify(media.lyric.tlyric ?? '') + ' })'
    : "({ lyric: '[00:01.00]test', tlyric: '' })"
  const inj = `var scripts = [{ id: 'inj', info: { name: 'inj', fileName: 'inj' }, destroy: async () => {}, setEnabledSourceLogout: async () => {}, sources: ${JSON.stringify(scriptSources)}, getMusicUrl: async (mi, t) => 'https://stub.test/a.mp3', getMusicPic: async () => ${picExpr}, getMusicLyric: async () => ${lyricExpr} }]`
  code = code.replace('var scripts = []', inj)
  const sb = {
    require: (n) => { if (n === 'any-listen') return host; throw new Error('no ' + n) },
    console: { log: () => {}, error: () => {}, warn: () => {}, debug: () => {}, info: () => {} },
    setTimeout, clearTimeout, setInterval, clearInterval, AbortController,
    Promise, JSON, Math, Date, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set, URL,
    TextDecoder, TextEncoder, URLSearchParams, Uint8Array, ArrayBuffer, Buffer, fetch,
  }
  sb.globalThis = sb
  sb.module = { exports: {} }
  sb.exports = sb.module.exports
  vm.runInContext(code, vm.createContext(sb), { filename: 'main.js', timeout: 30000 })
  return sb
}

const results = []
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail })
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' :: ' + detail))
}

// ---- 阶段二：输入与搜索 ----
{
  const { host, calls, commands } = makeHost({ inputs: [''] })
  runBundle(host)
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const searched = calls.some((c) => c[0] === 'request' && !c[2])
  check('空白输入不发搜索请求', !searched, 'unexpected search: ' + JSON.stringify(calls.filter((c) => c[0] === 'request')))
}
{
  const { host, calls, commands } = makeHost({ inputs: ['晴天'] })
  runBundle(host)
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const req = calls.find((c) => c[0] === 'request' && !c[2])
  check('单曲名仍发起搜索', !!req, 'no request')
  check('单曲名不拼歌手', req && !decodeURIComponent(req[1]).includes('周杰伦'), req ? req[1] : '')
}
{
  // 用桩精确模拟空结果：真实歌名会被模糊匹配，无法稳定构造空结果
  const { host, calls, commands } = makeHost({ inputs: ['晴天 周杰伦'], requestOverride: async (url, o) => {
    if (o?.needRaw) return { statusCode: 200, raw: new Uint8Array([73,68,51]), body: null, headers: {}, history: [url] }
    return { statusCode: 200, body: [], raw: new Uint8Array(), headers: {}, history: [url] }
  } })
  runBundle(host)
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const noResult = calls.some((c) => c[0] === 'msg' && String(c[1]).includes('noResult'))
  check('搜索无结果提示正确', noResult, JSON.stringify(calls.filter((c) => c[0] === 'msg')))
}
{
  const { host, calls, commands } = makeHost({ inputs: ['晴天 周杰伦'], requestOverride: async () => { throw new Error('network down') } })
  runBundle(host)
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const failed = calls.some((c) => c[0] === 'msg' && String(c[1]).includes('searchFailed'))
  check('断网提示搜索失败', failed, JSON.stringify(calls.filter((c) => c[0] === 'msg')))
}
{
  const { host, calls, commands } = makeHost({ inputs: ['晴天 周杰伦'], requestOverride: async (url, o) => {
    if (o?.needRaw) return { statusCode: 200, raw: new Uint8Array([73,68,51]), body: null, headers: {}, history: [url] }
    return { statusCode: 503, body: [], raw: new Uint8Array(), headers: {}, history: [url] }
  } })
  runBundle(host)
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const searches = calls.filter((c) => c[0] === 'request' && !c[2]).length
  check('非 200 重试 3 次', searches === 3, 'tries=' + searches)
}

// ---- 阶段三：候选与分页 ----
{
  const { host, calls, commands } = makeHost({ inputs: ['晴天 周杰伦'] })
  runBundle(host)
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const pick = calls.find((c) => c[0] === 'msg' && String(c[1]).includes('pickRange'))
  check('候选页最多 5 个候选按钮', pick && pick[2].length <= 8, pick ? JSON.stringify(pick[2]) : 'no pick')
  check('候选含取消按钮', pick && pick[2].some((t) => t.includes('cancel')), '')
}

// ---- 阶段四：音质与下载 ----
for (const q of ['128k', '320k', 'flac', 'flac24bit']) {
  const { host, calls, commands, state } = makeHost({ inputs: ['晴天 周杰伦'], quality: q })
  runBundle(host, { wy: ['128k','320k','flac','flac24bit'] })
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const sd = calls.find((c) => c[0] === 'saveDialog')
  const done = calls.find((c) => c[0] === 'msg' && String(c[1]).includes('done'))
  const ext = q.startsWith('flac') ? '.flac' : '.mp3'
  check('音质 ' + q + ' 默认文件名后缀正确', sd && String(sd[2]).endsWith(ext), sd ? String(sd[2]) : 'no save')
  check('音质 ' + q + ' 落盘成功', !!state.saved, 'no write')
}
{
  const { host, calls, commands, state } = makeHost({ inputs: ['晴天 周杰伦'], savePath: '' })
  runBundle(host)
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  check('取消另存为不写入', !state.saved, 'unexpected write')
  check('取消另存为不报错', !calls.some((c) => c[0] === 'msg' && String(c[1]).includes('failed')), '')
}
{
  const { host, calls, commands } = makeHost({ inputs: ['晴天 周杰伦'], enabledScripts: [] })
  runBundle(host)
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const noScript = calls.some((c) => c[0] === 'msg' && String(c[1]).includes('noScript'))
  const inputShown = calls.some((c) => c[0] === 'input')
  check('无音源脚本时提示且不弹输入', noScript && !inputShown, JSON.stringify(calls.map((c) => c[0])))
}
{
  const { host, calls, commands } = makeHost({ inputs: ['晴天 周杰伦'], requestOverride: async (url, o) => {
    if (o?.needRaw) return { statusCode: 500, raw: new Uint8Array(), body: null, headers: {}, history: [url] }
    const res = await fetch(url); const buf = new Uint8Array(await res.arrayBuffer())
    let body = buf; try { body = JSON.parse(Buffer.from(buf).toString('utf8')) } catch {}
    return { statusCode: res.status, body, raw: buf, headers: {}, history: [url] }
  } })
  runBundle(host)
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const dlFail = calls.some((c) => c[0] === 'msg' && String(c[1]).includes('downloadFailed'))
  check('下载 HTTP 500 有明确报错', dlFail, JSON.stringify(calls.filter((c) => c[0] === 'msg').map((c) => c[1])))
}

// ---- 阶段五：稳定性 ----
{
  const { host, calls, commands } = makeHost({ inputs: ['晴天 周杰伦','晴天 周杰伦','晴天 周杰伦'] })
  runBundle(host)
  await new Promise((r) => setTimeout(r, 250))
  const dl = commands.get('downloadMusic')
  for (let i = 0; i < 3; i++) await dl()
  const writes = calls.filter((c) => c[0] === 'write').length
  check('连续下载 3 次均落盘', writes === 3, 'writes=' + writes)
}

// ---- 阶段六：封面与歌词元数据 ----
{
  const { host, calls, commands, state } = makeHost({ inputs: ['晴天 周杰伦'], embedCover: true })
  runBundle(host, undefined, {})
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const write = calls.find((c) => c[0] === 'write')
  check('封面开启时写入字节大于原始音频', write && write[3] > 4096, 'written=' + (write ? write[3] : 'none'))
}
{
  const { host, calls, commands } = makeHost({ inputs: ['晴天 周杰伦'], embedCover: false, embedLyric: false })
  runBundle(host, undefined, {})
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const write = calls.find((c) => c[0] === 'write')
  check('全部关闭时写入字节等于原始音频', write && write[3] === 4096, 'written=' + (write ? write[3] : 'none'))
}
{
  const { host, calls, commands } = makeHost({ inputs: ['晴天 周杰伦'], embedLyric: true })
  runBundle(host, undefined, {})
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const write = calls.find((c) => c[0] === 'write')
  check('歌词开启时音频被写入且字节增加', write && write[3] > 4096, 'written=' + (write ? write[3] : 'none'))
}
{
  const { host, calls, commands, state } = makeHost({ inputs: ['晴天 周杰伦'], embedCover: true, coverSize: 409600 })
  runBundle(host, undefined, { pic: 'https://stub.test/cover-big.jpg' })
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const write = calls.find((c) => c[0] === 'write')
  check('封面超过 300KB 时跳过附件', write && write[3] === 4096, 'written=' + (write ? write[3] : 'none'))
  check('封面超限时音频仍落盘', !!state.saved, 'not saved')
}
{
  const { host, calls, commands, state } = makeHost({ inputs: ['晴天 周杰伦'], embedLyric: true, lyricBody: { lyric: '', tlyric: '' } })
  runBundle(host, undefined, {})
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const write = calls.find((c) => c[0] === 'write')
  check('歌词缺失时音频仍落盘', !!state.saved, 'not saved')
  check('歌词缺失时写入字节等于原始音频', write && write[3] === 4096, 'written=' + (write ? write[3] : 'none'))
}

{
  const { host, calls, commands } = makeHost({ inputs: ['晴天 周杰伦'] })
  runBundle(host, undefined, {})
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const searching = calls.find((c) => c[0] === 'msg' && String(c[1]).includes('searching'))
  check('搜索前给出非模态提示', !!searching, JSON.stringify(calls.filter((c) => c[0] === 'msg').map((c) => c[1])))
}

{
  const { host, calls, commands } = makeHost({ inputs: ['晴天 周杰伦'] })
  runBundle(host, undefined, {})
  await new Promise((r) => setTimeout(r, 250))
  await commands.get('downloadMusic')()
  const searches = calls.filter((c) => c[0] === 'request' && !c[2] && String(c[1]).includes('types=search'))
  const first = searches[0]
  check('首屏只请求 10 条', first && decodeURIComponent(String(first[1])).includes('count=10'), first ? first[1] : 'none')
  check('首屏不预先请求第二页', searches.every((s) => !decodeURIComponent(String(s[1])).includes('pages=2')), 'prefetched page 2')
}

const failed = results.filter((r) => !r.pass)

console.log('')
console.log('TOTAL', results.length, 'PASS', results.length - failed.length, 'FAIL', failed.length)
fs.writeFileSync(path.resolve(HERE, '../../.integration-results.json'), JSON.stringify(results, null, 2))
process.exit(failed.length ? 1 : 0)