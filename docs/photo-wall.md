# 照片墙

照片墙页面位于 `/photos/`。浏览器只读取公开的 WebP 和 JSON Catalog，原始照片不会进入代码库或前端。

## 存储结构

```text
catalog/index.json
catalog/months/2026-04.<revision>.json
media/<photo-id>/<media-revision>/480.webp
media/<photo-id>/<media-revision>/960.webp
media/<photo-id>/<media-revision>/2048.webp
```

- `photo-id` 是原始文件内容的 128 位 SHA-256 前缀，同一文件重复发布不会生成重复照片。
- 月份分片和图片使用不可变缓存；`catalog/index.json` 使用短缓存，并通过条件写避免并发发布互相覆盖。
- 新上传的图片在月份记录中保存 `mediaRevision`，每次重新发布或提交重试使用新版本路径。
  月份分片每次写入也使用新路径，即使内容相同也不复用，以免已过期的回收任务删除新产物。
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

移除照片时必须提供原始照片文件，并显式添加 `--confirm`。发布器会先从公开
Catalog 移除照片，再分别记录 Retired Photo 的 WebP 与不再被引用的 Retired Artifact。
回收器确认公开索引已撤下引用后，对象至少再保留 25 小时，确保仍持有旧 Catalog
缓存的访问者不会遇到 404。公开索引更新失败时不会开始计时；后续命令会重试同步：

```bash
bun run photos:delete -- ~/Pictures/Japan/favorite.heic --confirm
```

发布与删除会顺带回收到期对象，也可以显式运行：

```bash
bun run photos:gc -- --confirm
```

被替换的月份分片和目录提交失败前已经上传的对象也会进入同一回收流程。回收进度与失败
对象保存在 Catalog/命令输出中；即使某个对象暂时删除失败，重复运行也会从未完成记录继续。

如果原始文件已经不存在，可以先从月份 Catalog 中确认照片 ID，再使用本地脚本或
Cloudflare 控制台处理；不要只删除 WebP，否则 Catalog 会留下坏链接。

支持 DNG、HEIC、HEIF、JPEG、PNG 与 WebP。发布器会先建立源文件快照，内容 ID、EXIF
和像素衍生物始终来自同一文件状态。源文件上限为 256 MiB，解码上限为一亿像素。
在 macOS 上 HEIC 优先使用系统 `sips`，再回退到保留安全限制的 `heif-convert`；其他
系统需要能从 `PATH` 调用 `heif-convert`。每次外部解码最长运行 60 秒，中间文件与源
快照都写在系统临时目录，并在单张照片处理完成后删除。

### 发布器升级

月份 Catalog v2 保留对 v1 的读取兼容；没有 `mediaRevision` 的旧照片仍使用
`media/<photo-id>/<尺寸>.webp`，无需搬迁已有图片。先部署新版站点，再使用新版发布器；
旧版站点无法读取 v2 月份。所有发布和回收进程都应升级，停止旧版本进程后再运行新版命令。
控制文档在下次写入时升级为 v3，使旧发布器拒绝继续写入；新版仍能读取 v1、v2 控制文档。
新回收记录的 `deleteAfter` 为 `null`，确认公开索引已更新后才写入回收时间。旧控制文档中的
待回收记录会重新确认公开索引并等待完整宽限期，因此首次升级可能延后回收，但不会搬迁图片。

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
