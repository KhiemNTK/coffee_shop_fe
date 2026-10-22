let audio: AudioContext | undefined

function getAudioContext() {
  if (typeof window === 'undefined') return
  if (!audio || audio.state === 'closed') {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (AudioContextClass) audio = new AudioContextClass()
  }
  return audio
}

export async function enableNotificationSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return false
    if (ctx.state !== 'running') await ctx.resume()
    return audio?.state === 'running'
  } catch {
    return false
  }
}

export function playNotificationChime() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return false
    if (ctx.state !== 'running') {
      void ctx.resume().catch(() => {})
      return false
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
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }

    osc.start(now)
    osc.stop(now + 0.4)
    return true
  } catch {
    return false
  }
}
