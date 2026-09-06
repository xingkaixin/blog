# 照片墙背景

背景资源放在 `src/assets/photo-backgrounds/`，由 Vite 输出带指纹的资源 URL。
`photography.webp` 用于总览、全部照片和未配置背景的相册。地区文件名对应公共 catalog 的相册 ID；卡片和合集页面共用同一张图。

这些图片是装饰插画，不属于照片目录，也不参与照片发布流程。背景不承载内容，使用 `aria-hidden` 隐藏于辅助技术，并适配浅色、深色和手机布局。

## 生成方式

使用内置 `image_gen` 工具生成，无参考图。原始 PNG 转换为质量 82 的 WebP。统一采用近白纸底、石墨与低饱和水彩，边缘放置元素，中央留白。

### 摄影背景最终提示词

```text
Use case: stylized-concept. Asset type: decorative background for a personal photography archive website, landscape 3:2. Create a delicate graphite and muted watercolor illustration on near-white #fafaf7 paper. Photography elements: vintage unbranded camera in lower left, curled film strip and contact print borders along lower right, subtle lens rings near upper right. Wide empty center, motifs only along outer edges, restrained grey graphite with tiny faded vermilion details. Refined travel sketchbook feel, low contrast, no text, no lettering, no watermark, no UI, no photos inside the contact prints. Background must support overlaid photo cards and text.
```

### 地区背景最终提示词

每个地区使用下面的完整模板，将 `{scene}` 替换为表格中的描述。

```text
Use case: stylized-concept. Asset type: decorative regional background for a personal photography album website, landscape 3:2. Primary request: {scene}. Delicate graphite and muted watercolor travel sketch on near-white #fafaf7 paper. Fine architectural lines, atmospheric restrained grey, pale natural local colors and tiny faded vermilion accents. Place characteristic motifs around the lower corners and outer edges; keep central 60 percent mostly empty paper for overlaying actual photographs. Recognizable location, refined hand-drawn detail, soft low contrast but legible landmark silhouettes. No text, no lettering, no watermark, no frame, no UI. This is a background illustration, not a photo or poster.
```

| 文件名（不含 `.webp`） | scene                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| bangkok                | Bangkok: Wat Arun riverside spires and a long-tail boat                                               |
| chiang-mai             | Chiang Mai: Lanna temple roofs, forested mountains and tropical leaves                                |
| chongqing              | Chongqing: layered hillside buildings, river bridge and a cable car                                   |
| harbin                 | Harbin: Saint Sophia Cathedral domes, snow and bare winter branches                                   |
| himeji                 | Himeji: the white tiered roofs of Himeji Castle and pine branches                                     |
| ho-chi-minh            | Ho Chi Minh City: French colonial central post office architecture, motor scooters and tropical trees |
| hong-kong              | Hong Kong: Victoria Harbour skyline, a traditional junk sailboat and mountain ridges                  |
| kamakura               | Kamakura: Great Buddha silhouette, seaside railway and hydrangeas                                     |
| kobe                   | Kobe: red lattice Port Tower, waterfront and Rokko mountains                                          |
| kyoto                  | Kyoto: Yasaka pagoda, traditional tiled roofs and maple branches                                      |
| macau                  | Macau: Ruins of Saint Paul's facade and Portuguese wave-pattern paving                                |
| ningbo                 | Ningbo: traditional Jiangnan tiled roofs, riverfront and a stone arch bridge                          |
| osaka                  | Osaka: Osaka Castle rooftops and Dotonbori canal bridge, without signs                                |
| pattaya                | Pattaya: sweeping tropical bay, palms and a small fishing boat                                        |
| suzhou                 | Suzhou: classical garden pavilion, scholar rocks and willow beside canal                              |
| taiwan                 | Taiwan: Taipei 101 silhouette, layered green mountains and traditional temple roof                    |
| tokyo                  | Tokyo: recognizable red Tokyo Tower, dense low-rise rooftops and a few cherry blossom branches        |
| yangzhou               | Yangzhou: Slender West Lake Five Pavilion Bridge and weeping willows                                  |
| yokohama               | Yokohama: waterfront Landmark Tower, red brick warehouse and Ferris wheel                             |
