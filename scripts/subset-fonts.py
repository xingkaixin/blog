# /// script
# requires-python = ">=3.12"
# dependencies = ["fonttools[woff]==4.60.1", "playwright==1.64.1"]
# ///
"""按站点实际渲染的字符、字重与 OpenType 特性裁剪网页字体，每个字体拆成核心与扩展两个文件。

先 `bun run build`，再 `uv run scripts/subset-fonts.py`。脚本用本机 Chrome 打开 dist 的全部页面，
读取每段文字的计算样式，写入 src/assets/fonts/ 并提交。何时需要重跑见 docs/site-performance.md。
"""

import http.server
import re
import socketserver
import threading
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from functools import partial
from io import BytesIO
from pathlib import Path

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
OUT = ROOT / "src" / "assets" / "fonts"
NODE_MODULES = ROOT / "node_modules"

SPACE = 0x20
HYPHEN = 0x2010
ASCII = set(range(0x20, 0x7F))
LATIN = ASCII | set(range(0xA0, 0x180))
# 弯引号、破折号、省略号，以及站内常作分隔符的间隔号
CORE = ASCII | {0x00B7, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026}
# 字体在至少这个比例的页面上可见使用的字符也进入核心文件
CORE_PAGE_SHARE = 0.5
CJK_START = 0x2E80
DEFAULT_FEATURES = {"ccmp", "locl", "mark", "mkmk", "rlig", "calt", "clig", "curs", "dist", "kern", "liga", "rclt"}
VARIANT_FEATURES = {
    "lining-nums": ["lnum"],
    "oldstyle-nums": ["onum"],
    "proportional-nums": ["pnum"],
    "tabular-nums": ["tnum"],
    "diagonal-fractions": ["frac"],
    "stacked-fractions": ["afrc"],
    "ordinal": ["ordn"],
    "slashed-zero": ["zero"],
    "small-caps": ["smcp"],
    "all-small-caps": ["smcp", "c2sc"],
    "sub": ["subs"],
    "super": ["sups"],
    "full-width": ["fwid"],
    "proportional-width": ["pwid"],
}


@dataclass
class Face:
    family: str
    weight: int
    slug: str
    sources: list[Path]
    sheet: str = "fonts.css"
    # OFL 保留字体名的字体修改后不能沿用原名，只改字体内部名称，CSS family 不变。
    rename: str | None = None
    local: str | None = None
    # 只渲染固定文字的字体不把整个 ASCII 放进核心；空格始终保留，浏览器用含空格的字面取行高等主字体度量。
    core_ascii: bool = True
    chars: set[int] = field(default_factory=set)
    features: set[str] = field(default_factory=set)
    hyphenates: bool = False
    pages: dict[str, set[int]] = field(default_factory=lambda: defaultdict(set))


FACES = [
    Face("Outfit", 400, "outfit-400", [NODE_MODULES / "@fontsource/outfit/files/outfit-latin-400-normal.woff2"]),
    Face("Outfit", 500, "outfit-500", [NODE_MODULES / "@fontsource/outfit/files/outfit-latin-500-normal.woff2"]),
    Face(
        "JetBrains Mono",
        400,
        "jetbrains-mono-400",
        [NODE_MODULES / "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2"],
    ),
    Face(
        "Dancing Script",
        400,
        "dancing-script-400",
        [ROOT / "scripts/assets/fonts/dancing-script.ttf"],
        rename="XKX Signature",
        core_ascii=False,
    ),
    Face(
        "Smiley Sans Oblique",
        400,
        "smiley-sans-oblique-400",
        sorted((NODE_MODULES / "cn-fontsource-smiley-sans-oblique-regular").glob("*.woff2")),
        sheet="smiley-sans.css",
        rename="XKX Display",
        local="Smiley Sans Oblique",
    ),
]

COLLECT_TEXT = r"""
() => {
  const runs = [];
  const add = (cs, text, visible = true) => {
    if (!text) return;
    if (cs.textTransform === 'uppercase') text = text.toUpperCase();
    else if (cs.textTransform === 'lowercase') text = text.toLowerCase();
    else if (cs.textTransform === 'capitalize') text += text.toUpperCase();
    runs.push({
      family: cs.fontFamily, weight: cs.fontWeight, text,
      variants: [cs.fontVariantNumeric, cs.fontVariantCaps, cs.fontVariantPosition, cs.fontVariantEastAsian].join(' '),
      settings: cs.fontFeatureSettings, hyphens: cs.hyphens, vertical: !cs.writingMode.startsWith('horizontal'), visible,
    });
  };
  const quoted = (pcs) => {
    let s = '';
    for (const m of pcs.content.matchAll(/"((?:[^"\\]|\\.)*)"|(open|close)-quote|counters?\(/g)) {
      if (m[1] !== undefined) s += m[1].replace(/\\(.)/g, '$1');
      else if (m[2]) s += pcs.quotes === 'auto' ? '“”‘’' : pcs.quotes.replace(/[" ]/g, '');
      else s += '0123456789';
    }
    return s;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node; (node = walker.nextNode()); ) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script,style,noscript,template')) continue;
    add(getComputedStyle(parent), node.nodeValue.replace(/\s+/g, ' ').trim(), parent.getClientRects().length > 0);
  }
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    for (const pseudo of ['::before', '::after', '::marker']) {
      const pcs = getComputedStyle(el, pseudo);
      add(pcs, quoted(pcs));
    }
    if (cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none') add(cs, '…');
    if (el.placeholder) add(getComputedStyle(el, '::placeholder'), el.placeholder);
  }
  return runs;
}
"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args) -> None:
        pass


class Server(socketserver.ThreadingTCPServer):
    # 默认积压队列只有 5，浏览器并发请求时会被重置，样式表加载失败会让计算样式出错。
    request_queue_size = 128
    daemon_threads = True


def page_urls(base: str) -> list[str]:
    urls = []
    for html in sorted(DIST.rglob("*.html")):
        rel = html.relative_to(DIST).as_posix()
        urls.append(f"{base}/{rel.removesuffix('index.html')}")
    return urls


def collect_runs() -> list[dict]:
    handler = partial(QuietHandler, directory=DIST)
    with Server(("127.0.0.1", 0), handler) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_address[1]}"
        runs = []
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="chrome")
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.route(re.compile(r".*\.(avif|webp|png|jpe?g|gif|svg|woff2?|ttf|mp3|mp4)$"), lambda route: route.abort())
            for url in page_urls(base):
                page.goto(url, wait_until="load")
                runs += [{**run, "page": url} for run in page.evaluate(COLLECT_TEXT)]
            browser.close()
        server.shutdown()
    return runs


def match_weight(wanted: int, available: list[int]) -> int:
    """CSS Fonts 4 的字重匹配；全站 font-synthesis: none，所以只会用到已有字面。"""
    if wanted in available:
        return wanted
    lighter = sorted((w for w in available if w < wanted), reverse=True)
    heavier = sorted(w for w in available if w > wanted)
    if 400 <= wanted <= 500:
        within = [w for w in heavier if w <= 500]
        return (within or lighter or heavier)[0]
    return (lighter or heavier)[0] if wanted < 400 else (heavier or lighter)[0]


def requested_features(run: dict, text: set[int]) -> set[str]:
    features = set(DEFAULT_FEATURES)
    for keyword in run["variants"].split():
        features.update(VARIANT_FEATURES.get(keyword, []))
    for tag, value in re.findall(r'"(\w{4})"\s*(\d*)', run["settings"]):
        if value != "0":
            features.add(tag)
    if run["vertical"]:
        features.update({"vert", "vrt2"})
    if 0x2044 in text:
        # HarfBuzz 遇到分数斜线会自动应用这三个特性
        features.update({"frac", "numr", "dnom"})
    return features


def load_source(face: Face) -> TTFont:
    if len(face.sources) == 1:
        return open_font(face.sources[0])
    # cn-fontsource 只发布按 unicode-range 切好的分片，先合并回完整字体再子集化。
    merged = Merger().merge([str(path) for path in face.sources])
    # 各分片的时间戳与包围盒都沿用原字体，合并后照抄，避免 Merger 和保存时重算。
    head = TTFont(face.sources[0])["head"]
    for key in ("created", "modified", "xMin", "yMin", "xMax", "yMax"):
        setattr(merged["head"], key, getattr(head, key))
    merged.recalcTimestamp = merged.recalcBBoxes = False
    return open_font(BytesIO(serialize(merged)))


def assign_runs(runs: list[dict], fonts: dict[str, TTFont]) -> None:
    weights = defaultdict(list)
    for face in FACES:
        weights[face.family].append(face.weight)
    by_key = {(face.family, face.weight): face for face in FACES}
    cmaps = {face.slug: set(fonts[face.slug].getBestCmap()) for face in FACES}
    for run in runs:
        families = [name.strip().strip("\"'") for name in run["family"].split(",")]
        text = {ord(char) for char in run["text"]}
        for family in families:
            if family not in weights:
                break
            face = by_key[(family, match_weight(int(run["weight"]), weights[family]))]
            face.hyphenates |= run["hyphens"] == "auto"
            covered = text & cmaps[face.slug]
            if covered:
                face.chars |= covered
                face.features |= requested_features(run, covered)
                if run["visible"]:
                    face.pages[run["page"]] |= covered
            text -= covered
            if not text:
                break


def rename_font(font: TTFont, family: str) -> None:
    name = font["name"]
    postscript = family.replace(" ", "") + "-Regular"
    for name_id in (16, 17, 18, 21, 22, 25):
        name.removeNames(nameID=name_id)
    for name_id, value in {
        1: family,
        2: "Regular",
        3: f"{postscript};subset",
        4: f"{family} Regular",
        6: postscript,
    }.items():
        name.removeNames(nameID=name_id)
        name.setName(value, name_id, 3, 1, 0x409)


def subset_font(source: TTFont, face: Face, unicodes: set[int], vertical: bool) -> tuple[bytes, set[int]]:
    font = open_font(BytesIO(serialize(source)))
    options = subset.Options()
    options.layout_features = sorted(face.features)
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    # 字体本身没有字形指令；prep 只设置 Windows 的漏点控制，gasp 控制平滑方式，保留以免改变 Windows 渲染。
    options.hinting = True
    options.drop_tables += ["STAT"] + ([] if vertical else ["vhea", "vmtx"])
    # macOS 的 CoreText 会读取字形名，删掉后同一轮廓的光栅化结果会变；源文件有字形名就保留。
    options.glyph_names = source["post"].formatType == 2
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    if face.rename:
        rename_font(font, face.rename)
    # Options.flavor 只在 subset.save_font 里生效，直接 save 会沿用源文件格式（TTF 源会输出未压缩 TTF）。
    font.flavor = "woff2"
    return serialize(font), set(font.getBestCmap())


def open_font(file: Path | BytesIO) -> TTFont:
    # 保存时默认重算 head 的修改时间与包围盒：时间戳让重跑产生无意义的差异，
    # 包围盒变小会让 macOS 的 CoreText 改变字形光栅化位置。
    return TTFont(file, recalcTimestamp=False, recalcBBoxes=False)


def serialize(font: TTFont) -> bytes:
    buffer = BytesIO()
    font.save(buffer)
    return buffer.getvalue()


def unicode_range(codepoints: set[int]) -> str:
    ranges: list[list[int]] = []
    for codepoint in sorted(codepoints):
        if ranges and codepoint == ranges[-1][1] + 1:
            ranges[-1][1] = codepoint
        else:
            ranges.append([codepoint, codepoint])
    return ", ".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in ranges)


def font_face(face: Face, file_name: str, codepoints: set[int]) -> str:
    sources = f"local(\"{face.local}\"), " if face.local else ""
    return (
        "@font-face {\n"
        f'  font-family: "{face.family}";\n'
        "  font-style: normal;\n"
        "  font-display: swap;\n"
        f"  font-weight: {face.weight};\n"
        f'  src: {sources}url("./{file_name}") format("woff2");\n'
        f"  unicode-range: {unicode_range(codepoints)};\n"
        "}\n"
    )


def main() -> None:
    if not DIST.exists():
        raise SystemExit("缺少 dist/，请先运行 bun run build")
    fonts = {face.slug: load_source(face) for face in FACES}
    runs = collect_runs()
    assign_runs(runs, fonts)
    page_count = len({run["page"] for run in runs})
    vertical = any(run["vertical"] for run in runs)

    for stale in OUT.glob("*.woff2"):
        stale.unlink()
    OUT.mkdir(parents=True, exist_ok=True)
    sheets: dict[str, list[str]] = defaultdict(list)
    for face in FACES:
        cmap = set(fonts[face.slug].getBestCmap())
        # hyphens: auto 断词时，Chrome 只在含空格的主字面里找 U+2010，找不到才用 U+002D。
        hyphen = {HYPHEN} if face.hyphenates else set()
        base = (CORE if face.core_ascii else set()) | hyphen
        wanted = (face.chars | LATIN | base) & cmap
        usage = Counter(char for chars in face.pages.values() for char in chars)
        common = {char for char, count in usage.items() if count >= page_count * CORE_PAGE_SHARE}
        core = wanted & ({SPACE} | common | base)
        rest = wanted - core
        # 中文标题每页都会用到少量生僻字；中文另成一个文件，避免这些页面连带下载用不到的 Latin-1 与 Latin Extended-A。
        cjk = {char for char in rest if char >= CJK_START}
        print(f"{face.family} {face.weight}: 使用 {len(face.chars)} 字符，特性 {' '.join(sorted(face.features))}")
        for part, codepoints in (("core", core), ("ext", rest - cjk), ("cjk", cjk)):
            if not codepoints:
                continue
            data, contained = subset_font(fonts[face.slug], face, codepoints, vertical)
            if contained != codepoints:
                raise SystemExit(f"{face.slug}-{part} 字符与预期不符：{unicode_range(contained ^ codepoints)}")
            file_name = f"{face.slug}-{part}.woff2"
            (OUT / file_name).write_bytes(data)
            sheets[face.sheet].append(font_face(face, file_name, contained))
            print(f"  {file_name}: {len(contained)} 字符，{len(data)} B")

    header = "/* 由 scripts/subset-fonts.py 生成，不要手动编辑。 */\n"
    for sheet, rules in sheets.items():
        (OUT / sheet).write_text(header + "\n".join(rules), encoding="utf-8")


if __name__ == "__main__":
    main()
