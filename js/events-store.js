/* tutor app/js/events-store.js
   Add last-known-good caching (localStorage)
   Remote-first → cache → local → empty
*/
(function () {
  window.Tutor = window.Tutor || {};

  class EventsStore {
    constructor(opts) {
      const o = opts || {};

      this.localPath = o.localPath || "data/events.json";
      this.remoteUrl = o.remoteUrl || null;

      this.debug = !!o.debug;

      this.active = null;
      this.source = null;
      this.lastError = null;
      this.loadedAt = null;
    }

    async load() {
      this.lastError = null;

      // 0) Try remote first (if configured)
      if (this.remoteUrl) {
        const fetchedRemote = await this._tryFetchJSON(this.remoteUrl);

        if (fetchedRemote.ok) {
          // ✅ Remote success → write cache + activate
          this._writeCache(fetchedRemote.raw);
          return this._activate(fetchedRemote.raw, `remote:${this.remoteUrl}`);
        }

        // ❌ Remote failed → remember error, then try cache/local
        this.lastError = fetchedRemote.error;
        if (this.debug)
          console.warn("[EventsStore] remote failed:", fetchedRemote.error);
      }

      // 1) Try last-known-good cache
      const cached = this._readCache();
      if (cached) {
        if (this.debug) console.log("[EventsStore] using cache");
        return this._activate(cached, "cache:lastKnownGood");
      }

      // 2) Then try local
      const fetchedLocal = await this._tryFetchJSON(this.localPath);
      if (fetchedLocal.ok) {
        return this._activate(fetchedLocal.raw, `local:${this.localPath}`);
      }

      // 3) Fail-soft: app still works without events
      this.lastError = fetchedLocal.error;
      if (this.debug)
        console.warn("[EventsStore] local failed:", fetchedLocal.error);

      return this._activate({ meta: {}, rules: [], events: [] }, "empty");
    }

    getActive() {
      return this.active || { meta: {}, rules: [], events: [] };
    }

    getSource() {
      return this.source || "unknown";
    }

    getLastError() {
      return this.lastError;
    }

    _cacheKey() {
      // Prefer config key, fallback to a sane default
      return Tutor?.Config?.events?.cacheKey || "tutor.events.lastKnownGood";
    }

    _readCache() {
      try {
        const s = localStorage.getItem(this._cacheKey());
        return s ? JSON.parse(s) : null;
      } catch (e) {
        if (this.debug) console.warn("[EventsStore] cache read failed:", e);
        return null;
      }
    }

    _writeCache(raw) {
      try {
        localStorage.setItem(this._cacheKey(), JSON.stringify(raw));
      } catch (e) {
        if (this.debug) console.warn("[EventsStore] cache write failed:", e);
      }
    }

    _activate(raw, source) {
      const safe = raw && typeof raw === "object" ? raw : {};
      const normalized = this._normalizePayload(safe);

      this.active = normalized;
      this.source = source;
      this.loadedAt = new Date().toISOString();

      if (this.debug) {
        console.log("[EventsStore] active source:", this.source);
        console.log("[EventsStore] meta:", this.active.meta);
        console.log(
          "[EventsStore] rules:",
          this.active.rules.length,
          "events:",
          this.active.events.length
        );
      }

      return this.active;
    }

    _normalizePayload(safe) {
      const meta = safe.meta && typeof safe.meta === "object" ? safe.meta : {};
      const rules = Array.isArray(safe.rules) ? safe.rules.filter(Boolean) : [];
      const events = Array.isArray(safe.events)
        ? safe.events.filter(Boolean)
        : [];
      return { meta, rules, events };
    }

    async _tryFetchJSON(pathOrUrl) {
      try {
        const res = await fetch(pathOrUrl, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
        }

        const contentType = (
          res.headers.get("content-type") || ""
        ).toLowerCase();
        if (
          contentType &&
          !contentType.includes("application/json") &&
          !contentType.includes("text/json")
        ) {
          if (this.debug)
            console.warn(
              "[EventsStore] unexpected content-type:",
              contentType,
              pathOrUrl
            );
        }

        const raw = await res.json();
        return { ok: true, raw };
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        return { ok: false, error: msg };
      }
    }
  }

  Tutor.EventsStore = EventsStore;
})();
