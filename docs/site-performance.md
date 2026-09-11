# 访问性能

主站继续使用 Pages，照片使用 R2 自定义域名。Cloudflare 域名规则与 Pages 部署分开管理。

## 缓存

- `/_astro/` 的构建资源使用内容哈希文件名，由 `public/_headers` 设置一年 `immutable`
  缓存。修改内容必须生成新文件名，不能覆盖同一个 URL。
- `/cover/`、`/posts/images/`、`/fonts/`、搜索索引和 HTML 不套用这条长期缓存。
- HTML 与 Markdown 通过 `Accept` 协商，保留 Pages Functions 和 `Vary: Accept`。
  不对全站设置 Cache Everything，以免混用响应或使新部署失效。
- R2 公开目录的 Cache Rule、Smart Tiered Cache 和验证方式见 [照片墙](photo-wall.md#配置-r2)。

本地执行 `bun run build` 后，可用 `wrangler pages dev dist --port 8788` 验证真实的
Pages 响应头。Astro 开发服务器不会模拟 `_headers`。

## 监测

Cloudflare Web Analytics 由 Pages 项目的 Metrics 设置统一开启并注入，源码不再手动
加载 Cloudflare beacon。保留 Umami 的独立访问统计。不要再为同一主站叠加域名级自动注入。
本地预览没有 Pages 自动注入的 beacon，属于预期行为。

域名级自动注入原先覆盖所有子域名。通过 Configuration Rule
`Keep Pages analytics as the single blog beacon`，仅为 `xingkaixin.me`、`www.xingkaixin.me`
和 `blog.xingkaixin.me` 设置 `disable_rum: true`，排除边缘自动注入；Pages 已注入的脚本继续上报。
规则定义在 [blog-analytics-rule.json](../config/blog-analytics-rule.json)，由 Cloudflare 控制台
单独管理，Pages 部署不会应用此文件。其他子站及历史统计站点保持原状。
需要回滚时停用该 Configuration Rule；若 Pages Metrics 仍开启，重复注入也会恢复。

部署后，在首次加载和站内跳转后分别确认只有一个 Cloudflare beacon 脚本，并确认
Web Analytics 能收到页面数据。保留原有历史统计站点，不删除旧数据。

以首页、文章页和照片墙为样本，在 Web Analytics 中按 China、设备和 URL 查看 P75 LCP、
INP、CLS 及样本量。优化前后使用相同的时间窗口，至少覆盖工作日和晚高峰。
另用大陆电信、联通、移动的实际网络记录 DNS、连接时间、TTFB、首屏时间和访问失败率，
区分首次访问与回访。脚本未能加载的访问不会出现在 RUM 中，不能用 RUM 代替可用性检查。
代理或境外节点的测试只能验证资源行为，不能代表大陆三网速度。

## 字体

中文字体 CSS 使用 `media="print"` 下载，加载完成后切换为 `all`，保留
`font-display: swap` 与系统回退字体。它不再阻塞首次屏幕渲染。
`transition:persist` 在 Astro 页面跳转时保留已启用的样式表；禁用 JavaScript 时由
`noscript` 提供普通样式表。英文正文和等宽字体保持原加载方式。

验证时检查浏览器 Resource Timing 的 `renderBlockingStatus`，并检查直接打开文章、
从首页跳转到文章和禁用 JavaScript 后的标题字体。不要把减少阻塞资源误记为字体字节数减少。

Cloudflare 产品依据：[Pages 缓存](https://developers.cloudflare.com/pages/configuration/serving-pages/)、
[Pages Web Analytics](https://developers.cloudflare.com/pages/how-to/web-analytics/)、
[Configuration Rules 的 RUM 设置](https://developers.cloudflare.com/rules/configuration-rules/settings/#disable-real-user-monitoring-rum)、
[RUM 指标筛选](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/)。

## 2026-09-11 验证记录

- 公开照片目录规则与 Smart Tiered Cache 已在 Cloudflare 控制台启用，并通过 API 回读确认。
- 线上索引和月份分片均观察到 `MISS` 后的 `HIT`，各自的原始缓存头保持不变。
- 本地 Pages 验证了带哈希资源的一年缓存，以及 HTML／Markdown 的正确内容类型和 `Vary: Accept`。
- 浏览器确认中文字体 CSS 为 `non-blocking`，文章跳转后保持启用且没有重复下载该 CSS。
  禁用本地字体和禁用 JavaScript 的回退路径也已检查。
- `bun run isok` 通过，包括 61 个测试文件、381 项测试、生产构建和生成数据一致性检查。
- 生产部署 `85696937-2e52-457e-b5d2-6b56020ec89f` 对应 `main` 提交 `3336e5e`，部署成功。
- 线上抽查 CSS、JS、WOFF2 均返回 `public, max-age=31536000, immutable`；HTML、搜索索引
  和 Markdown 保持 `max-age=0, must-revalidate`，封面仍为一天缓存。
- 照片索引观察到 `UPDATING` 后的 `HIT`，月份分片命中 `HIT`，CORS 正确；浏览器照片墙正常加载。
- 线上浏览器确认中文字体 CSS 为 `non-blocking`，站内跳转后仍启用且只有一次下载。
- 部署验收发现 Pages 和域名级注入仍然重叠，已补充上述 Configuration Rule 并通过 API 回读确认。
  修正后首页和站内跳转后的文章页都只有一个 Cloudflare beacon，Pages token 的 RUM 上报返回
  `204`，Umami 上报返回 `200`。
- 当前网络经过代理，观测到的边缘节点为 SIN；大陆三网速度及优化后的大陆 RUM 数据仍需实际样本验证。
