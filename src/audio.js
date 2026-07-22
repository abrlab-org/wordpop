// audio.js — sound effects generated with the WebAudio API (no asset files),
// plus optional offline speech via speechSynthesis. All calls degrade safely.

export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensureCtx() {
    if (muted) return null;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      // Browsers/platforms may start the context suspended until a gesture.
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  }

  // Play a short tone. type: 'sine'|'square'|'triangle'.
  function tone(freq, start, dur, { type = "sine", gain = 0.2 } = {}) {
    const ac = ensureCtx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + start);
    g.gain.setValueAtTime(0.0001, ac.currentTime + start);
    g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(ac.currentTime + start);
    osc.stop(ac.currentTime + start + dur + 0.02);
  }

  return {
    // Call once on a user gesture to unlock audio.
    unlock() { ensureCtx(); },

    setMuted(v) {
      muted = !!v;
      if (muted && ctx && ctx.state === "running") {
        try { ctx.suspend(); } catch {}
      } else if (!muted && ctx && ctx.state === "suspended") {
        try { ctx.resume(); } catch {}
      }
    },
    isMuted() { return muted; },

    playTap() { tone(440, 0, 0.06, { type: "triangle", gain: 0.12 }); },

    playCorrect() {
      // Cheerful rising arpeggio.
      tone(523, 0.0, 0.12, { type: "triangle", gain: 0.18 });  // C5
      tone(659, 0.10, 0.12, { type: "triangle", gain: 0.18 }); // E5
      tone(784, 0.20, 0.16, { type: "triangle", gain: 0.20 }); // G5
      tone(1047, 0.32, 0.22, { type: "triangle", gain: 0.20 }); // C6
    },

    playWrong() {
      tone(220, 0.0, 0.16, { type: "square", gain: 0.14 });
      tone(180, 0.12, 0.20, { type: "square", gain: 0.14 });
    },

    // Speak the word aloud (offline). No-op if unavailable or muted.
    speak(word) {
      if (muted) return;
      try {
        const synth = window.speechSynthesis;
        if (!synth || typeof SpeechSynthesisUtterance === "undefined") return;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(word);
        u.lang = "en-US";
        u.rate = 0.85;
        u.pitch = 1.05;
        synth.speak(u);
      } catch {
        /* speech unavailable — silently skip */
      }
    },
  };
}
