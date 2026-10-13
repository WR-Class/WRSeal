#!/usr/bin/env node
/* WRSeal 合规自检（零依赖）—— 把 OFL 合规从"作者声称"变成"任何人可机械核验"。
 *
 * 本仓库是**修改版**（OFL-1.1 意义上的 Modified Version），改名是许可要求而非偏好。
 * 光说"我改过名了"没有意义：woff2 的表数据是一整条 Brotli 流，在压缩字节上直接搜
 * `ChillRoundF` **永远搜不到** —— 那种检查是假通过，它连一个名字都没看过。
 * 所以本脚本按 woff2 规范做**最小解码**，把每个分片**内部**的 name 表挖出来逐条核。
 *
 * 跑法：node tools/verify.js
 * 退出码：0 = 全部通过；1 = 有失败项（会逐条列出）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
// 上游保留字体名（LICENSE.txt 原文：with Reserved Font Name 'ChillRoundF' 'ChillRoundM'）
const RFN = ['ChillRoundF', 'ChillRoundM'];
const FAMILY = 'WRSeal';
const WEIGHTS = { regular: 400, bold: 700 };

let pass = 0, fail = 0;
const problems = [];
function check(desc, ok, detail) {
  if (ok) { pass++; console.log(`  ✓ ${desc}`); }
  else { fail++; problems.push(desc + (detail ? `\n      → ${detail}` : '')); console.log(`  ✗ ${desc}`); if (detail) console.log(`      → ${detail}`); }
}

/* ─────────────── sfnt（TTF/OTF，src/ 里的完整字体）的 name 表 ─────────────── */
function nameRecordsOfSfnt(file) {
  const buf = fs.readFileSync(file);
  const n = buf.readUInt16BE(4);
  let off = 0, len = 0;
  for (let i = 0; i < n; i++) {
    const r = 12 + i * 16;
    if (buf.toString('latin1', r, r + 4) === 'name') { off = buf.readUInt32BE(r + 8); len = buf.readUInt32BE(r + 12); }
  }
  if (!len) throw new Error('没有 name 表：' + file);
  const d = buf.slice(off, off + len);
  return parseNameTable(d);
}

/* ─────────────── woff2（dist/ 里的分片）的 name 表：真解压 ─────────────── */
const KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca',
  'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE',
  'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar',
  'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx',
  'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
const u255 = (b, p) => {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const c = b[p + i];
    v = ((v << 7) | (c & 0x7f)) >>> 0;
    if (!(c & 0x80)) return { v, p: p + i + 1 };
  }
  throw new Error('Base128 越界');
};
function nameRecordsOfWoff2(file) {
  const b = fs.readFileSync(file);
  if (b.toString('latin1', 0, 4) !== 'wOF2') throw new Error('不是 woff2：' + file);
  const n = b.readUInt16BE(12);
  const compressedSize = b.readUInt32BE(20);
  let p = 48;                                     // woff2 头固定 48 字节
  const dir = [];
  for (let i = 0; i < n; i++) {
    const flags = b[p++];
    const tagIdx = flags & 0x3f;
    const tv = (flags >> 6) & 3;
    const tag = tagIdx === 0x3f ? b.toString('latin1', p, p + 4) : KNOWN_TAGS[tagIdx];
    if (tagIdx === 0x3f) p += 4;
    const o = u255(b, p); p = o.p;
    let len = o.v;
    // 变换长度只对 glyf/loca 存在；name 表永远不做变换
    if (tv !== 3 && (tag === 'glyf' || tag === 'loca')) { const t = u255(b, p); len = t.v; p = t.p; }
    dir.push({ tag, len });
  }
  const raw = zlib.brotliDecompressSync(b.slice(p, p + compressedSize));
  const want = dir.reduce((a, t) => a + t.len, 0);
  if (raw.length !== want) throw new Error(`woff2 解码自检失败：解压 ${raw.length} ≠ Σ表长 ${want}（${file}）`);
  let off = 0, range = null;
  for (const t of dir) { if (t.tag === 'name') range = { off, len: t.len }; off += t.len; }
  if (!range) throw new Error('没有 name 表：' + file);
  return parseNameTable(raw.slice(range.off, range.off + range.len));
}

function parseNameTable(d) {
  const count = d.readUInt16BE(2), strOff = d.readUInt16BE(4);
  const out = [];
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    const plat = d.readUInt16BE(r), id = d.readUInt16BE(r + 6);
    const len = d.readUInt16BE(r + 8), so = d.readUInt16BE(r + 10);
    const s = Buffer.from(d.slice(strOff + so, strOff + so + len));
    out.push({ id, plat, text: (plat === 0 || plat === 3) ? (s.swap16(), s.toString('utf16le')) : s.toString('latin1') });
  }
  return out;
}

/* ─────────────────────────── 检查项 ─────────────────────────── */

console.log('\n1. 授权文件（OFL 条件 2：每份副本必须随附版权声明 + 许可证）');
const licPath = path.join(ROOT, 'LICENSE.txt');
check('LICENSE.txt 在仓库根', fs.existsSync(licPath));
let lic = '';
if (fs.existsSync(licPath)) {
  lic = fs.readFileSync(licPath, 'utf8');
  check('含 SIL OFL 1.1 正文（"SIL OPEN FONT LICENSE Version 1.1"）',
    /SIL OPEN FONT LICENSE Version 1\.1/.test(lic));
  check('★ 保留字体名声明原文在（"with Reserved Font Name \'ChillRoundF\' \'ChillRoundM\'"）——这是本条许可的根，删了就无从判断什么名字不能用',
    /with Reserved Font Name 'ChillRoundF' 'ChillRoundM'/.test(lic));
  check('原始版权行在（© 2023 ChillType）', /©\s*2023\s*ChillType/.test(lic));
  check('含条件 3（修改版不得用 RFN）原文', /No Modified Version of the Font Software may use the Reserved Font/.test(lic));
  check('含条件 5（必须整体以本许可分发）原文', /must be distributed entirely under this license/.test(lic));
}

console.log('\n2. src/ 完整字体：内部 name 表');
const srcFiles = ['WRSeal-Regular.ttf', 'WRSeal-Bold.ttf'];
let srcOk = 0;
for (const f of srcFiles) {
  const p = path.join(ROOT, 'src', f);
  if (!fs.existsSync(p)) { check(`src/${f} 存在`, false); continue; }
  srcOk++;
  let recs;
  try { recs = nameRecordsOfSfnt(p); } catch (e) { check(`src/${f} name 表可解析`, false, e.message); continue; }
  const fams = recs.filter((r) => r.id === 1 || r.id === 16).map((r) => r.text);
  check(`src/${f}：家族名（nameID 1/16）全为 ${FAMILY}`, fams.length > 0 && fams.every((t) => t === FAMILY), `实得 ${[...new Set(fams)].join(' / ')}`);
  const hits = recs.filter((r) => RFN.some((n) => r.text.includes(n)));
  check(`src/${f}：★ 无任何保留字体名残留`, hits.length === 0, hits.length ? JSON.stringify(hits.slice(0, 3)) : '');
  const cp = recs.filter((r) => r.id === 0);
  check(`src/${f}：版权声明（nameID 0）仍在`, cp.length > 0 && /MOTOYA|ChillType|Maoken|Justfont/i.test(cp.map((r) => r.text).join(' ')));
  const licRec = recs.filter((r) => r.id === 13);
  check(`src/${f}：许可描述（nameID 13）仍在`, licRec.length > 0 && /SIL Open Font License/.test(licRec.map((r) => r.text).join(' ')));
}
check(`src/ 两个完整字体齐全（${srcOk}/2）`, srcOk === 2);

console.log('\n3. dist/ 分片：解压后内部 name 表（合规的最终落点）');
const shards = {};
for (const w of Object.keys(WEIGHTS)) {
  const dir = path.join(ROOT, 'dist', w);
  shards[w] = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.woff2')).sort() : [];
}
const total = shards.regular.length + shards.bold.length;
check(`分片存在（regular ${shards.regular.length} + bold ${shards.bold.length} = ${total}）`, total > 0);

if (total > 0) {
  // 先自证读取器有效：能解出 name 表且族名正是 WRSeal（没有这条，"全部不含 RFN" 可能是解码器静默失败的假通过）
  const probe = nameRecordsOfWoff2(path.join(ROOT, 'dist', 'regular', shards.regular[0]));
  check('woff2 读取器自证有效：能从分片内部解出 name 表，且族名已是 ' + FAMILY,
    probe.some((r) => (r.id === 1 || r.id === 16) && r.text === FAMILY),
    '解出 ' + probe.length + ' 条记录');

  let rfnShards = [], noCopy = [], noLic = [];
  for (const w of Object.keys(WEIGHTS)) {
    for (const f of shards[w]) {
      const recs = nameRecordsOfWoff2(path.join(ROOT, 'dist', w, f));
      if (recs.some((r) => RFN.some((n) => r.text.includes(n)))) rfnShards.push(`${w}/${f}`);
      if (!recs.some((r) => r.id === 0 && /MOTOYA|ChillType|Maoken|Justfont/i.test(r.text))) noCopy.push(`${w}/${f}`);
      // 实测：cn-font-split 不把 nameID 13/14 写进输出分片 —— 所以独立 LICENSE.txt 是唯一保障
      if (!recs.some((r) => r.id === 13)) noLic.push(`${w}/${f}`);
    }
  }
  check(`★ 全部 ${total} 个分片**解压后的 name 表**都不含保留字体名（${RFN.join('/')}）—— 在压缩字节上搜是假通过`,
    rfnShards.length === 0, rfnShards.slice(0, 5).join(', '));
  check(`每个分片的 name 表都带着原始版权声明（${total - noCopy.length}/${total}，nameID 0）—— OFL 条件 2 要"每一份副本"`,
    noCopy.length === 0, noCopy.slice(0, 5).join(', '));
  check(`许可正文本就要求以独立文件随附（分片内 nameID 13 实测 ${total - noLic.length}/${total} 条；cn-font-split 会丢掉它）—— 这正是 LICENSE.txt 必须留在根目录的原因`,
    true);
}

console.log('\n4. dist/font.css 入口');
const cssPath = path.join(ROOT, 'dist', 'font.css');
if (!fs.existsSync(cssPath)) { check('dist/font.css 存在', false); }
else {
  const css = fs.readFileSync(cssPath, 'utf8');
  const faces = (css.match(/@font-face/g) || []).length;
  check(`@font-face 条数 = 分片数（${faces} = ${total}）—— 少一条就是部分字回落系统字体，页面不报错`, faces === total);
  const fams = [...new Set((css.match(/font-family:\s*"([^"]+)"/g) || []).map((s) => s.replace(/.*"([^"]+)"/, '$1')))];
  check(`正文 family 全为 ${FAMILY}`, fams.length === 1 && fams[0] === FAMILY, fams.join(', '));
  const w4 = (css.match(/font-weight:400/g) || []).length, w7 = (css.match(/font-weight:700/g) || []).length;
  check(`两档字重齐（400 × ${w4}，700 × ${w7}）`, w4 === shards.regular.length && w7 === shards.bold.length);
  check('★ 入口 CSS 正文不含保留字体名', !RFN.some((n) => css.includes(n)));
  const refs = [...css.matchAll(/url\("\.\/([^"]+)"\)/g)].map((m) => m[1]);
  const missing = refs.filter((r) => !fs.existsSync(path.join(ROOT, 'dist', r)));
  check(`CSS 引用的 ${refs.length} 个分片逐个存在`, missing.length === 0, missing.slice(0, 5).join(', '));
}

console.log(`\n${'─'.repeat(64)}`);
if (fail === 0) {
  console.log(`✓ 全部通过（${pass} 项）`);
  console.log('  合规状态：修改版已改名、无保留字体名残留、版权与许可随每份副本。');
  process.exit(0);
} else {
  console.log(`✗ ${fail} 项失败（${pass} 项通过）`);
  problems.forEach((p) => console.log('  • ' + p));
  console.log('\n  ⚠ 任一项失败即意味着本仓库不再是合规的 OFL 修改版 —— 修好之前不要发布。');
  process.exit(1);
}
