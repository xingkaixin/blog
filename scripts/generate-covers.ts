#!/usr/bin/env bun
/**
 * 自动生成 src/lib/covers.ts 文件
 * 扫描 src/assets/cover/ 目录中的所有图片文件
 */

import fs from "node:fs";
import path from "node:path";

const COVER_DIR = path.join(process.cwd(), "src", "assets", "cover");
const OUTPUT_FILE = path.join(process.cwd(), "src", "lib", "covers.ts");

// 支持的图片格式
const SUPPORTED_EXTENSIONS = [".webp", ".png", ".jpg", ".jpeg"];

/**
 * 将文件名转换为有效的变量名
 * 例如: "2025-review.webp" -> "c2025Review"
 *       "the-state-of-ai_2025-report.webp" -> "cTheStateOfAi2025Report"
 *       "why-i-pay.png" -> "cWhyIPay"
 */
function filenameToVariableName(filename: string): string {
  // 移除任意支持的扩展名
  const name = filename.replace(/\.(webp|png|jpe?g)$/i, "");

  // 将字符串按分隔符（-、_）分割，然后转换为驼峰命名
  const parts = name.split(/[-_]+/);

  // 首字母大写，其余小写，然后连接
  const camelCase = parts
    .map((part, index) => {
      if (part.length === 0) {
        return "";
      }
      // 如果第一部分以数字开头，保持原样
      if (index === 0 && /^\d/.test(part)) {
        return part;
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");

  // 添加前缀 "c" (cover)
  return `c${camelCase}`;
}

function generateCoversFile(): void {
  // 检查封面图目录是否存在
  if (!fs.existsSync(COVER_DIR)) {
    console.error(`❌ 封面图目录不存在: ${COVER_DIR}`);
    process.exit(1);
  }

  // 获取所有支持的图片文件
  const files = fs
    .readdirSync(COVER_DIR)
    .filter((file) => SUPPORTED_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext)))
    .toSorted();

  if (files.length === 0) {
    console.error(
      `❌ 在 ${COVER_DIR} 中没有找到图片文件 (支持: ${SUPPORTED_EXTENSIONS.join(", ")})`,
    );
    process.exit(1);
  }

  console.log(`📁 找到 ${files.length} 个封面图文件`);

  // 生成 import 语句
  const imports: string[] = [];
  const mappings: string[] = [];

  for (const file of files) {
    const varName = filenameToVariableName(file);

    // 添加 import 语句 (400px, 800px, full)
    // 使用 @/assets/cover/ 路径，vite-imagetools 能正确处理
    imports.push(
      `// @ts-expect-error - vite-imagetools: query params not resolved by TypeScript`,
      `import ${varName}400 from "@/assets/cover/${file}?w=400&as=webp";`,
      `// @ts-expect-error - vite-imagetools: query params not resolved by TypeScript`,
      `import ${varName}800 from "@/assets/cover/${file}?w=800&as=webp";`,
      `import ${varName}Full from "@/assets/cover/${file}?url";`,
    );

    // 添加映射条目
    mappings.push(
      `  "${file}": { full: ${varName}Full, desktop: ${varName}800, mobile: ${varName}400 }`,
    );
  }

  // 生成完整的文件内容
  const content = `export type ResponsiveCover = {
  full: string;
  desktop: string;
  mobile: string;
};

${imports.join("\n")}

export const covers = {
${mappings.join(",\n")},
} as const;

export function resolveCover(path: string): ResponsiveCover | null {
  const filename = path.split("/").pop();
  return filename ? (covers[filename as keyof typeof covers] ?? null) : null;
}
`;

  // 写入文件
  fs.writeFileSync(OUTPUT_FILE, content, "utf8");

  console.log(`✅ 成功生成 ${OUTPUT_FILE}`);
  console.log(`   - 包含 ${files.length} 个封面图映射`);

  // 打印生成的变量名供检查
  console.log("\n📋 生成的变量名:");
  for (const file of files) {
    console.log(`   ${file} -> ${filenameToVariableName(file)}`);
  }
}

// 执行生成
generateCoversFile();
