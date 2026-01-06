(function () {
  window.Tutor = window.Tutor || {};

  class ContentValidator {
    validate(raw) {
      const errors = [];
      if (!raw || typeof raw !== "object")
        errors.push("Content is not an object.");

      if (!raw.meta || typeof raw.meta !== "object")
        errors.push("Missing meta object.");
      if (!raw.homePageId || typeof raw.homePageId !== "string")
        errors.push("Missing homePageId string.");
      if (!raw.pages || typeof raw.pages !== "object")
        errors.push("Missing pages object.");

      if (raw.pages && raw.homePageId && !raw.pages[raw.homePageId]) {
        errors.push(`homePageId "${raw.homePageId}" not found in pages.`);
      }

      if (raw.pages && typeof raw.pages === "object") {
        for (const [id, page] of Object.entries(raw.pages)) {
          if (!page || typeof page !== "object")
            errors.push(`Page "${id}" is not an object.`);
          if (!page.type) page.type = "info"; // default page type
          if (!page.title) page.title = ""; // allow blank title
          // Validate tile links
          const tiles = page.tiles || [];
          if (tiles && !Array.isArray(tiles))
            errors.push(`Page "${id}" tiles must be an array.`);
          if (Array.isArray(tiles)) {
            for (const t of tiles) {
              if (!t.label)
                errors.push(`Page "${id}" has a tile missing label.`);
              if (t.to && !raw.pages[t.to])
                errors.push(
                  `Tile "${t.label}" on "${id}" points to missing page "${t.to}".`
                );
            }
          }
        }
      }

      return { ok: errors.length === 0, errors };
    }
  }

  Tutor.ContentValidator = ContentValidator;
})();
