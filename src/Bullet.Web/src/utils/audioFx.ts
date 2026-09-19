// Web Audio API Synthesizer for Bullet Platform
// 100% native in-browser frequency synthesis - zero external audio assets required

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('bullet_sound_enabled');
  // Default to true for high-energy developer experience
  return saved !== 'false';
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('bullet_sound_enabled', enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('bullet_sound_toggled', { detail: enabled }));
}

/**
 * Supersonic laser/bullet zap on shot execution
 * Downward exponential frequency sweep with white noise transient burst
 */
export function playFireSound(): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Oscillator for supersonic beam sweep (880Hz -> 80Hz)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.16);

    oscGain.gain.setValueAtTime(0.18, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.19);

    // 2. High-pass noise pop for muzzle spark
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1200, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.05);
  } catch (err) {
    console.debug('Audio FX suppressed:', err);
  }
}

/**
 * Harmonic sine chime on 2xx OK target impact
 */
export function playImpactSuccessSound(): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Dual harmonic chord: C5 (523.25 Hz) and G5 (783.99 Hz)
    const frequencies = [523.25, 783.99];
    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.03);

      gain.gain.setValueAtTime(0.12, now + index * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35 + index * 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + index * 0.03);
      osc.stop(now + 0.4);
    });
  } catch (err) {
    console.debug('Audio FX suppressed:', err);
  }
}

/**
 * Low-frequency warning buzz on 4xx/5xx or SSL error
 */
export function playImpactErrorSound(): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.setValueAtTime(120, now + 0.1);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  } catch (err) {
    console.debug('Audio FX suppressed:', err);
  }
}

/**
 * Sub-bass sonic boom resonance for opening splash sequence
 */
export function playSonicBoom(): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Sub-bass thump (95Hz -> 28Hz)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.6);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.75);
  } catch (err) {
    console.debug('Audio FX suppressed:', err);
  }
}
