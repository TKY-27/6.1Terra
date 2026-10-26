import * as THREE from "three";

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();
function noiseBuffer(audio: AudioContext) {
  let buffer = noiseBuffers.get(audio);
  if (buffer) return buffer;
  buffer = audio.createBuffer(
    1,
    Math.ceil(audio.sampleRate * 0.25),
    audio.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  let seed = 52741;
  for (let i = 0; i < samples.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    samples[i] = seed / 2147483648 - 1;
  }
  noiseBuffers.set(audio, buffer);
  return buffer;
}

export function startAmbient(audio: AudioContext) {
  const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  let value = 0,
    seed = 23119;
  for (let i = 0; i < samples.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    value = value * 0.98 + (seed / 2147483648 - 1) * 0.02;
    samples[i] = value;
  }
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = buffer;
  source.loop = true;
  filter.type = "lowpass";
  filter.frequency.value = 480;
  gain.gain.value = 0.035;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  source.start();
}

/** Synthesized transient with distance attenuation and stereo positioning. */
export function playSound(
  audio: AudioContext,
  kind: string,
  listener: THREE.Vector3,
  yaw: number,
  position?: THREE.Vector3,
  variant = 0,
) {
  const distance = position ? position.distanceTo(listener) : 0;
  if (distance >= 100) return;
  const output = audio.createGain();
  output.gain.value = position ? Math.max(0.001, 1 - distance / 100) : 1;
  if (position) {
    const pan = audio.createStereoPanner();
    const dx = position.x - listener.x,
      dz = position.z - listener.z;
    pan.pan.value = THREE.MathUtils.clamp(
      (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / 35,
      -1,
      1,
    );
    output.connect(pan);
    pan.connect(audio.destination);
  } else output.connect(audio.destination);

  const transient =
    kind === "shoot" ||
    kind === "impact" ||
    kind === "step" ||
    kind === "land" ||
    kind === "explosion";
  if (transient) {
    const noise = audio.createBufferSource(),
      filter = audio.createBiquadFilter(),
      envelope = audio.createGain();
    noise.buffer = noiseBuffer(audio);
    filter.type = kind === "shoot" ? "bandpass" : "lowpass";
    filter.frequency.value =
      kind === "shoot"
        ? [1100, 1700, 750][variant]
        : kind === "impact"
          ? 2100
          : kind === "explosion"
            ? 500
            : 380;
    filter.Q.value = kind === "shoot" ? 0.7 : 0.3;
    const duration =
      kind === "shoot"
        ? [0.1, 0.07, 0.16][variant]
        : kind === "impact"
          ? 0.055
          : kind === "explosion"
            ? 0.24
            : 0.085;
    envelope.gain.setValueAtTime(
      kind === "shoot" ? 0.22 : kind === "explosion" ? 0.28 : 0.09,
      audio.currentTime,
    );
    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      audio.currentTime + duration,
    );
    noise.connect(filter);
    filter.connect(envelope);
    envelope.connect(output);
    noise.start();
    noise.stop(audio.currentTime + duration);
  }
  const frequencies: Record<string, number> = {
    shoot: [90, 125, 70][variant],
    hit: 440,
    pickup: 620,
    jump: 180,
    reload: 260,
    ui: 520,
    scan: 740,
    step: 75,
    impact: 220,
    land: 90,
    explosion: 58,
  };
  const frequency = frequencies[kind] || 300;
  const oscillator = audio.createOscillator(),
    envelope = audio.createGain();
  oscillator.type = kind === "shoot" ? "sine" : "triangle";
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    frequency * 0.5,
    audio.currentTime + 0.12,
  );
  envelope.gain.setValueAtTime(
    kind === "shoot" ? 0.075 : 0.025,
    audio.currentTime,
  );
  envelope.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.13);
  oscillator.connect(envelope);
  envelope.connect(output);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.14);
}
