(function () {
  // ------------------------------------------------------------
  // Tutor Prototype — app.js
  //
  // Goals of this shell:
  // - Load config, then content
  // - Maintain a single ctx object shared by renderers
  // - Render pages through PageFrame
  // - Manage ONE global idle timer (used for auto-return on say pages)
  // - Reset idle timer on any user activity (tap, key, wheel)
  //
  // Key rules:
  // - IdleManager is created ONCE (never inside render)
  // - Global event listeners are attached ONCE (never inside render)
  // - ctx.render() is "pure": it reads state + page, then paints UI
  // ------------------------------------------------------------

  const statusEl = document.getElementById("status");
  const debugHost = document.getElementById("debug");

  // Renderer instances are created once
  const menuRenderer = new Tutor.MenuPageRenderer();
  const sayRenderer = new Tutor.SayPageRenderer();
  const scheduleRenderer = new Tutor.SchedulePageRenderer();
  const infoRenderer = new Tutor.InfoPageRenderer();

  function setStatus(ok, msg) {
    statusEl.className = ok ? "ok" : "bad";
    statusEl.textContent = msg;
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  // Attach global “activity” listeners that bump the idle timer.
  // This prevents the auto-return from firing while the user is interacting.
  function attachIdleBumpListeners(bumpFn) {
    const events = ["pointerdown", "touchstart", "keydown"];
    events.forEach((evt) => {
      window.addEventListener(evt, bumpFn, { passive: true });
    });
  }

  // Decide whether the idle timer should be active for a given page.
  // Right now we only auto-return from "say" pages.
  function applyIdlePolicy(idle, page) {
    if (page && page.type === "say") {
      const seconds = Number(page.autoReturnSeconds) || 15;
      idle.start(seconds * 1000);
    } else {
      idle.stop();
    }
  }

  async function main() {
    try {
      // ----------------------------------------------------------
      // 1) Load config first (non-content settings)
      // ----------------------------------------------------------
      const configStore = new Tutor.ConfigStore({
        localPath: "data/config.local.json",
      });
      const config = await configStore.load();

      // Make config available globally (TTS + other helpers read it)
      Tutor.Config = config;

      console.log("CONFIG content:", config?.content);
      console.log("REMOTE URL:", config?.content?.remoteUrl);
      console.log("LOCAL PATH:", config?.content?.localPath);

      // ----------------------------------------------------------
      // 2) Load content next (screen content JSON)
      // ----------------------------------------------------------
      const store = new Tutor.ContentStore({
        remotePath: config?.content?.remoteUrl, // ← ADD THIS LINE
        localPath: config?.content?.localPath || "data/content.local.json",
        embeddedScriptId: "embedded-content",
        validator: new Tutor.ContentValidator(),
      });

      const content = await store.load();
      console.log("SOURCE:", store.source);

      const home = content.getPage("home");
      console.log("HOME PAGE RAW:", home);

      console.log("HOME avatarText:", home?.avatarText);
      console.log("HOME greeting:", home?.greeting);
      console.log("HOME name:", content?.personName);

      // ----------------------------------------------------------
      // 2b) Load events (special events + rules)
      // ----------------------------------------------------------
      const eventsStore = new Tutor.EventsStore({
        remoteUrl: config?.events?.remoteUrl,
        localPath: config?.events?.localPath || "data/events.json",
      });

      const eventsRaw = await eventsStore.load();
      console.log("EVENTS SOURCE:", eventsStore.getSource());
      console.log("EVENTS ERROR:", eventsStore.getLastError());
      // ----------------------------------------------------------
      // 3) Core app objects
      // ----------------------------------------------------------
      const state = new Tutor.AppState();
      const nav = new Tutor.Navigator(content.homePageId);

      clear(debugHost);

      const frame = new Tutor.PageFrame();
      frame.mount(debugHost);

      // ----------------------------------------------------------
      // 4) Build ctx (shared context)
      //    NOTE: do NOT freeze until wiring is complete.
      // ----------------------------------------------------------
      const ctx = {
        config,
        content,
        eventsRaw,
        state,
        nav,
        frame,
        render: null,
        idle: null,
        seeservices: null,
      };

      // Services (one place)
      ctx.services = {
        comm: new Tutor.CommService(ctx),
      };

      ctx.actions = new Tutor.ActionRouter(ctx);

      // Make wakeWord available to templates like {{wakeWord}}
      state.setMany({
        wakeWord: String(config?.speech?.wakeWord || "COMPUTER").toUpperCase(),
      });

      // Let frame access ctx if it needs it (safe OOP pattern)
      frame.attach(ctx);

      // ----------------------------------------------------------
      // 5) Global idle manager (ONE instance)
      // ----------------------------------------------------------
      const idle = new Tutor.IdleManager({
        onIdle: () => {
          const p = content.getPage(nav.currentPageId);
          if (!p || p.type !== "say") return; // stale timer? ignore it
          nav.goTo(content.homePageId);
          ctx.render();
        },
      });

      ctx.idle = idle;

      // Any user activity resets idle
      attachIdleBumpListeners(() => idle.bump());

      // ----------------------------------------------------------
      // 6) Render function (single source of UI truth)
      // ----------------------------------------------------------

      ctx.render = function render() {
        const pageId = nav.currentPageId;
        const page = content.getPage(pageId);

        // ---------- Missing page safeguard ----------
        if (!page) {
          try {
            setStatus(false, `Missing page: ${pageId}`);
          } catch (e) {}

          frame.setHeader("Error");
          frame.setCanGoBack(nav.canGoBack());
          frame.setContent(
            document.createTextNode(`Missing page: ${pageId}`),
            null
          );

          if (ctx.idle && typeof ctx.idle.stop === "function") ctx.idle.stop();
          return;
        }

        // Give the page its id so AvatarPane can detect page changes
        page._id = pageId;

        // ---------- Home message (default vs active event) ----------
        try {
          const nowParts = Tutor.EventEngine.getNowPartsNY();
          ctx.state.setMany({
            dow: nowParts.dowLong,
            dateLong: nowParts.dateLong,
            homeMessageText: Tutor.EventEngine.resolveHomeMessage(
              ctx.content,
              ctx.eventsRaw,
              nowParts
            ),
          });
        } catch (e) {
          // fail soft
        }

        // ---------- Idle policy ----------
        // keep disabled for now (your current stance)
        idle.stop();

        // ---------- Header + navigation ----------
        // Titles are speech-only now. Never render header UI text.
        frame.setHeader("");
        frame.setCanGoBack(nav.canGoBack());

        // ---------- Render by page type ----------
        // NEW JSON uses: tiles, say, schedule, info
        // Back-compat: treat "menu" like "tiles"
        switch (page.type) {
          case "tiles":
          case "menu":
            frame.setContent(menuRenderer.render(page, ctx), page);
            break;

          case "say":
            frame.setContent(sayRenderer.render(page, ctx), page);
            break;

          case "schedule":
            frame.setContent(scheduleRenderer.render(page, ctx), page);
            break;

          case "info":
            frame.setContent(infoRenderer.render(page, ctx), page);
            break;

          default: {
            const pre = document.createElement("pre");
            pre.textContent = JSON.stringify(page, null, 2);
            frame.setContent(pre, page);
          }
        }
      };

      // ----------------------------------------------------------
      // 7) Lock ctx shape AFTER everything is wired
      // ----------------------------------------------------------
      Object.freeze(ctx.config);
      Object.freeze(ctx.content);
      Object.freeze(ctx);

      // ----------------------------------------------------------
      // 8) Initial render
      // ----------------------------------------------------------
      ctx.render();
    } catch (e) {
      setStatus(false, e?.message || String(e));
      debugHost.textContent = "";
      console.error(e);
    }
  }

  window.addEventListener("DOMContentLoaded", main);
})();
