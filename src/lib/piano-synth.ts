/**
 * 合成钢琴：带轻微失谐的泛音叠加，低通随余音收暗，再加一点击弦噪声和卷积混响。
 * 首页录音由它离线渲染，轻点合奏时也用同一套音色。
 */

export interface Piano {
  play(midi: number, time: number, duration: number, velocity: number): void;
}

export function createPiano(ctx: BaseAudioContext, level = 1): Piano {
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 12;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.25;
  const output = ctx.createGain();
  output.gain.value = level;
  const bus = ctx.createGain();
  bus.gain.value = 0.36;
  const reverb = ctx.createConvolver();
  reverb.buffer = roomImpulse(ctx, 3.2);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  bus.connect(compressor);
  bus.connect(reverb);
  reverb.connect(wet);
  wet.connect(compressor);
  compressor.connect(output);
  output.connect(ctx.destination);

  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
  const noiseData = noise.getChannelData(0);
  for (let index = 0; index < noiseData.length; index++) {
    noiseData[index] = Math.random() * 2 - 1;
  }

  return {
    play(midi, time, duration, velocity) {
      const frequency = 440 * 2 ** ((midi - 69) / 12);
      // 低音余音长、高音短
      const decay = Math.min(4.5, Math.max(0.35, 2.4 * (220 / frequency) ** 0.55));
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(1, time + 0.005);
      envelope.gain.setTargetAtTime(0, time + 0.005, decay);
      envelope.gain.setTargetAtTime(0, time + duration, 0.12);
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.Q.value = 0.3;
      tone.frequency.setValueAtTime(Math.min(16000, frequency * (2.5 + velocity * 6) + 600), time);
      tone.frequency.setTargetAtTime(Math.max(frequency * 1.6, 260), time + 0.02, decay * 0.6);
      tone.connect(envelope);
      envelope.connect(bus);

      const loudness = velocity ** 1.5;
      const end = time + duration + 0.9;
      const partial = (hz: number, amplitude: number, fade: number) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.frequency.value = hz;
        gain.gain.setValueAtTime(amplitude * loudness, time);
        if (fade > 0) {
          gain.gain.setTargetAtTime(0, time, fade);
        }
        oscillator.connect(gain);
        gain.connect(tone);
        oscillator.start(time);
        oscillator.stop(end);
      };
      const count = frequency > 1000 ? 3 : frequency > 500 ? 5 : 6;
      for (let n = 1; n <= count; n++) {
        // 琴弦的非谐性让高次泛音略微偏高
        const hz = frequency * n * Math.sqrt(1 + 0.0004 * n * n);
        if (n === 1) {
          partial(hz, 1, 0);
        } else {
          partial(hz, (0.55 / n ** 1.2) * (0.4 + velocity * 0.8), decay / (n * 0.9));
        }
      }
      partial(frequency * 1.0008, 0.35, 0);

      const hammer = ctx.createBufferSource();
      hammer.buffer = noise;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = Math.min(5000, Math.max(800, frequency * 3));
      const strike = ctx.createGain();
      strike.gain.setValueAtTime(velocity * 0.04, time);
      strike.gain.setTargetAtTime(0, time, 0.008);
      hammer.connect(band);
      band.connect(strike);
      strike.connect(bus);
      hammer.start(time);
    },
  };
}

function roomImpulse(ctx: BaseAudioContext, seconds: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  const preDelay = Math.floor(ctx.sampleRate * 0.015);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let smoothed = 0;
    for (let index = preDelay; index < length; index++) {
      // 一阶低通压掉白噪声的嘶声
      smoothed += 0.3 * (Math.random() * 2 - 1 - smoothed);
      data[index] = smoothed * (1 - index / length) ** 2.8;
    }
  }
  return impulse;
}
