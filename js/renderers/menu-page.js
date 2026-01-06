(function () {
  window.Tutor = window.Tutor || {};

  function formatTime(t) {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;

    // Drop :00 for cleanliness
    if (m === 0) return `${hour} ${ampm}`;

    return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  class MenuPageRenderer {
    render(page, ctx) {
      const root = document.createElement("div");
      root.className = "page";

      const vars =
        ctx && ctx.state && typeof ctx.state.toJSON === "function"
          ? ctx.state.toJSON()
          : {};
      if (ctx.idle) ctx.idle.bump();

      // Home-only: top message area (default greeting or active event)
      if (page && ctx && ctx.content && page._id === ctx.content.homePageId) {
        const getState = (k) =>
          ctx.state && typeof ctx.state.get === "function"
            ? ctx.state.get(k)
            : "";

        const fallbackText = String(getState("homeMessageText") || "").trim();

        // Try to pull the event the same way Schedule does: apply rules to schedule page
        let alertText = "";
        try {
          const schedId = "schedule_today"; // change if needed
          const schedPage = ctx?.content?.pages?.[schedId];

          if (schedPage && window.Tutor && Tutor.SchedulePageRenderer) {
            const r = new Tutor.SchedulePageRenderer();

            // If applyRules exists, use it and look for an "event" line
            if (typeof r.applyRules === "function") {
              const now = new Date();
              const sections = r.applyRules(schedPage, now);

              // Find first line tagged kind === "event"
              let found = null;
              for (const sec of sections || []) {
                const lines = Array.isArray(sec.lines) ? sec.lines : [];
                for (const ln of lines) {
                  // normalizeLine is inside schedule-page.js.
                  // If it’s global in Tutor, use it; else just inspect ln directly.
                  const n =
                    (typeof window.normalizeLine === "function" &&
                      normalizeLine(ln)) ||
                    ln;

                  if (n && n.kind === "event") {
                    found = n;
                    break;
                  }
                }
                if (found) break;
              }

              if (found) {
                // Prefer explicit time fields if present
                const label = String(found.label || found.message || "").trim();

                // If schedule stores a time string already, use it
                const timeStr = String(found.time || "").trim();

                // If schedule stores startLocal like "14:00", append it (no formatting here)
                const startLocal = String(found.startLocal || "").trim();

                if (label && timeStr) alertText = `${label} at ${timeStr}`;
                else if (label && startLocal)
                  alertText = `${label} at ${startLocal}`;
                else if (label) alertText = label;
              }
            }
          }
        } catch (_e) {
          // silent fallback
        }

        const homeText = String(alertText || fallbackText || "").trim();

        if (homeText) {
          const msg = document.createElement("button");
          msg.type = "button";
          msg.className = "home-message home-alert home-alert-btn";

          msg.addEventListener("click", () => {
            if (ctx?.nav?.goTo) ctx.nav.goTo("schedule_today");
            if (typeof ctx.render === "function") ctx.render();
          });

          const icon = document.createElement("img");
          icon.className = "home-message-icon";
          icon.src = "assets/icons/ico-event.svg";
          icon.alt = "";

          const body = document.createElement("div");
          body.className = "home-message-text";
          body.textContent = homeText;

          msg.appendChild(icon);
          msg.appendChild(body);
          root.appendChild(msg);
        }
      }

      const grid = document.createElement("div");
      grid.className = "tile-grid";

      const tiles = Array.isArray(page.tiles) ? page.tiles : [];

      // Layout: 4 or less = 1 column, 5+ = 2 columns
      grid.classList.add(tiles.length <= 4 ? "tiles-1col" : "tiles-2col");

      tiles.forEach((tile) => {
        const btn = document.createElement("button");
        btn.className = "tile";
        btn.type = "button";
        btn.textContent = Tutor.Template.render(tile.label || "Untitled", vars);

        btn.addEventListener("click", () => {
          // apply state set
          if (tile.set) ctx.state.setMany(tile.set);

          // centralized actions (preferred)
          if (tile.action && ctx?.actions?.run) {
            const handled = ctx.actions.run(tile.action, tile);
            if (handled) return; // router will navigate/render as needed
          }

          // go to next page
          if (tile.to) ctx.nav.goTo(tile.to);

          // re-render
          ctx.render();
        });
        grid.appendChild(btn);
      });

      root.appendChild(grid);
      return root;
    }
  }

  Tutor.MenuPageRenderer = MenuPageRenderer;
})();
