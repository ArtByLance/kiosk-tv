(function () {
  window.Tutor = window.Tutor || {};
  const Tutor = window.Tutor;

  function fitSayTextToPlate(plateEl, textEl, actionsEl, opts) {
    opts = opts || {};
    const minScale = Number(opts.minScale || 0.62); // don’t go smaller than ~62%
    const step = Number(opts.step || 0.03); // shrink per pass

    if (!plateEl || !textEl) return;

    // Reset any previous shrink.
    textEl.style.transform = "";
    textEl.style.transformOrigin = "";

    // After layout, measure and shrink if needed.
    requestAnimationFrame(() => {
      if (!plateEl.isConnected) return;

      const plateH = plateEl.clientHeight || 0;
      const actionsH = actionsEl ? actionsEl.offsetHeight : 0;

      // Compute usable height for the text inside the plate.
      const plateStyle = window.getComputedStyle(plateEl);
      const padTop = parseFloat(plateStyle.paddingTop) || 0;
      const padBot = parseFloat(plateStyle.paddingBottom) || 0;

      // Gap between text and buttons.
      const textStyle = window.getComputedStyle(textEl);
      const mb = parseFloat(textStyle.marginBottom) || 0;

      const usableTextH = Math.max(
        60,
        plateH - padTop - padBot - actionsH - mb
      );

      // If it fits, done.
      if (textEl.scrollHeight <= usableTextH) return;

      // Shrink using transform so all run styles scale together.
      let scale = 1;
      while (scale > minScale) {
        scale = +(scale - step).toFixed(3);
        textEl.style.transformOrigin = "50% 50%";
        textEl.style.transform = `scale(${scale})`;

        // Transform doesn’t change scrollHeight, so use bounding box instead.
        const rect = textEl.getBoundingClientRect();
        const scaledH = rect.height * scale; // conservative
        if (scaledH <= usableTextH) break;
      }
    });
  }

  class SayPageRenderer {
    render(page, ctx) {
      const root = document.createElement("div");
      root.className = "say-page";

      ctx = ctx || {};
      page = page || {};

      const stateJson =
        ctx.state && typeof ctx.state.toJSON === "function"
          ? ctx.state.toJSON()
          : {};

      // Big plate (main content area)
      const plate = document.createElement("div");
      plate.className = "say-plate";

      const text = document.createElement("div");
      text.className = "say-text";

      // Big plate text source (preferred: plateText)
      // Fallbacks keep older pages alive
      const plateText =
        page.plateText != null
          ? page.plateText
          : page.displayText != null
          ? page.displayText
          : page.sayText;

      // Render plateText as runs OR legacy string fallback
      if (Array.isArray(plateText)) {
        plateText.forEach((run) => {
          const rawT = run && run.t != null ? String(run.t) : "";
          const k = run && run.k ? String(run.k) : "tm0"; // default style

          const t =
            Tutor.Template && typeof Tutor.Template.render === "function"
              ? Tutor.Template.render(rawT, stateJson)
              : rawT;

          // Newline support
          if (t === "\n") {
            text.appendChild(document.createElement("br"));
            return;
          }

          // If a run contains newlines, split safely
          if (t.includes("\n")) {
            const parts = t.split("\n");
            parts.forEach((part, i) => {
              if (i) text.appendChild(document.createElement("br"));
              if (!part) return;
              const span = document.createElement("span");
              span.className = `run run-${k}`;
              span.textContent = part;
              text.appendChild(span);
            });
            return;
          }

          const span = document.createElement("span");
          span.className = `run run-${k}`;
          span.textContent = t;
          text.appendChild(span);
        });
      } else {
        const raw = String(plateText || "");
        const rendered =
          Tutor.Template && typeof Tutor.Template.render === "function"
            ? Tutor.Template.render(raw, stateJson)
            : raw;
        text.textContent = rendered;
      }

      plate.appendChild(text);

      // Plate buttons (sayButtons) OR legacy fallback buttons
      const actions = document.createElement("div");
      actions.className = "say-actions";

      const btns = Array.isArray(page.sayButtons) ? page.sayButtons : null;

      if (btns && btns.length) {
        btns.forEach((b) => {
          if (!b) return;

          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "say-btn";
          btn.textContent = String(b.label || "OK");

          btn.addEventListener("click", () => {
            if (b.action === "hear_say") {
              const ttsRaw =
                page.sayTts != null
                  ? String(page.sayTts)
                  : page.sayText != null
                  ? String(page.sayText)
                  : "";

              const tts =
                Tutor.Template && typeof Tutor.Template.render === "function"
                  ? Tutor.Template.render(ttsRaw, stateJson)
                  : ttsRaw;

              // Fallback: speak plate text if sayText/sayTts missing
              if (Tutor.TTS && typeof Tutor.TTS.speak === "function") {
                Tutor.TTS.speak(tts || text.textContent || "");
              }
              return;
            }

            if (b.to) {
              ctx.nav.goTo(b.to);
              ctx.render();
            }
          });

          actions.appendChild(btn);
        });
      } else {
        // Legacy fallback (keeps old pages working if needed)
        const hearBtn = document.createElement("button");
        hearBtn.type = "button";
        hearBtn.className = "say-btn";
        hearBtn.textContent = "Hear it said";
        hearBtn.addEventListener("click", () => {
          const ttsRaw =
            page.sayTts != null
              ? String(page.sayTts)
              : page.sayText != null
              ? String(page.sayText)
              : text.textContent || "";

          const tts =
            Tutor.Template && typeof Tutor.Template.render === "function"
              ? Tutor.Template.render(ttsRaw, stateJson)
              : ttsRaw;

          if (Tutor.TTS && typeof Tutor.TTS.speak === "function") {
            Tutor.TTS.speak(tts || "");
          }
        });
        actions.appendChild(hearBtn);

        const doneBtn = document.createElement("button");
        doneBtn.type = "button";
        doneBtn.className = "say-btn";
        doneBtn.textContent = "OK, go back";
        doneBtn.addEventListener("click", () => {
          if (page.autoReturnTo) ctx.nav.goTo(page.autoReturnTo);
          else ctx.nav.goHome();
          ctx.render();
        });
        actions.appendChild(doneBtn);
      }

      plate.appendChild(actions);
      root.appendChild(plate);

      // Auto-shrink SAY text if it would overflow the plate.
      fitSayTextToPlate(plate, text, actions, { minScale: 0.62, step: 0.03 });

      // Optional auto-return (leave behavior as-is)
      const secs = Number(page.autoReturnSeconds || 0);
      if (page.autoReturnTo && secs > 0) {
        const thisPageId = ctx.nav.currentPageId;
        setTimeout(() => {
          // Only auto-return if still on this page
          if (ctx.nav.currentPageId === thisPageId) {
            ctx.nav.goTo(page.autoReturnTo);
            ctx.render();
          }
        }, secs * 1000);
      }

      return root;
    }
  }

  Tutor.SayPageRenderer = SayPageRenderer;
})();
