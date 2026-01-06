(function () {
  window.Tutor = window.Tutor || {};

  // Force voice list to populate on some browsers
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = function () {};
  }

  function pickVoice() {
    if (!window.speechSynthesis) return null;

    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;

    // Strong preference: US English only
    const usVoices = voices.filter((v) => /^en-US/i.test(v.lang || ""));

    const pool = usVoices.length ? usVoices : voices;

    // Prefer common US male-ish system voices
    const preferred = pool.find((v) =>
      /google us|microsoft|sam|fred/i.test(v.name || "")
    );

    return preferred || pool[0];
  }

  class TTS {
    static getWakeWord() {
      const cfg = window.Tutor && window.Tutor.Config;
      return String(cfg?.speech?.wakeWord || "COMPUTER").toUpperCase();
    }

    static speak(text) {
      const raw = String(text || "").trim();
      if (!raw) return;
      if (!window.speechSynthesis) return;

      window.speechSynthesis.cancel();

      const wakeWord = TTS.getWakeWord();

      const re = new RegExp(
        "^(?:" + wakeWord + "|COMPUTER)\\s*[:\\-]?\\s*(.*)$",
        "i"
      );

      const m = raw.match(re);
      const voice = pickVoice();

      const rest = (m[1] || "").trim();

      // Wake word — deliberate, clear
      const uWake = new SpeechSynthesisUtterance(wakeWord.toLowerCase());
      uWake.voice = voice || null;
      uWake.rate = 0.6;
      uWake.pitch = 0.7;
      uWake.volume = 2.0;

      // Command — steady, friendly
      const uRest = new SpeechSynthesisUtterance(rest);
      uRest.voice = voice || null;
      uRest.rate = 0.4;
      uRest.pitch = 0.7;
      uRest.volume = 1.0;

      uWake.onend = () => {
        setTimeout(() => {
          window.speechSynthesis.speak(uRest);
        }, 550);
      };

      window.speechSynthesis.speak(uWake);
    }
  }

  Tutor.TTS = TTS;
})();
