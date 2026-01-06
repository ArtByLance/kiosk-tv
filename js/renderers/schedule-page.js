(function () {
  window.Tutor = window.Tutor || {};

  function dowShort(d) {
    return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d];
  }

  function minutesOfDay(d) {
    return d.getHours() * 60 + d.getMinutes();
  }

  function parseHM(s) {
    const m = String(s || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
  }

  function splitLines(msg) {
    return String(msg || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // --- Line model (one standard) ---

  function isLineObject(x) {
    return x && typeof x === "object" && !Array.isArray(x);
  }

  function makeLine({ label, time, note, kind }) {
    return {
      label: String(label || ""),
      time: String(time || ""),
      note: String(note || ""),
      kind: String(kind || "normal"),
    };
  }

  // Backward-compatible: if old content has strings, show them as a single-line label
  function normalizeLine(x) {
    if (isLineObject(x)) {
      // If someone passed our new shape already, keep it
      if ("label" in x || "time" in x || "note" in x) {
        return makeLine({
          label: x.label,
          time: x.time,
          note: x.note,
          kind: x.kind || "normal",
        });
      }
      // If it’s some other object, fall back
      return makeLine({
        label: String(x.text || ""),
        kind: x.kind || "normal",
      });
    }
    return makeLine({ label: String(x || ""), kind: "normal" });
  }

  // --- Events helpers (Today injection) ---

  function getNowPartsNY(now) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const get = (t) => parts.find((p) => p.type === t)?.value;

    const dowLong = get("weekday");
    const yyyy = get("year");
    const mm = get("month");
    const dd = get("day");
    const hh = parseInt(get("hour"), 10);
    const mi = parseInt(get("minute"), 10);

    const map = {
      Monday: "MON",
      Tuesday: "TUE",
      Wednesday: "WED",
      Thursday: "THU",
      Friday: "FRI",
      Saturday: "SAT",
      Sunday: "SUN",
    };

    return {
      dow3: map[dowLong] || "",
      dateLocal: `${yyyy}-${mm}-${dd}`,
      minutes: hh * 60 + mi,
    };
  }

  function formatTime12h(hm) {
    const mins = parseHM(hm);
    if (mins == null) return "";
    let h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  function formatRange12h(startLocal, endLocal) {
    const a = formatTime12h(startLocal);
    const b = formatTime12h(endLocal);
    if (!a || !b) return "";
    return `${a}–${b}`;
  }

  function formatStartOnly12h(startLocal) {
    return formatTime12h(startLocal);
  }

  function bucketFromStartLocal(startLocal) {
    const m = parseHM(startLocal);

    // If we can’t bucket it cleanly, default to MIDDAY (your rule A).
    if (m == null) return "midday";

    const h = Math.floor(m / 60);
    if (h < 11) return "morning";
    if (h < 16) return "midday";
    return "evening";
  }

  function findSectionByBucket(sections, bucket) {
    const want = String(bucket || "").toLowerCase();
    return sections.find((s) =>
      String(s.heading || "")
        .toLowerCase()
        .includes(want)
    );
  }

  function collectTodayEvents(raw, now) {
    const safe = raw && typeof raw === "object" ? raw : {};
    const rules = Array.isArray(safe.rules) ? safe.rules : [];
    const events = Array.isArray(safe.events) ? safe.events : [];
    const all = rules.concat(events).filter(Boolean);

    const np = getNowPartsNY(now);

    return all
      .filter((e) => {
        if (!e || e.enabled !== true) return false;
        if (e.kind === "template") return false;
        if (!e.schedule || typeof e.schedule !== "object") return false;

        const sch = e.schedule;
        if (sch.type === "weekly") {
          return String(sch.dow || "").toUpperCase() === np.dow3;
        }
        if (sch.type === "date") {
          return String(sch.dateLocal || "") === np.dateLocal;
        }
        return false;
      })
      .sort((a, b) => {
        const pa = Number(a.priority) || 0;
        const pb = Number(b.priority) || 0;
        if (pb !== pa) return pb - pa;

        const sa = parseHM(a?.schedule?.startLocal) ?? 99999;
        const sb = parseHM(b?.schedule?.startLocal) ?? 99999;
        return sa - sb;
      });
  }

  function eventToLine(ev) {
    const sch = ev?.schedule || {};
    const time = formatStartOnly12h(sch.startLocal);

    const title = String(ev?.title || "").trim();
    const note = String(ev?.note || "").trim();

    // Back-compat if older events don’t have title/note yet
    if (!title) {
      const msg = splitLines(ev?.message || "");
      return makeLine({
        label: msg[0] || "Event",
        time,
        note: msg[1] || "",
        kind: "event",
      });
    }

    return makeLine({
      label: title,
      time,
      note,
      kind: "event",
    });
  }

  function sameLine(a, b) {
    return (
      a.label === b.label &&
      a.time === b.time &&
      a.note === b.note &&
      a.kind === b.kind
    );
  }

  class SchedulePageRenderer {
    applyRules(page, now) {
      const sections = Array.isArray(page.sections)
        ? JSON.parse(JSON.stringify(page.sections))
        : [];

      const rules = Array.isArray(page.rules) ? page.rules : [];
      const nowDow = dowShort(now.getDay());
      const nowMin = minutesOfDay(now);

      const findSection = (heading) =>
        sections.find(
          (s) =>
            String(s.heading || "").toLowerCase() ===
            String(heading || "").toLowerCase()
        );

      rules.forEach((r) => {
        const when = r.when || {};
        if (when.dow && String(when.dow).toUpperCase() !== nowDow) return;

        if (when.after) {
          const afterMin = parseHM(when.after);
          if (afterMin != null && nowMin < afterMin) return;
        }

        if (when.before) {
          const beforeMin = parseHM(when.before);
          if (beforeMin != null && nowMin > beforeMin) return;
        }

        if (r.addLineToSection) {
          const a = r.addLineToSection;
          const sec = findSection(a.heading);
          if (!sec) return;

          sec.lines = Array.isArray(sec.lines) ? sec.lines : [];

          // allow either old string OR new object
          const newLine = normalizeLine(a.line);
          const exists = sec.lines
            .map(normalizeLine)
            .some((x) => sameLine(x, newLine));

          if (!exists) sec.lines.push(newLine);
        }
      });

      // normalize section lines once
      sections.forEach((s) => {
        s.lines = Array.isArray(s.lines) ? s.lines.map(normalizeLine) : [];
      });

      return sections;
    }

    getTodayEventForHome(page, now) {
      const sections = this.applyRules(page, now);

      for (const sec of sections) {
        const lines = Array.isArray(sec.lines) ? sec.lines : [];
        for (const ln of lines) {
          // normalizeLine() already exists in this file
          const n = normalizeLine(ln);

          // We want the “special” event line (same one you color gold)
          // Your schedule renderer tags it by kind === "event"
          if (n && n.kind === "event") return n;
        }
      }

      return null;
    }

    render(page, ctx) {
      const root = document.createElement("div");
      root.className =
        page && page._id === "schedule_today" ? "page schedule-today" : "page";

      const now = ctx && ctx.now ? ctx.now : new Date();
      let sections = this.applyRules(page, now);

      // Inject today's events into the right time block (Today screen only)
      const isTodayScreen = page && page._id === "schedule_today";
      if (isTodayScreen) {
        const todays = collectTodayEvents(ctx?.eventsRaw, now);

        todays.forEach((ev) => {
          const bucket = bucketFromStartLocal(ev?.schedule?.startLocal);
          const sec = findSectionByBucket(sections, bucket);
          if (!sec) return;

          const line = eventToLine(ev);
          sec.lines = Array.isArray(sec.lines) ? sec.lines : [];

          const exists = sec.lines.some((x) => sameLine(x, line));
          if (!exists) sec.lines.push(line);
        });
      }

      // Helper: normalize to a simple label key for icon logic
      const labelKey = (s) =>
        String(s || "")
          .toLowerCase()
          .trim()
          .replace(/[^a-z]/g, "");

      // Helper: choose svg per row
      const iconSrcForLine = (ln) => {
        const k = labelKey(ln.label);

        if (ln.kind === "event") return "assets/icons/ico-event.svg";
        if (k === "medicine" || k === "meds")
          return "assets/icons/ico-medicine.svg";

        if (
          k === "breakfast" ||
          k === "lunch" ||
          k === "supper" ||
          k === "dinner" ||
          k === "meal"
        ) {
          return "assets/icons/ico-meal.svg";
        }

        return "";
      };

      sections.forEach((sec) => {
        const box = document.createElement("div");
        box.className = "section";

        const h = document.createElement("h3");
        h.className = "daypart-header";

        const headingText = String(sec.heading || "").toLowerCase();

        let iconSrc = "";
        if (headingText.includes("morning"))
          iconSrc = "./assets/icons/ico-morning.svg";
        if (headingText.includes("midday"))
          iconSrc = "./assets/icons/ico-midday.svg";
        if (headingText.includes("evening"))
          iconSrc = "./assets/icons/ico-evening.svg";

        if (iconSrc) {
          const img = document.createElement("img");
          img.src = iconSrc;
          img.className = "daypart-icon";
          img.alt = "";
          h.appendChild(img);
        }

        const span = document.createElement("span");
        span.textContent = sec.heading || "";
        h.appendChild(span);

        box.appendChild(h);

        const lines = Array.isArray(sec.lines) ? sec.lines : [];
        if (!lines.length) {
          const p = document.createElement("p");
          p.className = "muted";
          p.textContent = "—";
          box.appendChild(p);
        } else {
          lines.forEach((lnRaw) => {
            const ln = normalizeLine(lnRaw);

            const row = document.createElement("div");
            row.className =
              ln.kind === "event"
                ? "schedule-line schedule-event-line"
                : "schedule-line";

            // 1) Icon column (img, fixed width)
            const ico = document.createElement("img");
            ico.className = "schedule-icon";
            ico.alt = "";

            const src = iconSrcForLine(ln);
            if (src) {
              ico.src = src;
              ico.style.visibility = "visible";
            } else {
              ico.src = "";
              ico.style.visibility = "hidden"; // keep alignment
            }

            // If a file path is wrong, fail soft (no ugly broken icon)
            ico.onerror = () => {
              ico.src = "";
              ico.style.visibility = "hidden";
            };

            row.appendChild(ico);

            // 2) Text wrapper (so label/time/note align as one stack)
            const text = document.createElement("div");
            text.className = "schedule-text";
            row.appendChild(text);

            // label
            if (ln.label) {
              const a = document.createElement("div");
              a.className = "schedule-label";
              a.setAttribute(
                "data-label",
                String(ln.label)
                  .toLowerCase()
                  .trim()
                  .replace(/[^a-z]/g, "")
              );
              a.textContent = ln.label;
              text.appendChild(a);
            }

            // time
            if (ln.time) {
              const b = document.createElement("div");
              b.className = "schedule-time";
              b.textContent = ln.time;
              text.appendChild(b);
            }

            // note
            if (ln.note) {
              const c = document.createElement("div");
              c.className = "schedule-note";
              c.textContent = ln.note;
              text.appendChild(c);
            }

            box.appendChild(row);
          });
        }

        root.appendChild(box);
      });

      return root;
    }
  }

  Tutor.SchedulePageRenderer = SchedulePageRenderer;
})();
