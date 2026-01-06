(function () {
  window.Tutor = window.Tutor || {};

  class ContentStore {
    constructor(opts) {
      this.localPath = opts.localPath || "content.local.json";
      this.remotePath = opts.remotePath || null; // ← ADD THIS
      this.embeddedScriptId = opts.embeddedScriptId || "embedded-content";
      this.validator = opts.validator || new Tutor.ContentValidator();
      this.active = null;
      this.source = null;
    }

    async load() {
      this.lastError = null;

      // 1) Try REMOTE first
      if (this.remoteUrl) {
        const fetchedRemote = await this._tryFetchJSON(this.remoteUrl);

        if (fetchedRemote.ok) {
          // ✅ SUCCESS: cache + activate
          this._writeCache(fetchedRemote.raw);
          return this._activate(fetchedRemote.raw, `remote:${this.remoteUrl}`);
        }

        // ❌ REMOTE failed
        this.lastError = fetchedRemote.error;
      }

      // 2) Try LAST-KNOWN-GOOD cache
      const cached = this._readCache();
      if (cached) {
        return this._activate(cached, "cache:lastKnownGood");
      }

      // 3) Try LOCAL file
      const fetchedLocal = await this._tryFetchJSON(this.localPath);
      if (fetchedLocal.ok) {
        return this._activate(fetchedLocal.raw, `local:${this.localPath}`);
      }

      // 4) Fail-soft
      this.lastError = fetchedLocal.error;
      return this._activate({ meta: {}, rules: [], events: [] }, "empty");
    }
    async _tryFetchJSON(path) {
      try {
        const sep = path.includes("?") ? "&" : "?";
        const url = `${path}${sep}v=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const raw = await res.json();
        const v = this.validator.validate(raw);
        if (!v.ok)
          return {
            ok: false,
            error: `Validation failed: ${v.errors.join(" | ")}`,
          };
        return { ok: true, raw };
      } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
      }
    }

    _tryReadEmbeddedJSON() {
      try {
        const el = document.getElementById(this.embeddedScriptId);
        if (!el)
          return {
            ok: false,
            error: `Missing <script id="${this.embeddedScriptId}">`,
          };

        const text = (el.textContent || "").trim();
        if (!text) return { ok: false, error: "Embedded JSON is empty." };

        const raw = JSON.parse(text);
        const v = this.validator.validate(raw);
        if (!v.ok)
          return {
            ok: false,
            error: `Validation failed: ${v.errors.join(" | ")}`,
          };

        return { ok: true, raw };
      } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
      }
    }

    _activate(raw, source) {
      // Drop any pages marked _disabled: true (keeps them in JSON for reference)
      const pages =
        raw && raw.pages && typeof raw.pages === "object" ? raw.pages : {};
      const prunedPages = Object.fromEntries(
        Object.entries(pages).filter(
          ([, page]) => !page || page._disabled !== true
        )
      );

      const pruned = {
        ...raw,
        pages: prunedPages,
      };

      this.active = new Tutor.ContentModel(pruned);
      this.source = source;
      return this.active;
    }

    _readCache() {
      try {
        const key =
          Tutor?.Config?.content?.cacheKey || "tutor.content.lastKnownGood";
        const s = localStorage.getItem(key);
        return s ? JSON.parse(s) : null;
      } catch (e) {
        return null;
      }
    }

    _writeCache(raw) {
      try {
        const key =
          Tutor?.Config?.content?.cacheKey || "tutor.content.lastKnownGood";
        localStorage.setItem(key, JSON.stringify(raw));
      } catch (e) {}
    }
  }

  Tutor.ContentStore = ContentStore;
})();
