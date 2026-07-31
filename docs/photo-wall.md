# 照片墙

照片墙页面位于 `/photos/`。浏览器只读取公开的 WebP 和 JSON Catalog，原始照片不会进入代码库或前端。

## 存储结构

```text
catalog/index.json
catalog/months/2026-04.<content-hash>.json
media/<photo-id>/480.webp
media/<photo-id>/960.webp
media/<photo-id>/2048.webp
```

- `photo-id` 是原始文件内容的 128 位 SHA-256 前缀，同一文件重复发布不会生成重复照片。
- 月份分片和图片使用不可变缓存；`catalog/index.json` 使用短缓存，并且总是最后写入。
- 相册是 Catalog 中的逻辑关系，不依赖 R2 目录。把同一照片再次发布到另一个相册，只会更新索引。
- 当前发布器只生成公开展示版本，不上传原始文件。

## 配置 R2

1. 创建一个 R2 bucket，并为它创建仅限该 bucket 的 Object Read & Write S3 API 凭据。
2. 在 bucket 的 Public access 设置中绑定 `photos.xingkaixin.me` 自定义域名。生产环境不要使用 `r2.dev` 地址。
3. 应用只读 CORS：

   ```bash
   bunx wrangler r2 bucket cors set "$R2_PHOTO_BUCKET" --file config/photo-r2-cors.json
   bunx wrangler r2 bucket cors list "$R2_PHOTO_BUCKET"
   ```

4. 根据 `.env.example` 配置本地环境变量和 Cloudflare Pages 的
   `PUBLIC_PHOTO_BASE_URL`。如果更换照片域名，还需要同步修改 `public/_headers` 中
   CSP 的 `connect-src` 与 `img-src`。

Cloudflare 的相关说明：

- [公开 bucket 与自定义域名](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- [S3 API 与 JavaScript SDK](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)

## 发布照片

发布一个目录：

```bash
bun run photos:publish -- ~/Pictures/Japan \
  --album japan-2026 \
  --album-title "日本旅行" \
  --timezone Asia/Tokyo
```

发布器优先使用照片自己的 EXIF 时区。只有相机没有写入时区时，才会使用
`--timezone`；两者都没有时会停止，而不是猜测系统时区。

再次发布同一照片可以追加相册：

```bash
bun run photos:publish -- ~/Pictures/Japan/favorite.heic \
  --album favorites \
  --album-title "喜欢"
```

移除照片时必须提供原始照片文件，并显式添加 `--confirm`。发布器会先更新
Catalog，再清理对应的 WebP 和旧月份索引：

```bash
bun run photos:delete -- ~/Pictures/Japan/favorite.heic --confirm
```

如果原始文件已经不存在，可以先从月份 Catalog 中确认照片 ID，再使用本地脚本或
Cloudflare 控制台处理；不要只删除 WebP，否则 Catalog 会留下坏链接。

支持 DNG、HEIC、HEIF、JPEG、PNG 与 WebP。在 macOS 上 HEIC 使用系统 `sips` 解码，并以
`heif-convert --disable-limits` 作为后备；其他系统需要能从 `PATH` 调用
`heif-convert`。中间 PNG 写在系统临时目录，并在单张照片处理完成后删除。

## 本地预览

本地目标和 R2 目标使用同一个发布器：

```bash
bun run photos:publish -- ~/Downloads/IMG_7616.heic ~/Downloads/IMG_7608.heic \
  --album preview \
  --album-title "预览" \
  --output public/photo-preview

PUBLIC_PHOTO_BASE_URL=/photo-preview bun run dev
```

`public/photo-preview` 已被 Git 忽略。删除它不会影响 R2。
