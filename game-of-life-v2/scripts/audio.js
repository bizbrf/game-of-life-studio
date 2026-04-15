// Ambient audio hum and step sound.

import { state, audioState } from "./state.js";

export function getAudioContext() {
  // Safari 14.1+ supports the unprefixed AudioContext (14.0 still required
  // the webkit prefix). The webkitAudioContext fallback is dead code for
  // effectively all current targets.
  const Ctor = window.AudioContext;
  if (!Ctor) return null;
  if (!audioState.context) audioState.context = new Ctor();
  return audioState.context;
}

export function syncAudioState() {
  const context = getAudioContext();
  if (!context) return;
  if (!state.sound) {
    if (audioState.humGain) audioState.humGain.gain.setTargetAtTime(0.0001, context.currentTime, 0.05);
    return;
  }
  if (!audioState.humOscillator) {
    audioState.humOscillator = context.createOscillator();
    audioState.humGain = context.createGain();
    audioState.humOscillator.type = "triangle";
    audioState.humOscillator.frequency.value = 72;
    audioState.humGain.gain.value = 0.0001;
    audioState.humOscillator.connect(audioState.humGain).connect(context.destination);
    audioState.humOscillator.start();
  }
  audioState.humGain.gain.setTargetAtTime(state.simulating ? 0.008 : 0.0012, context.currentTime, 0.08);
}

export function emitStepSound(birthCount) {
  if (!state.sound) return;
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 380 + Math.min(120, birthCount * 8);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.015, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.09);
}
