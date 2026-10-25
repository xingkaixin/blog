# 首页唱片机与音乐

曲目：《沙发上的四季》（Seasons from the Sofa），为本站原创的钢琴独奏，F 大调，72 BPM，40 小节，约 2:18。

乐谱在 `src/lib/home-score.ts`，音色在 `src/lib/piano-synth.ts`。录音由这两份代码离线渲染，播放时的画面也按同一份乐谱同步，所以改动乐谱或音色后必须重新渲染并上传，否则画面会和声音对不上。

## 渲染

需要本机装有 ffmpeg：

```bash
bun run music:render /tmp/home-score.mp3
```

脚本输出时长、归一化增益和 SHA-256。峰值统一归一到 -1 dBFS。混响和击弦噪声带随机成分，每次渲染的文件哈希都不同。

## 托管

音频托管在现有公开 R2 bucket（`R2_PHOTO_BUCKET`）的独立 `audio/` 路径：

```text
https://photos.xingkaixin.me/audio/seasons-from-the-sofa/54744e54d4bd1c7f.mp3
```

文件名取 SHA-256 前 16 位。文件为 `audio/mpeg`，使用 `public, max-age=31536000, immutable` 缓存。重新渲染时上传到新路径，再改 `RecordPlayer.astro` 里的地址，不要覆盖已缓存的旧文件。

音乐不进入 Git 和站点构建产物，也不经过照片发布或回收流程。`public/_headers` 的 `media-src` 放行该域名。原生 audio 播放不启用 `crossorigin`，无需修改照片 CORS 配置。

## 播放

点击唱片机播放，唱臂落下后音量渐入到 35%；再次点击暂停，下一次从暂停位置继续，结束后归位。切换页面会停止播放。

播放时 `record-player` 按 `audio.currentTime` 对照乐谱，派发两种事件：

- `record-note`：每个右手旋律音。季节背景从唱片边缘抛出一枚当季粒子，唱片旁的琴键亮起。
- `record-beat`：每一拍。沙发上的角色点头，每小节第一拍唱片周围荡开一圈波纹。

播放时轻点客厅画面，会用同一套音色弹出一个当前和弦内的音，点得越高音越高。

暂停季节动画后不出粒子和波纹。开启减少动态效果后，另外角色不点头、唱片不旋转。琴键与轻点合奏不受这两项影响。
