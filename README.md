# WRSeal

一个可直接用于网页的**中文圆体 webfont**，按 `unicode-range` 预切分、可自托管、**无需任何第三方 CDN**。

字体家族名：**`WRSeal`** · 两档字重：**Regular 400 / Bold 700**

> **它是什么**：寒蝉全圆体 [ChillRoundF v3.200](https://github.com/Warren2060/ChillRound)（SIL OFL 1.1）的**子集化改名版**。
> 即 OFL-1.1 意义上的 **Modified Version** —— 改名不是偏好，是**许可要求**（详见 [§4](#4-为什么必须改名许可要求不是偏好)）。
> 本仓库把这件事**做完并留在产物里**：你拿到的每一个文件内部都已经改好名，不用再碰上游字体、不用重复改名。

---

## 1. 快速使用

### 方式 A：直接拿 `dist/`（最省事）

把整个 `dist/` 目录复制到你的站点（例如 `assets/wrseal/`），然后：

```html
<link rel="stylesheet" href="/assets/wrseal/font.css">
```

```css
body { font-family: "WRSeal", system-ui, sans-serif; }
```

`dist/font.css` 里 **266 条 `@font-face`**，浏览器**只下载页面上真正用到的那几片**（每片约 28 KB），
没碰到的分片一个字节都不会请求。所以"总共 7.9 MB"不等于"首屏 7.9 MB"。

> ⚠️ **`font.css` 必须与 `regular/`、`bold/` 保持同级**。CSS 里的引用是相对路径 `url("./regular/xxx.woff2")`，
> 挪动目录结构会 404 —— 而 404 的表现是**静默回落系统字体**，页面不报错，很难发现。

### 方式 B：npm

```bash
npm install wrseal
```

```js
import 'wrseal/dist/font.css';
```

（npm 包里**只含 `dist/`**，不含 `src/` 的 12.6 MB 源字体，见 `package.json` 的 `files`。）

### 方式 C：作为 git submodule

```bash
git submodule add https://github.com/<你的用户名>/WRSeal.git vendor/wrseal
```

---

## 2. 仓库结构

| 路径 | 内容 | 体积 |
| --- | --- | --- |
| `src/` | **已改名的完整字体** `WRSeal-Regular.ttf` / `WRSeal-Bold.ttf`（未切分，全字符集） | 12.6 MB |
| `dist/` | 已切分的 266 个 woff2 + 入口 `font.css` | 7.9 MB |
| `tools/` | `fonts.js`（改名 / 合并 / 导出 name 表）、`verify.js`（合规自检） | 20 KB |
| `LICENSE.txt` | **SIL OFL 1.1 全文**，逐字取自上游，未改一字 | 4.4 KB |

**`src/` 是复用根基**：它是"从此不用再改上游"的那一件。任何项目都能从它按自己的字符集重新切分（见 [§3](#3-从-src-重新切分)），
而**不需要**再走一遍改名（已经改好了）。

---

## 3. 从 `src/` 重新切分

如果你的字符集与本仓库的默认切分策略差得远（比如大量生僻字、或只要几百个常用字），从 `src/` 重切：

```bash
npx cn-font-split run -i src/WRSeal-Regular.ttf -o mydist/regular --css.fontFamily WRSeal --css.fontWeight 400
npx cn-font-split run -i src/WRSeal-Bold.ttf    -o mydist/bold    --css.fontFamily WRSeal --css.fontWeight 700
# 产物里的 index.html / index.proto / reporter.bin 是工具副产品，删掉
```

**只切分、不再改名**——`src/` 的 name 表已经是 `WRSeal`，切分工具会把 name 表抄进每个分片。
切完可以跑 `node tools/verify.js` 复核（需把 `dist/` 指到你自己的输出目录，或直接照 [§6](#6-合规声明与自检) 的清单手查）。

---

## 4. 为什么必须改名（许可要求，不是偏好）

上游 `LICENSE.txt` 第一行就是：

```
© 2023 ChillType, with Reserved Font Name 'ChillRoundF' 'ChillRoundM'.
```

`'ChillRoundF'` 与 `'ChillRoundM'` 是 **Reserved Font Name（RFN）**。OFL-1.1 **条件 3** 规定：
**修改版不得使用 RFN**（"This restriction only applies to the primary font name as presented to the users."）。

而"为网页投递做子集化"**属于修改**——这不是我们的解读，是 SIL 的官方口径：

| 出处 | 原文要点 |
| --- | --- |
| [OFL-FAQ §2.6](https://openfontlicense.org/ofl-faq/) | 「给 webfont 做子集化算修改吗？——**算**。为投递到浏览器而移除字体任何部分（未用字形、智能排版代码）都算修改。OFL 允许这么做，但通常**不允许再用 RFN**。」 |
| [Webfonts and Reserved Font Names](https://openfontlicense.org/webfonts-and-reserved-font-names/) | 「Pre-subsetting …… 无法保留功能等价（FE），因此**必须视为修改版**，RFN 限制适用。」 |
| OFL-FAQ §2.2.1 | 只有"除 WOFF 压缩外原始字体数据完全未变、且元数据原样保留"的**纯格式转换**才可以不改名 —— 子集化不属于此列。 |

所以本仓库的做法是：**在切分之前**先把源 TTF 的 `name` 表改成 `WRSeal`，再交给切分工具，
这样改名会**传导进每一个分片内部**（而不仅停在文件名上）。

同时**原样保留**版权声明（nameID 0）、许可描述（13）、许可 URL（14）、设计者（9）、制造商（8）等字段
（OFL 条件 2 要求随附声明），只在 **description（nameID 10）** 末尾追加一句"改了什么"
（OFL-FAQ §5.3 允许在 description 里注明出处）。

---

## 5. 从上游重建（审计路径）

`src/` 里的字体是**可复现**的。任何人不信任本仓库的产物，都可以自己从上游重建并比对：

```bash
# 1) 取上游（本仓库不存上游原件，避免仓库里出现带保留名的文件）
#    https://github.com/Warren2060/ChillRound/releases/tag/v3.200
#    → ChillRoundF_v3.200.zip    sha256 = 7A061E39CC8F377CE122F0AE68D1FE3EF43D78431388362C61EA8D695722D267
#    解出 ChillRoundFRegular.ttf / ChillRoundFBold.ttf

# 2) 改名（OFL 保留字体名条款，必须在切分之前）
node tools/fonts.js rename <src>/ChillRoundFRegular.ttf src/WRSeal-Regular.ttf WRSeal Regular 400 full
node tools/fonts.js rename <src>/ChillRoundFBold.ttf    src/WRSeal-Bold.ttf    WRSeal Bold    700 full

# 3) 导出 name 表核对（期望：含保留字体名的不同取值 0 条）
node tools/fonts.js dump src/WRSeal-Regular.ttf

# 4) 切分 + 合并（同 §3；合并用 node tools/fonts.js merge，含逐片存在性校验 + RFN 残留扫描）
```

> `rename` 的第 6 个参数写进 nameID 3（UniqueID）：`src/` 是未切分的完整字体，所以传 `full`；
> 子集产物传 `subset`。**别谎报自己是子集**——这个字段存在的意义就是让人一眼看出手上这份是什么。

**已发布产物的哈希**（可 `sha256sum` 直接比对）：

| 文件 | 字节 | SHA-256 |
| --- | --- | --- |
| `src/WRSeal-Regular.ttf` | 6 205 504 | `60A2D44C87DE52A9558CE45BA1B10899B0B996D9D756CC343A13013F60D51FD2` |
| `src/WRSeal-Bold.ttf` | 7 004 324 | `CFD831966A2DE1B53889FA995A9EBEFCB570C5AF62C5D61FFC4C6895E5316C6C` |
| `dist/font.css` | 227 445 | `CFB17BC470025F76540D739B2F89E0F713366CA337E434BB8CC4D967E167D31D` |
| `LICENSE.txt` | 4 375 | `D45891F8ADFD21368C98E803603DF1F575FF3FC4A6EC713BA7CCF0E3CBA15B28` |

> **唯一不可复现的字段**是 `dist/font.css` 头部注释里的生成时间戳（每次生成都不同）。
> 其余产物是确定的：本仓库的 266 片与 zzcsapi 项目里同源那份的片数、体积逐一吻合。

---

## 6. 合规声明与自检

本仓库是 OFL-1.1 的 **Modified Version**，**整体以 SIL OFL 1.1 分发**（条件 5：不得换任何其他许可）。
你可以自由使用、修改、再分发、随商业产品一起打包**或出售**，但：

- **不得单独售卖字体本身**（条件 1）；
- 每份副本必须随附 `LICENSE.txt`（条件 2）；
- 修改版**不得使用** `ChillRoundF` / `ChillRoundM` 这两个保留名（条件 3）；
- 不得用上游作者名义为本修改版背书（条件 4）；
- 你的修改版也必须继续以 OFL 分发（条件 5）。

跑一行就能机械核验上述状态：

```bash
node tools/verify.js
```

它会**真解压每一个 woff2**（Brotli）把分片**内部**的 name 表挖出来逐条核 —— 而不是在压缩字节上搜字符串
（那样永远搜不到，是**假通过**）。当前结果：

```
✓ 全部通过（25 项）
```

其中几条值得单独说：

- **266/266 分片**解压后都不含保留字体名；
- **266/266 分片**的 name 表都带着原始版权声明（nameID 0）—— 条件 2 要的是"每一份副本"；
- **0/266 分片**带许可描述（nameID 13）—— 切分工具**会丢掉**它。
  这就是为什么根目录的 `LICENSE.txt` 是**承重件**而不是装饰：它是条件 2 的唯一保障，**删掉它就是真违约**。

---

## 7. 已知限制（说清楚，别踩）

- **只有 Regular(400) / Bold(700) 两档**，没有 Light / Medium / Black。层级请靠字重与字号区分。
- **没有等宽变体、没有衬线变体**。代码块与数值列做不到严格等宽（这是字体本身的限制）；
  数字对齐请用 `font-variant-numeric: tabular-nums`。
- **默认切分按上游全字符集**（含大量生僻字与繁体），共 266 片 / 7.9 MB。
  如果你的站点字符集很窄，按 [§3](#3-从-src-重新切分) 重切能显著变小。
- **`font-display: swap`** 已写在 `@font-face` 里，首屏会先用系统字体再替换。
- 字体**不含** emoji 彩色字形，emoji 仍由系统字体渲染。

---

## 8. 血统

```
小杉圆体 Kosugi Maru (MOTOYA)  ┐
jf open 粉圆 (justfont)        ├─→  寒蝉全圆体 ChillRoundF v3.200 (ChillType / Warren2060)  ─→  WRSeal
猫啃糖圆体 (Maoken)            ┘                                                              （本仓库，仅改名 + 子集化）
西文 Varela Round (Joe Prince) ┘
```

上游：<https://github.com/Warren2060/ChillRound> · 采用版本 **v3.200（2024-05-09）**

---

## 9. 许可

字体软件：**SIL Open Font License 1.1** —— 全文见 [`LICENSE.txt`](LICENSE.txt)。
版权归原作者：`© 2023 ChillType, with Reserved Font Name 'ChillRoundF' 'ChillRoundM'.`
上游血统中各字体的权利归各自作者（见 `LICENSE.txt` 与字体内嵌的 name 表）。

`tools/` 下的脚本是本仓库自写的工具代码，同样以 OFL-1.1 分发以便与字体保持一致的再分发条件。
