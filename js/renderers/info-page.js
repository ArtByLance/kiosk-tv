(function () {
  window.Tutor = window.Tutor || {};

  class InfoPageRenderer {
    render(page, ctx) {
      const root = document.createElement("div");
      root.className = "page";

      const box = document.createElement("div");
      box.className = "section";

      // Title is speech-only now. Never render it as UI.

      const lines = Array.isArray(page.lines) ? page.lines : [];

      if (!lines.length) {
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = "—";
        box.appendChild(p);
      } else {
        lines.forEach((ln) => {
          const p = document.createElement("p");

          // NEW: support runs OR legacy strings
          if (Array.isArray(ln)) {
            const stateJson =
              ctx.state && typeof ctx.state.toJSON === "function"
                ? ctx.state.toJSON()
                : {};

            ln.forEach((run) => {
              const rawT = run && run.t != null ? String(run.t) : "";
              const k = run && run.k ? String(run.k) : "txt";

              const t =
                Tutor.Template && typeof Tutor.Template.render === "function"
                  ? Tutor.Template.render(rawT, stateJson)
                  : rawT;

              if (t === "\n") {
                p.appendChild(document.createElement("br"));
                return;
              }

              const span = document.createElement("span");
              span.className = `run run-${k}`;
              span.textContent = t;
              p.appendChild(span);
            });
          } else {
            // Legacy string (unchanged behavior)
            p.textContent = String(ln);
          }

          box.appendChild(p);
        });
      }

      root.appendChild(box);
      return root;
    }
  }

  Tutor.InfoPageRenderer = InfoPageRenderer;
})();
