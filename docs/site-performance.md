# 访问性能

主站使用 Workers Static Assets，照片使用 R2 自定义域名。域名规则与 Workers 部署分开管理。

## 缓存

- `/_astro/` 的构建资源使用内容哈希文件名，由 `public/_headers` 设置一年 `immutable`
  缓存。修改内容必须生成新文件名，不能覆盖同一个 URL。
- `/cover/`、`/posts/images/`、`/fonts/`、搜索索引和 HTML 不套用这条长期缓存。
- HTML 与 Markdown 通过 `Accept` 协商，Worker 为页面响应添加 `Vary: Accept`。
  `cloudflare.config.ts` 让页面先执行 Worker，图片、字体、JS 等资源直接由 Assets 返回。
  不启用 Worker 整体响应缓存或全站 Cache Everything，避免 HTML 与 Markdown 混用。
- Workers 原生处理构建产物中的 `_headers`、`_redirects` 和 `404.html`。
- R2 公开目录的 Cache Rule、Smart Tiered Cache 和验证方式见 [照片墙](photo-wall.md#配置-r2)。

执行 `bun run build` 后，用 `cf deploy --prebuilt --dry-run` 检查 Workers 部署产物。
Astro 开发服务器和 `bun run preview` 不模拟 Worker、`_headers` 或 `_redirects`；这些行为需在
Workers 部署后检查，包括 HTML／Markdown、HEAD、旧文章重定向、404 与静态资源缓存头。

## 监测

主站仅使用 Umami。Cloudflare Web Analytics 不再注入，原有历史统计数据保留。
[blog-analytics-rule.json](../config/blog-analytics-rule.json) 为 `xingkaixin.me`、
`www.xingkaixin.me` 和 `blog.xingkaixin.me` 设置 `disable_rum: true`，防止域名级注入恢复。
规则由 Cloudflare 控制台独立管理，Worker 部署不会应用此文件；其他子站保持原状。

部署后，在首次加载和站内跳转后确认 Umami 正常上报，且没有 Cloudflare beacon。
以首页、文章页和照片墙为样本，结合 Umami 与浏览器性能工具观察加载和交互。
另用大陆电信、联通、移动的实际网络记录 DNS、连接时间、TTFB、首屏时间和访问失败率，
区分首次访问与回访。代理或境外节点的测试不能代表大陆三网速度。

## Umami 阅读统计

生产域名 `xingkaixin.me` 加载一次 Umami，站内导航继续使用 tracker 自带的路径跟踪。
启用 `data-performance` 收集真实访问的性能样本；`data-exclude-hash` 防止目录锚点
和“跳到正文”产生额外页面记录。URL 查询参数继续保留，以便识别 UTM 来源。

- `article-read`：文章页累计处于可见状态至少 30 秒，且视口到达正文一半时上报一次。
  后台标签页时间不累计；切换文章后重新计时。这是有效阅读代理指标，不代表全文读完。
- 通过 [访问统计设置](https://xingkaixin.me/analytics/) 排除自己的浏览器。
  使用 Umami 官方的 `umami.disabled` 本地存储标记，仅影响当前浏览器、当前域名的
  Umami 统计；不修改历史数据。
- 在 Umami Events 查看 `article-read`，结合页面路径与 Organic search 渠道观察阅读。
  新事件会改变后续跳出率口径，不能直接与上线前的跳出率比较。
- 外部分享使用 UTM，例如
  `https://xingkaixin.me/posts/skills-over-mcp/?utm_source=x&utm_medium=social&utm_campaign=skills-over-mcp`。
  内部链接不添加 UTM，避免覆盖真实获客来源。公众号分享可使用
  `utm_source=wechat&utm_medium=social`，项目文档使用 `utm_source=github&utm_medium=referral`。

统计设置页使用 `noindex`，不加入 Sitemap。Sitemap 与文章最后更新时间只使用可靠数据，
不要为了促进抓取而填入部署时间或虚构 `lastmod`。

依据：[Umami tracker 配置](https://docs.umami.is/docs/tracker-configuration)、
[排除自访](https://docs.umami.is/docs/exclude-my-own-visits)。

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
