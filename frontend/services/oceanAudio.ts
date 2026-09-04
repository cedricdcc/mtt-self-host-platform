// Procedural Web Audio API sound synthesizer for deep sea diving & gacha reveals
// Runs client-side with zero external assets; safely handles environments without audio context

class OceanAudioEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playSonarPing(frequency = 750, depthRatio = 0.5): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Lower frequency & higher filter dampening as depth increases
      const pitch = Math.max(300, frequency * (1 - depthRatio * 0.4));
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.65, ctx.currentTime + 0.8);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200 - depthRatio * 600, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {}
  }

  playTrenchDrone(): () => void {
    try {
      const ctx = this.getContext();
      if (!ctx) return () => {};

      // Sub-bass drone for deep water pressure
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(55, ctx.currentTime); // A1 note

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      return () => {
        try {
          gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
          setTimeout(() => {
            try { osc.stop(); } catch {}
          }, 450);
        } catch {}
      };
    } catch {
      return () => {};
    }
  }

  playAnomalyAlert(rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      if (rarity === 'legendary') {
        // Alarming emergency beacon + heavy sub tremor
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(440, ctx.currentTime + i * 0.2);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + i * 0.2 + 0.15);

          gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.2);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.18);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.2);
          osc.stop(ctx.currentTime + i * 0.2 + 0.2);
        }
      } else if (rarity === 'epic') {
        // Mysterious violet chime pulse
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.3); // E5

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.7);
      } else if (rarity === 'rare') {
        // Azure high sonar chirp
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.25);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else {
        // Gentle standard sonar blip
        this.playSonarPing(800, 0.4);
      }
    } catch {}
  }

  playCanisterHiss(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      // Filtered noise buffer for steam hiss
      const bufferSize = Math.floor(ctx.sampleRate * 0.3);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2500, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch {}
  }

  playRevealStinger(rarity: string): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const baseNotes: Record<string, number[]> = {
        legendary: [261.63, 329.63, 392.00, 523.25, 659.25, 783.99], // C Major triumphant arpeggio
        epic: [329.63, 440.00, 554.37, 659.25], // E Major chord
        rare: [440.00, 554.37, 659.25], // A chord
        uncommon: [523.25, 659.25],
        common: [587.33]
      };

      const notes = baseNotes[rarity] || baseNotes.common;
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = rarity === 'legendary' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

        const volume = rarity === 'legendary' ? 0.15 : 0.08;
        gain.gain.setValueAtTime(volume, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.9);
      });
    } catch {}
  }
}

export const oceanAudio = new OceanAudioEngine();
