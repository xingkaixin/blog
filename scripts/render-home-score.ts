#!/usr/bin/env bun
/// <reference lib="dom" />
/**
 * 把首页钢琴曲的乐谱离线渲染成 MP3，需要本机装有 ffmpeg。
 * 用法：bun run music:render [输出路径]；上传方式见 docs/music.md。
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { OfflineAudioContext } from "node-web-audio-api";
import { homeSong } from "../src/lib/home-score";
import { createPiano } from "../src/lib/piano-synth";

const SAMPLE_RATE = 44100;
// 峰值归一到 -1 dBFS
const TARGET_PEAK = 0.89;

function encodeWav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const view = new DataView(new ArrayBuffer(44 + frames * channels * 2));
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + frames * channels * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frames * channels * 2, true);
  const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let peak = 0;
  for (const samples of data) {
    for (const sample of samples) {
      peak = Math.max(peak, Math.abs(sample));
    }
  }
  const gain = TARGET_PEAK / peak;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      view.setInt16(
        44 + (frame * channels + channel) * 2,
        data[channel][frame] * gain * 0x7fff,
        true,
      );
    }
  }
  return { wav: new Uint8Array(view.buffer), gain };
}

export async function renderHomeScore(output: string) {
  const ctx = new OfflineAudioContext(2, Math.ceil(homeSong.duration * SAMPLE_RATE), SAMPLE_RATE);
  const piano = createPiano(ctx);
  for (const note of homeSong.notes) {
    piano.play(note.midi, note.time, note.duration, note.velocity);
  }
  const { wav, gain } = encodeWav(await ctx.startRendering());
  const temporary = path.join(os.tmpdir(), `home-score-${process.pid}.wav`);
  fs.writeFileSync(temporary, wav);
  try {
    const result = Bun.spawnSync(
      [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-i",
        temporary,
        "-codec:a",
        "libmp3lame",
        "-q:a",
        "4",
        output,
      ],
      { stderr: "inherit" },
    );
    if (result.exitCode !== 0) {
      throw new Error("ffmpeg 转码失败");
    }
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  const hash = createHash("sha256").update(fs.readFileSync(output)).digest("hex");
  console.log(`✅ ${output}`);
  console.log(`   - 时长 ${homeSong.duration.toFixed(1)} 秒，增益 ${gain.toFixed(3)}`);
  console.log(`   - SHA-256 ${hash}`);
}

if (import.meta.main) {
  await renderHomeScore(path.resolve(process.argv[2] ?? "home-score.mp3"));
}
