export type QuoteCardTheme = "day" | "night";

export type QuoteCard = {
  quote: string;
  title: string;
  date: string;
  path: string;
  author: string;
  theme: QuoteCardTheme;
};

const palettes = {
  day: {
    bg: "#f8faf9",
    line: "#e4e8e6",
    ink500: "#5f6763",
    ink600: "#474e4b",
    ink700: "#262b29",
    ink800: "#171a19",
    accent: "#c2402f",
  },
  night: {
    bg: "#131715",
    line: "#262d2a",
    ink500: "#99a29e",
    ink600: "#bcc3c0",
    ink700: "#d3d8d6",
    ink800: "#ecefed",
    accent: "#e5644e",
  },
};

// 卡片按 540×675 的设计稿坐标绘制，导出时放大两倍
const WIDTH = 540;
const HEIGHT = 675;
const SCALE = 2;
const PAD_X = 48;
const QUOTE_SIZES = [34, 32, 30, 28, 26, 24, 22];
const QUOTE_LINE_HEIGHT = 1.42;
const BREAK_BEFORE_FORBIDDEN = new Set("，。、；：？！”’）》」』…—,.;:?!)%".split(""));

export function wrapText(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string[] {
  const tokens = text.match(/[A-Za-z0-9][A-Za-z0-9'’._-]*|\s+|./gsu) ?? [];
  const lines: string[] = [];
  let line = "";
  for (const token of tokens) {
    if (/^\s+$/u.test(token)) {
      line = line ? `${line} ` : line;
      continue;
    }
    const next = line + token;
    if (!line.trim() || measure(next) <= maxWidth || BREAK_BEFORE_FORBIDDEN.has(token)) {
      line = next;
      continue;
    }
    lines.push(line.trimEnd());
    line = token;
  }
  if (line.trim()) {
    lines.push(line.trimEnd());
  }
  return lines;
}

function graphemes(text: string): string[] {
  return Array.from(
    new Intl.Segmenter("zh", { granularity: "grapheme" }).segment(text),
    ({ segment }) => segment,
  );
}

function clampLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) {
    return lines;
  }
  const kept = lines.slice(0, Math.max(maxLines, 1));
  kept.push(
    `${graphemes(kept.pop() ?? "")
      .slice(0, -1)
      .join("")}…`,
  );
  return kept;
}

function truncate(text: string, maxWidth: number, measure: (value: string) => number): string {
  const characters = graphemes(text);
  while (characters.length > 1 && measure(characters.join("")) > maxWidth) {
    characters.splice(-2, 2, "…");
  }
  return characters.join("");
}

export function textFragmentUrl(pageUrl: string, quote: string): string {
  // 文本片段语法用 - 和 , 分隔参数，引文里的这两个字符必须转义
  return `${pageUrl}#:~:text=${encodeURIComponent(quote).replaceAll("-", "%2D")}`;
}

export function quoteCitation(
  card: Pick<QuoteCard, "quote" | "title" | "author">,
  url: string,
): string {
  return `“${card.quote}”\n—— ${card.author}《${card.title}》\n${url}`;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

export async function renderQuoteCard(card: QuoteCard): Promise<Blob> {
  const meta = `${card.date} · ${card.path}`;
  const [logo] = await Promise.all([
    loadImage("/logo.svg"),
    document.fonts.load('34px "Smiley Sans Oblique"', `“${card.quote}`),
    document.fonts.load("14px Outfit", card.title),
    document.fonts.load('11px "JetBrains Mono"', `xingkaixin.me${meta}`),
    document.fonts.load('28px "Dancing Script"', card.author),
  ]);
  const colors = palettes[card.theme];
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = HEIGHT * SCALE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D is unavailable");
  }
  context.scale(SCALE, SCALE);
  context.fillStyle = colors.bg;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.textBaseline = "top";

  // 夜色里 logo 跟站点一样倒过来
  context.save();
  context.translate(PAD_X + 11, 44 + 11);
  context.rotate(card.theme === "night" ? Math.PI : 0);
  context.drawImage(logo, -11, -11, 22, 22);
  context.restore();
  context.font = '11px "JetBrains Mono"';
  context.fillStyle = colors.ink500;
  context.fillText("xingkaixin.me", PAD_X + 32, 49);

  const contentWidth = WIDTH - PAD_X * 2;
  context.font = '28px "Dancing Script"';
  const signatureWidth = context.measureText(card.author).width;
  context.font = "14px Outfit";
  const titleLines = clampLines(
    wrapText(
      card.title,
      contentWidth - signatureWidth - 24,
      (value) => context.measureText(value).width,
    ),
    2,
  );
  const metaTop = HEIGHT - 40 - 14;
  const titleTop = metaTop - 6 - titleLines.length * 21;
  const ruleY = titleTop - 20;

  context.fillStyle = colors.line;
  context.fillRect(PAD_X, ruleY, contentWidth, 1);
  context.fillStyle = colors.ink700;
  titleLines.forEach((line, index) => context.fillText(line, PAD_X, titleTop + index * 21 + 2));
  context.font = '10.5px "JetBrains Mono"';
  context.fillStyle = colors.ink500;
  context.fillText(
    truncate(meta, contentWidth - signatureWidth - 24, (value) => context.measureText(value).width),
    PAD_X,
    metaTop + 1,
  );
  context.font = '28px "Dancing Script"';
  context.fillStyle = colors.ink600;
  context.textAlign = "right";
  context.textBaseline = "alphabetic";
  context.fillText(card.author, WIDTH - PAD_X, HEIGHT - 44);
  context.textAlign = "left";
  context.textBaseline = "top";

  const markHeight = 44;
  const markGap = 14;
  const areaTop = 96;
  const areaHeight = ruleY - 32 - areaTop;
  const measureQuote = (value: string) => context.measureText(value).width;
  let size = 0;
  let lines: string[] = [];
  for (size of QUOTE_SIZES) {
    context.font = `${size}px "Smiley Sans Oblique"`;
    lines = wrapText(card.quote, contentWidth, measureQuote);
    if (lines.length * size * QUOTE_LINE_HEIGHT <= areaHeight - markHeight - markGap) {
      break;
    }
  }
  const lineHeight = size * QUOTE_LINE_HEIGHT;
  lines = clampLines(lines, Math.floor((areaHeight - markHeight - markGap) / lineHeight));
  const blockTop = areaTop + (areaHeight - (markHeight + markGap + lines.length * lineHeight)) / 2;

  context.font = '72px "Smiley Sans Oblique"';
  context.fillStyle = colors.accent;
  context.fillText("“", PAD_X - 4, blockTop - 6);
  context.font = `${size}px "Smiley Sans Oblique"`;
  context.fillStyle = colors.ink800;
  lines.forEach((line, index) =>
    context.fillText(
      line,
      PAD_X,
      blockTop + markHeight + markGap + index * lineHeight + (lineHeight - size) / 2,
    ),
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Quote card export failed"))),
      "image/png",
    );
  });
}
