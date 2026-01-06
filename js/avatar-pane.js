(function () {
  // Base avatar scale multiplier.
  // Applied after fit-to-height so the avatar is slightly larger by default.
  // Per-screen avatarImage.scale remains a relative adjustment on top of this.
  const AVATAR_BASE_SCALE = 1.3;

  window.Tutor = window.Tutor || {};
  const Tutor = window.Tutor;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  class AvatarPane {
    constructor(opts) {
      opts = opts || {};

      // Resting (generic) poses
      this.genericCount = Number(opts.genericCount || 6);
      this.genericIndex = 0;

      // Speaking poses (used on SAY pages)
      this.speakCount = Number(opts.speakCount || 3);
      this.speakIndex = 0;

      // Track last page+type so pose advances on every page change
      this._lastPageKey = null;
    }

    _getPageId(page) {
      return page ? page._id || page.id || null : null;
    }

    // Advance pose once per page change
    _cyclePoseIfNeeded(page) {
      const pageId = this._getPageId(page);
      if (!pageId) return;

      const pageType = String((page && page.type) || "").toLowerCase();
      const isSay = pageType === "say";

      const key = pageId + "|" + (isSay ? "say" : "other");
      if (this._lastPageKey === key) return;

      if (isSay) {
        this.speakIndex = (this.speakIndex % this.speakCount) + 1; // 1..N
      } else {
        this.genericIndex = (this.genericIndex % this.genericCount) + 1; // 1..N
      }

      this._lastPageKey = key;
    }

    _currentPose(page) {
      const pageType = String((page && page.type) || "").toLowerCase();
      const isSay = pageType === "say";

      // Optional per-page override:
      // "avatarPose": { "mode": "generic"|"speak", "index": 1 }
      const ap = page && page.avatarPose;
      if (ap && typeof ap === "object") {
        const mode = String(ap.mode || "").toLowerCase();
        const idx = Number(ap.index);
        if (
          (mode === "generic" || mode === "speak") &&
          Number.isFinite(idx) &&
          idx > 0
        ) {
          return { mode, index: Math.floor(idx) };
        }
      }

      return {
        mode: isSay ? "speak" : "generic",
        index: isSay ? this.speakIndex || 1 : this.genericIndex || 1,
      };
    }

    _setImgWithFallbacks(img, mode, index) {
      const primary = `assets/avatars/${mode}-${index}.png`;
      const fallback1 = `assets/avatars/${mode}-1.png`;

      // Back-compat: if you still have say-*.png files
      const altMode = mode === "speak" ? "say" : mode;
      const fallback2 = `assets/avatars/${altMode}-${index}.png`;
      const fallback3 = `assets/avatars/${altMode}-1.png`;

      const chain = [primary, fallback1, fallback2, fallback3];

      let i = 0;
      const tryNext = () => {
        if (i >= chain.length) return;
        img.src = chain[i++];
      };

      img.onerror = () => {
        // try remaining fallbacks one-by-one
        const tryChain = () => {
          if (i >= chain.length) return;
          img.onerror = () => {
            tryChain();
          };
          img.src = chain[i++];
        };
        tryChain();
      };

      tryNext();
    }

    // Approx "top of head" line per pose, as % of the 1024px avatar canvas
    // You only set these once per image set
    _getHeadTopPct(pose) {
      const key = `${pose.mode}-${pose.index}`;

      // TUNE THESE LATER (starter guesses)
      const map = {
        "generic-1": 20,
        "generic-2": 20,
        "generic-3": 20,
        "generic-4": 20,
        "generic-5": 20,
        "generic-6": 20,

        "speak-1": 20,
        "speak-2": 20,
        "speak-3": 20,
      };

      return map[key] != null ? map[key] : 16;
    }

    // If bubble overlaps the "head top" line, push avatar down in screen px
    _applyFaceAvoidance(root, body, bubble, pose, finalScale, dx, dy) {
      if (!root || !body || !bubble) return;

      // Run after layout so we can measure actual rectangles
      requestAnimationFrame(() => {
        if (!root.isConnected) return;
        // Optional per-page disable: "avatarAvoidBubble": false
        if (root._avatarAvoidBubble === false) return;

        const bubbleRect = bubble.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();

        const headTopPct = this._getHeadTopPct(pose);
        const headLineY = bodyRect.top + (headTopPct / 100) * bodyRect.height;

        // If the bubble bottom crosses into the head zone, push avatar down
        const MARGIN = 10;
        const overlapPx = bubbleRect.bottom + MARGIN - headLineY;

        const extraY = overlapPx > 0 ? overlapPx : 0;

        // Transform order: scale first, then pixel nudge, then percent nudges
        body.style.transformOrigin = "100% 100%";
        body.style.transform = `translate(${dx}%, ${dy}%) translateY(${extraY}px) scale(${finalScale})`;
      });
    }

    render(ctx, page) {
      ctx = ctx || {};
      const root = el("div", "avatarPane");
      const p = page || {};

      this._cyclePoseIfNeeded(p);
      const pose = this._currentPose(p);

      // Avatar “body” stage
      const body = el("div", "avatarBody");

      // Avatar image
      const img = document.createElement("img");
      img.className = "avatarImg";
      img.alt = "";

      const mode = pose.mode === "speak" ? "speak" : "generic";
      this._setImgWithFallbacks(img, mode, pose.index);

      // Auto-scale avatar to fit available viewport height (1024px native avatar)
      const AVATAR_NATIVE_H = 1024;

      // Measure bottom nav height (so avatar fits ABOVE it)
      const navEl =
        document.querySelector(".bottomBar") ||
        document.querySelector(".navBar") ||
        document.querySelector(".footerBar") ||
        document.querySelector(".quickBar");

      const navH = navEl ? navEl.getBoundingClientRect().height : 0;

      // A little breathing room from edges
      const PAD = 12;

      // Available height for the avatar art
      const availableH = Math.max(
        200,
        (window.innerHeight || 800) - navH - PAD
      );

      // Scale so 1024 fits into available height
      const autoScale =
        Math.min(1, availableH / AVATAR_NATIVE_H) * AVATAR_BASE_SCALE;

      // allow per-screen override: "avatarImage": { "scale": 0.9, "x": 0, "y": 0 }
      const avatarCfg = p.avatarImage;
      // "scale" is RELATIVE to the default fit-to-height scale
      // 1 = default, 1.1 = 10% bigger, 0.9 = 10% smaller
      const relScale =
        avatarCfg &&
        typeof avatarCfg === "object" &&
        Number.isFinite(Number(avatarCfg.scale)) &&
        Number(avatarCfg.scale) > 0
          ? Number(avatarCfg.scale)
          : 1;

      const finalScale = autoScale * relScale;

      // Apply scale + optional offsets (x/y are percent offsets, relative to default)
      const x =
        avatarCfg && typeof avatarCfg === "object" ? Number(avatarCfg.x) : NaN;
      const y =
        avatarCfg && typeof avatarCfg === "object" ? Number(avatarCfg.y) : NaN;

      const dx = Number.isFinite(x) ? x : 0;
      const dy = Number.isFinite(y) ? y : 0;

      // Bottom-right anchor
      body.style.transformOrigin = "100% 100%";

      // Translate is RELATIVE, then scale
      body.style.transform = `translate(${dx}%, ${dy}%) scale(${finalScale})`;

      body.appendChild(img);

      // Bubble (PINNED: standard rounded rect only, no tail)
      const bubble = el("div", "avatarBubble");

      function setBubbleContent(bubbleEl, avatarText) {
        // Clear existing
        bubbleEl.innerHTML = "";

        // Legacy string
        if (typeof avatarText === "string") {
          const lines = avatarText.split("\n");
          lines.forEach((line, i) => {
            if (i) bubbleEl.appendChild(document.createElement("br"));
            bubbleEl.appendChild(document.createTextNode(line));
          });
          return;
        }

        // New: runs array
        if (Array.isArray(avatarText)) {
          avatarText.forEach((run) => {
            const rawT = run && run.t != null ? String(run.t) : "";
            const k = run && run.k ? String(run.k) : "txt";

            // Support template tokens inside runs
            const stateJson =
              ctx.state && typeof ctx.state.toJSON === "function"
                ? ctx.state.toJSON()
                : {};
            const t =
              Tutor.Template && typeof Tutor.Template.render === "function"
                ? Tutor.Template.render(rawT, stateJson)
                : rawT;

            // Hard gap block (for "\n\n")
            if (t === "\n\n") {
              const gap = document.createElement("div");
              gap.className = "bubble-gap";
              bubbleEl.appendChild(gap);
              return;
            }

            // Single newline
            if (t === "\n") {
              bubbleEl.appendChild(document.createElement("br"));
              return;
            }

            // If a run contains newlines, split safely
            if (t.includes("\n")) {
              const parts = t.split("\n");
              parts.forEach((part, i) => {
                if (i) bubbleEl.appendChild(document.createElement("br"));
                if (part.length) {
                  const span = document.createElement("span");
                  span.className = `run run-${k}`;
                  span.textContent = part;
                  bubbleEl.appendChild(span);
                }
              });
              return;
            }

            // Normal text
            const span = document.createElement("span");
            span.className = `run run-${k}`;
            span.textContent = t;
            bubbleEl.appendChild(span);
          });

          return;
        }
      }

      const raw = (
        typeof p.avatarText === "string"
          ? p.avatarText
          : Array.isArray(p.avatarText)
          ? p.avatarText.map((r) => String((r && r.t) ?? "")).join("")
          : ""
      ).trim();
      const hasAvatarText = raw.length > 0;
      bubble.classList.toggle("isVisible", hasAvatarText);

      // Optional clamp control (defaults handled by CSS)
      const maxLines = Number(p.avatarBubbleMaxLines);
      if (Number.isFinite(maxLines) && maxLines > 0) {
        bubble.style.setProperty(
          "--bubble-lines",
          String(Math.floor(maxLines))
        );
      } else {
        bubble.style.removeProperty("--bubble-lines");
      }

      // Bubble positioning
      // Default comes from CSS (top/right/width)
      // JSON can optionally:
      // 1) NUDGE it with pixels: avatarBubbleMove: { x: -40, y: 10, scale: 1 }
      // 2) FULL override with percents: avatarBubbleRect: { x, y, w, h }  (legacy)

      bubble.style.left = "";
      bubble.style.top = "";
      bubble.style.width = "";
      bubble.style.height = "";
      bubble.style.right = "";
      bubble.style.bottom = "";
      bubble.style.position = "";
      bubble.style.transform = "";
      bubble.style.transformOrigin = "";

      // (A) Relative move + scale (pixels)
      const mv = p.avatarBubbleMove;
      if (mv && typeof mv === "object") {
        const dx = Number(mv.x);
        const dy = Number(mv.y);
        const sc = Number(mv.scale);

        const pxX = Number.isFinite(dx) ? dx : 0;
        const pxY = Number.isFinite(dy) ? dy : 0;
        const s = Number.isFinite(sc) && sc > 0 ? sc : 1;

        // Base width comes from your CSS design
        const BUBBLE_BASE_W = 520;

        // Move only (no scale here, so text never scales)
        bubble.style.transformOrigin = "100% 0%";
        bubble.style.transform = `translate(${pxX}px, ${pxY}px)`;

        // “Scale” affects bubble size, not text size
        if (s !== 1) {
          bubble.style.width = Math.round(BUBBLE_BASE_W * s) + "px";
        } else {
          bubble.style.width = ""; // fall back to CSS default
        }
      }

      // (B) Absolute rect override (percent-based) wins if present
      const r = p.avatarBubbleRect;
      if (r && typeof r === "object") {
        const toPct = (v) => {
          if (v === null || v === undefined || v === "") return null;
          const n = Number(v);
          return Number.isFinite(n) ? n + "%" : null;
        };

        const x = toPct(r.x);
        const y = toPct(r.y);
        const w = toPct(r.w);
        const h = toPct(r.h);

        bubble.style.position = "absolute";
        bubble.style.transform = ""; // rect mode owns placement/size

        if (x !== null) {
          bubble.style.left = x;
          bubble.style.right = "auto";
        } else {
          bubble.style.left = "";
          bubble.style.right = "";
        }

        bubble.style.top = y !== null ? y : "";
        bubble.style.width = w !== null ? w : "";
        bubble.style.height = h !== null ? h : "";

        bubble.style.bottom = "auto";
      }

      if (r && typeof r === "object") {
        const toPct = (v) => {
          if (v === null || v === undefined || v === "") return null;
          const n = Number(v);
          return Number.isFinite(n) ? n + "%" : null;
        };

        const x = toPct(r.x);
        const y = toPct(r.y);
        const w = toPct(r.w);
        const h = toPct(r.h);

        // If you provide x, we switch from right-anchored CSS to left
        if (x !== null) {
          bubble.style.left = x;
          bubble.style.right = "auto";
        } else {
          bubble.style.left = "";
          bubble.style.right = "";
        }

        bubble.style.top = y !== null ? y : "";
        bubble.style.width = w !== null ? w : "";
        bubble.style.height = h !== null ? h : "";

        bubble.style.bottom = "auto";
        bubble.style.position = "absolute";
      } else {
        // Clear overrides and fall back to CSS defaults
        bubble.style.left = "";
        bubble.style.top = "";
        bubble.style.width = "";
        bubble.style.height = "";
        bubble.style.position = "";
        bubble.style.right = "";
        bubble.style.bottom = "";
      }

      if (hasAvatarText) {
        const stateJson =
          ctx.state && typeof ctx.state.toJSON === "function"
            ? ctx.state.toJSON()
            : {};

        const txt =
          Tutor.Template && typeof Tutor.Template.render === "function"
            ? Tutor.Template.render(raw, stateJson)
            : raw;

        // Plate (background)
        bubble.appendChild(el("div", "avatarBubblePlate"));

        // Content (text + buttons)
        const content = el("div", "avatarBubbleContent");

        const textNode = el("div", "avatarBubbleText");
        textNode.style.whiteSpace = "pre-line";

        if (Array.isArray(p.avatarText)) {
          const stateJson =
            ctx.state && typeof ctx.state.toJSON === "function"
              ? ctx.state.toJSON()
              : {};

          // Render runs (styled + templated)
          p.avatarText.forEach((run) => {
            const rawT = run && run.t != null ? String(run.t) : "";

            const renderedT =
              Tutor.Template && typeof Tutor.Template.render === "function"
                ? Tutor.Template.render(rawT, stateJson)
                : rawT;

            if (renderedT === "\n") {
              textNode.appendChild(document.createElement("br"));
              return;
            }

            const k = run && run.k ? String(run.k) : "txt";
            const span = document.createElement("span");
            span.className = `run run-${k}`;
            span.textContent = renderedT;
            textNode.appendChild(span);
          });
        } else {
          // Legacy string path (exactly as before)
          textNode.textContent = txt;
        }

        content.appendChild(textNode);

        // Optional plate content (main content block)
        // Used by SAY pages and later by info/how-to screens
        if (p.plateText) {
          const plate = el("div", "avatarPlate");
          setBubbleContent(plate, p.plateText);
          content.appendChild(plate);
        }

        if (Array.isArray(p.avatarButtons) && p.avatarButtons.length) {
          const actions = el("div", "avatarBubbleActions");

          p.avatarButtons.forEach((b) => {
            if (!b) return;

            const btn = el("button", "avatarHearBtn", b.label || "");
            btn.type = "button";

            btn.addEventListener("click", () => {
              if (b.action === "hear_say") {
                if (Tutor.TTS && typeof Tutor.TTS.speak === "function") {
                  const say = String(p.sayText || "").trim();
                  Tutor.TTS.speak(say || txt);
                }
                return;
              }

              if (b.to && ctx?.nav?.goTo) {
                ctx.nav.goTo(b.to);
                if (typeof ctx.render === "function") ctx.render();
              }
            });

            actions.appendChild(btn);
          });

          content.appendChild(actions);
        }

        bubble.appendChild(content);
      }

      root.appendChild(bubble);
      root.appendChild(body);

      // Auto-push avatar down if bubble overlaps the face
      // Only matters when bubble is visible
      root._avatarAvoidBubble = p.avatarAvoidBubble !== false;
      this._applyFaceAvoidance(root, body, bubble, pose, finalScale, dx, dy);
      return root;
    }
  }

  Tutor.AvatarPane = AvatarPane;
})();
