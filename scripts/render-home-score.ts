#!/usr/bin/env bun
/// <reference lib="dom" />
/**
 * 把首页钢琴曲的乐谱离线渲染成 MP3，需要本机装有 ffmpeg。
 * 用法：bun run music:render [输出路径] [--bed <氛围垫底音频>] [--bed-pitch <移调倍率>]
 * 上传方式见 docs/music.md。
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

export interface RenderOptions {
  bed?: string;
  bedPitch?: number;
}

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

export async function renderHomeScore(output: string, options: RenderOptions = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(homeSong.duration * SAMPLE_RATE), SAMPLE_RATE);
  const piano = createPiano(ctx);
  for (const note of homeSong.notes) {
    piano.play(note.midi, note.time, note.duration, note.velocity);
  }
  const { wav, gain } = encodeWav(await ctx.startRendering());
  const temporary = path.join(os.tmpdir(), `home-score-${process.pid}.wav`);
  fs.writeFileSync(temporary, wav);
  try {
    const ffmpegArgs = options.bed
      ? buildMixedFfmpegArgs(temporary, options.bed, options.bedPitch ?? 1, output)
      : [
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
        ];
    const result = Bun.spawnSync(ffmpegArgs, { stderr: "inherit" });
    if (result.exitCode !== 0) {
      throw new Error("ffmpeg 转码失败");
    }
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  const hash = createHash("sha256").update(fs.readFileSync(output)).digest("hex");
  console.log(`✅ ${output}`);
  console.log(`   - 时长 ${homeSong.duration.toFixed(1)} 秒，增益 ${gain.toFixed(3)}`);
  if (options.bed) {
    console.log(`   - 氛围底轨 ${options.bed}（移调倍率 ${options.bedPitch ?? 1}）`);
  }
  console.log(`   - SHA-256 ${hash}`);
}

function buildMixedFfmpegArgs(
  pianoWav: string,
  bedPath: string,
  bedPitch: number,
  output: string,
): string[] {
  const duration = homeSong.duration.toFixed(3);
  const fadeOutDuration = 11;
  const fadeOutStart = Math.max(0, homeSong.duration - fadeOutDuration).toFixed(3);
  const pitchFilter =
    bedPitch === 1 ? "" : `asetrate=${SAMPLE_RATE}*${bedPitch},aresample=${SAMPLE_RATE},`;
  const filterGraph = [
    "[0:a]equalizer=f=240:t=q:w=1.1:g=1.2,equalizer=f=2900:t=q:w=1.4:g=-1.2,volume=0.98[piano]",
    `[1:a]${pitchFilter}atrim=0:${duration},asetpts=PTS-STARTPTS,highpass=f=95,equalizer=f=310:t=q:w=1.0:g=-4.5,equalizer=f=1100:t=q:w=1.2:g=-3.0,lowpass=f=7200,acompressor=threshold=0.14:ratio=2.5:attack=40:release=350,afade=t=in:st=0:d=4.5:curve=qsin,afade=t=out:st=${fadeOutStart}:d=${fadeOutDuration}:curve=qsin,volume=0.28[bed]`,
    "[piano][bed]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.84:attack=5:release=60[out]",
  ].join(";");
  return [
    "ffmpeg",
    "-y",
    "-loglevel",
    "error",
    "-i",
    pianoWav,
    "-i",
    bedPath,
    "-filter_complex",
    filterGraph,
    "-map",
    "[out]",
    "-codec:a",
    "libmp3lame",
    "-q:a",
    "3",
    output,
  ];
}

function parseCliArgs(args: string[]): { output: string; options: RenderOptions } {
  let output = "home-score.mp3";
  const options: RenderOptions = {};
  for (let index = 0; index < args.length; index++) {
    const token = args[index];
    if (token === "--bed") {
      const value = args[++index];
      if (!value) {
        throw new Error("--bed 需要指定音频路径");
      }
      options.bed = path.resolve(value);
    } else if (token === "--bed-pitch") {
      const value = Number(args[++index]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--bed-pitch 必须是大于 0 的数字");
      }
      options.bedPitch = value;
    } else if (!token.startsWith("--")) {
      output = token;
    }
  }
  return { output: path.resolve(output), options };
}

if (import.meta.main) {
  const { output, options } = parseCliArgs(process.argv.slice(2));
  await renderHomeScore(output, options);
}
