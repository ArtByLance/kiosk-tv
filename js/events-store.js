/* tutor app/js/events-store.js
   Loads events.v0.1.0.json (renamed to data/events.json)
   OOP, fail-soft, optional remote-first (GitHub) with local fallback
*/
(function () {
  window.Tutor = window.Tutor || {};

  class EventsStore {
    constructor(opts) {
      const o = opts || {};

      // Local file in your app folder
      this.localPath = o.localPath || "data/events.json";

      // Optional remote URL (GitHub raw). If provided, we try remote first.
      this.remoteUrl = o.remoteUrl || null;

      // Debug flag
      this.debug = !!o.debug;

      // Last-known active payload + metadata
      this.active = null;
      this.source = null;
      this.lastError = null;
      this.loadedAt = null;
    }

    async load() {
      this.lastError = null;

      // Try remote first (if configured)
      if (this.remoteUrl) {
        const fetchedRemote = await this._tryFetchJSON(this.remoteUrl);
        if (fetchedRemote.ok) {
          return this._activate(fetchedRemote.raw, `remote:${this.remoteUrl}`);
        }
        this.lastError = fetchedRemote.error;
        if (this.debug)
          console.warn("[EventsStore] remote failed:", fetchedRemote.error);
      }

      // Then try local
      const fetchedLocal = await this._tryFetchJSON(this.localPath);
      if (fetchedLocal.ok) {
        return this._activate(fetchedLocal.raw, `local:${this.localPath}`);
      }

      // Fail-soft: app still works without events
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
      // Keep this strict and predictable for downstream code
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

        // If a server returns HTML (common 404 in kiosks), guard it
        const contentType = (
          res.headers.get("content-type") || ""
        ).toLowerCase();
        if (
          contentType &&
          !contentType.includes("application/json") &&
          !contentType.includes("text/json")
        ) {
          // Still attempt json parse, but log a warning in debug
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
