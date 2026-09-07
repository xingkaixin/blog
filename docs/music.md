# 关于页唱机与音乐授权

曲目：Stoic Morning — Kevin MacLeod (incompetech.com)。

- ISRC：USUAN1100061
- 授权：Creative Commons Attribution 4.0
- 曲目来源：https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100061
- 作者授权说明：https://incompetech.com/agent-section/
- 使用说明：https://incompetech.com/music/royalty-free/faq.html
- 许可证：https://creativecommons.org/licenses/by/4.0/
- 核对日期：2026-09-07
- 原始 MP3 SHA-256：`43e9639741ee30d1f1540c3dc7233a0b89944ee899189725fd880d0f5334ba7d`

音频未剪辑或转码。署名在关于页的“音乐信息”中，带来源与许可证链接。

音频托管在现有公开 R2 bucket（`R2_PHOTO_BUCKET`）的独立 `audio/` 路径：

```text
https://photos.xingkaixin.me/audio/stoic-morning/43e9639741ee30d1.mp3
```

文件为 `audio/mpeg`，使用 `public, max-age=31536000, immutable` 缓存。文件名包含原始内容哈希前缀；更换录音时上传新路径，避免覆盖缓存中的旧文件。

音乐不进入 Git 和站点构建产物，也不经过照片发布或回收流程。代码直接引用公开 URL，`public/_headers` 的 `media-src` 放行该域名。原生 audio 播放不启用 `crossorigin`，无需修改现有照片 CORS 配置。

恢复原始文件时从作者官网下载，并核对上面的 SHA-256：

```bash
curl -fL 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Stoic%20Morning.mp3' -o /tmp/stoic-morning.mp3
```

点击播放，唱臂落下后音量渐入到 35%；再次点击暂停，唱臂收回；下一次从暂停位置继续。结束后归位。切换页面会停止播放，移除组件时清理事件和动画帧。开启减少动态效果后唱片不旋转，唱臂直接切换位置，仍可播放音乐。
