/**
 * Lightweight, zero-dependency audio synthesizer using standard Web Audio API.
 * Synthesizes a clean two-tone chime for kitchen ticket arrivals and alerts.
 * Adheres to ponytail principle: zero external mp3 assets, zero network latency.
 */
export function playKitchenChime() {
  if (typeof window === 'undefined') return

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    // Pleasant two-pitch chime: F5 (698.46Hz) -> A5 (880Hz)
    osc.frequency.setValueAtTime(698.46, now)
    osc.frequency.setValueAtTime(880, now + 0.1)

    // Smooth envelope with fast attack and natural exponential decay
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.4)
  } catch {
    // Autoplay policy or unsupported audio environment; degrade gracefully
  }
}
