(function () {
  window.Tutor = window.Tutor || {};

  class ContentStore {
    constructor(opts) {
      this.localPath = opts.localPath || "content.local.json";
      this.embeddedScriptId = opts.embeddedScriptId || "embedded-content";
      this.validator = opts.validator || new Tutor.ContentValidator();
      this.active = null;
      this.source = null;
    }

    async load() {
      // 1) Try fetch local JSON (works when served over http://)
      const fetched = await this._tryFetchJSON(this.localPath);
      if (fetched.ok)
        return this._activate(fetched.raw, `fetch:${this.localPath}`);

      // 2) Fallback to embedded JSON (works for file://)
      const embedded = this._tryReadEmbeddedJSON();
      if (embedded.ok) return this._activate(embedded.raw, "embedded");

      // 3) Fail with best error
      const msg = [
        "Unable to load content.",
        fetched.error ? `Fetch error: ${fetched.error}` : null,
        embedded.error ? `Embedded error: ${embedded.error}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      throw new Error(msg);
    }

    async _tryFetchJSON(path) {
      try {
        const res = await fetch(path, { cache: "no-store" });
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
  }

  Tutor.ContentStore = ContentStore;
})();
