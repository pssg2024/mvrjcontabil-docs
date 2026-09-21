// Web Audio API Sound Generator for Internal Calls (Zero external assets needed)

let audioCtx: AudioContext | null = null;
let ringOscillators: { osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null = null;
let ringInterval: any = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Toca o toque de chamada recebida (estilo telefone executivo agradável)
 */
export function startIncomingRingtone() {
  stopCallSounds();
  try {
    const ctx = getAudioContext();
    
    const playRingBurst = () => {
      if (!audioCtx || audioCtx.state === 'closed') return;
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, now); // A4
      osc2.frequency.setValueAtTime(480, now); // B4

      gain.gain.setValueAtTime(0, now);
      // Ring pulse 1
      gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.8);
      gain.gain.linearRampToValueAtTime(0, now + 0.85);

      // Ring pulse 2
      gain.gain.linearRampToValueAtTime(0.12, now + 1.1);
      gain.gain.linearRampToValueAtTime(0.12, now + 1.8);
      gain.gain.linearRampToValueAtTime(0, now + 1.85);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.9);
      osc2.stop(now + 1.9);
    };

    playRingBurst();
    ringInterval = setInterval(playRingBurst, 3500);
  } catch (e) {
    console.warn('AudioContext not allowed yet:', e);
  }
}

/**
 * Toca o tom de chamada saintes (Tuuu... Tuuu...)
 */
export function startOutgoingDialTone() {
  stopCallSounds();
  try {
    const ctx = getAudioContext();

    const playTone = () => {
      if (!audioCtx || audioCtx.state === 'closed') return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(425, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.08, now + 1.0);
      gain.gain.linearRampToValueAtTime(0, now + 1.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.1);
    };

    playTone();
    ringInterval = setInterval(playTone, 3000);
  } catch (e) {
    console.warn('AudioContext not allowed yet:', e);
  }
}

/**
 * Toca som rápido de encerramento / ocupado
 */
export function playEndCallTone() {
  stopCallSounds();
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.3);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    // ignore
  }
}

/**
 * Toca som rápido de conexão estabelecida
 */
export function playConnectedTone() {
  stopCallSounds();
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Duas notas ascendentes agradáveis
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.12); // E5

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.22);
    gain.gain.linearRampToValueAtTime(0, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  } catch (e) {
    // ignore
  }
}

/**
 * Para qualquer som em reprodução
 */
export function stopCallSounds() {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
  if (ringOscillators) {
    try {
      ringOscillators.osc1.stop();
      ringOscillators.osc2.stop();
    } catch {}
    ringOscillators = null;
  }
}
