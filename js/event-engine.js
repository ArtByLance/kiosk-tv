(function () {
  window.Tutor = window.Tutor || {};
  const Tutor = window.Tutor;

  class EventEngine {
    static TZ() {
      return "America/New_York";
    }

    static getNowPartsNY(now) {
      const tz = EventEngine.TZ();
      const d = now instanceof Date ? now : new Date();

      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "long",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(d);

      // Date string used by {{dateLong}}
      // Output:
      // MONDAY
      // January 5, 2026
      const rawDateLong = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(d);

      const comma = rawDateLong.indexOf(",");
      const dateLong =
        comma >= 0
          ? rawDateLong.slice(0, comma).trim().toUpperCase() +
            "\n" +
            rawDateLong.slice(comma + 1).trim()
          : rawDateLong.trim().toUpperCase();

      const get = (type) => {
        const p = parts.find((x) => x.type === type);
        return p ? p.value : "";
      };

      const dowLong = get("weekday"); // "Friday"
      const yyyy = get("year"); // "2026"
      const mm = get("month"); // "01"
      const dd = get("day"); // "01"
      const hh = parseInt(get("hour"), 10);
      const min = parseInt(get("minute"), 10);

      const minutes =
        (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(min) ? min : 0);

      return {
        tz,
        dowLong,
        dateLong,
        dow: EventEngine._dow3FromLong(dowLong), // "FRI"
        dateLocal: `${yyyy}-${mm}-${dd}`,
        minutes,
      };
    }

    static resolveHomeMessage(content, eventsRaw, nowParts) {
      const np = nowParts || EventEngine.getNowPartsNY();

      // Home alerts are "today" alerts (not "right now").
      const e = EventEngine.getTodayEvent(eventsRaw, np);

      if (e && typeof e.message === "string" && e.message.trim()) {
        return String(e.message);
      }

      return "";
    }

    static getTodayEvent(eventsRaw, nowParts) {
      const np = nowParts || EventEngine.getNowPartsNY();

      const list = EventEngine._flatten(eventsRaw).filter(
        (e) => e && e.enabled === true && e.kind !== "template"
      );

      let best = null;

      for (const e of list) {
        if (!EventEngine._matchesToday(e, np)) continue;

        if (!best) {
          best = e;
          continue;
        }

        const bp = Number.isFinite(Number(best.priority))
          ? Number(best.priority)
          : 0;
        const ep = Number.isFinite(Number(e.priority)) ? Number(e.priority) : 0;

        if (ep > bp) best = e;
      }

      return best;
    }

    static getActiveEvent(eventsRaw, nowParts) {
      const np = nowParts || EventEngine.getNowPartsNY();

      const list = EventEngine._flatten(eventsRaw).filter(
        (e) => e && e.enabled === true && e.kind !== "template"
      );

      let best = null;

      for (const e of list) {
        if (!EventEngine._matchesNow(e, np)) continue;

        if (!best) {
          best = e;
          continue;
        }

        const bp = Number.isFinite(Number(best.priority))
          ? Number(best.priority)
          : 0;
        const ep = Number.isFinite(Number(e.priority)) ? Number(e.priority) : 0;

        if (ep > bp) best = e;
      }

      return best;
    }

    // -----------------------------
    // Internals
    // -----------------------------

    static _flatten(eventsRaw) {
      const safe = eventsRaw && typeof eventsRaw === "object" ? eventsRaw : {};
      const rules = Array.isArray(safe.rules) ? safe.rules : [];
      const events = Array.isArray(safe.events) ? safe.events : [];
      return [...rules, ...events];
    }

    static _matchesNow(e, np) {
      const s =
        e && e.schedule && typeof e.schedule === "object" ? e.schedule : null;
      if (!s) return false;

      const startMin = EventEngine._parseTimeToMinutes(s.startLocal);
      const endMin = EventEngine._parseTimeToMinutes(s.endLocal);
      if (startMin == null || endMin == null) return false;

      if (!EventEngine._inWindow(np.minutes, startMin, endMin)) return false;

      if (s.type === "weekly") {
        const want = String(s.dow || "").toUpperCase();
        return want && want === String(np.dow).toUpperCase();
      }

      if (s.type === "date") {
        return String(s.dateLocal || "") === String(np.dateLocal);
      }

      return false;
    }

    static _matchesToday(e, np) {
      const s =
        e && e.schedule && typeof e.schedule === "object" ? e.schedule : null;
      if (!s) return false;

      if (s.type === "weekly") {
        const want = String(s.dow || "").toUpperCase();
        return want && want === String(np.dow).toUpperCase();
      }

      if (s.type === "date") {
        return String(s.dateLocal || "") === String(np.dateLocal);
      }

      return false;
    }

    static _parseTimeToMinutes(t) {
      if (typeof t !== "string") return null;
      const m = t.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return null;

      const hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);

      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
      if (hh < 0 || hh > 23) return null;
      if (mm < 0 || mm > 59) return null;

      return hh * 60 + mm;
    }

    static _inWindow(nowMin, startMin, endMin) {
      // Same start/end is treated as "never active" (safer than "all day")
      if (startMin === endMin) return false;

      if (startMin < endMin) {
        return nowMin >= startMin && nowMin < endMin;
      }

      // Cross-midnight: 22:00 -> 02:00
      return nowMin >= startMin || nowMin < endMin;
    }

    static _injectDow(text, dowLong) {
      return String(text || "").replaceAll("{{dow}}", String(dowLong || ""));
    }

    static _dow3FromLong(dowLong) {
      const x = String(dowLong || "")
        .trim()
        .toLowerCase();
      const map = {
        monday: "MON",
        tuesday: "TUE",
        wednesday: "WED",
        thursday: "THU",
        friday: "FRI",
        saturday: "SAT",
        sunday: "SUN",
      };
      return map[x] || "";
    }
  }

  Tutor.EventEngine = EventEngine;
})();
