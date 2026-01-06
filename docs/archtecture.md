# Tutor App — Architecture Map (Quick)

Goal: make it easy to find the right file fast, and make changes without side effects.

## The 4 “zones”

- **Shell (persistent layout + bottom nav)**
- **Renderers (left-side page UI)**
- **Avatar (right-side avatar + bubble)**
- **Services (data + event logic)**

Rule of thumb: if you’re changing how something _looks_, it’s usually a renderer or CSS. If you’re changing _rules/logic_, it’s usually a service.

---

## What file to open for common changes

### Bottom nav buttons (HOME, POWER UP, POWER DOWN, HELP, CALL)

- **File:** `js/page-frame.js`
- Add/remove buttons, reorder buttons, wire click handlers
- Icons live in `assets/icons/`

### Nav styling (colors, sizing, spacing)

- **File:** `css/app.css`
- Button class is `.nav-btn`
- Role classes are `.nav-btn.home`, `.nav-btn.on`, `.nav-btn.off`, `.nav-btn.help`, `.nav-btn.call`

---

## Pages and JSON

### Page content (screens)

- **File:** `data/content.local.json`
- Screen types in use: `tiles`, `info`, `schedule`, `say`
- `title` is **speech-only**, not shown as UI text
- `avatarText` controls the bubble (visible when present)

### Special events (visits, laundry, etc.)

- **File:** `data/events.json`
- Use:
  - **Templates** for reusable definitions
  - **Events** (`kind: "event"`) for real schedule items
- Home alert pill uses enabled items that match **TODAY**
- Schedule should show **events**, not templates (by design)

---

## Renderers (left-side UI)

Renderers build the **left content** only. They should not touch the avatar.

- **Folder:** `js/renderers/`
  - `schedule-page.js` — “Today” layout (Morning / Midday / Evening), baseline lines, event injection rules
  - `say-page.js` — SAY page plate text and layout (no title UI)
  - `info-page.js` — info pages (no title UI)
  - `menu-page.js` — tile/menu pages (home message pill lives here)

If you see UI text at the top that looks like a title, it’s almost always in a renderer or `page-frame`.

---

## Avatar system (right-side)

### Avatar bubble, poses, overrides

- **File:** `js/avatar-pane.js`
- Owns:
  - Bubble visibility (on when `avatarText` exists)
  - Bubble placement via `avatarBubbleRect { x, y, w, h }` (percent values)
  - Pose cycling rules (generic vs speak)
  - Optional per-page pose override:
    - `avatarPose: { mode: "generic" | "speak", index: N }`

### Bubble text formatting

- **File:** `css/app.css`
- `.avatarBubbleText` is where line breaks and clamping live
  - Use `white-space: pre-line;` to honor `\n`

---

## “Today alert pill” on Home

### Where it is rendered

- **File:** `js/renderers/menu-page.js`
- Only render the pill if message text is non-empty (prevents empty bar)

### Where message logic comes from

- **File:** `js/event-engine.js`
- Home message is “TODAY-based” (not “right now”)
- Uses event priority when more than one item matches today
- Templates can be included for Home alerts if enabled (project choice)

---

## App wiring (boot + render loop)

- **File:** `js/app.js` (or the main app entry)
- Owns:
  - Loading content + events
  - State updates like `dateLong`
  - Calling renderers
  - Passing `ctx` into PageFrame + AvatarPane

If you need a value available in templates like `{{dateLong}}`, it must be placed into state here.

---

## CSS and assets

### Main styles

- **File:** `css/app.css`
- Most “why does this not show?” issues are here (specificity, child selectors like `.nav-btn span`)

### Icons

- **Folder:** `assets/icons/`
- Example: `assets/icons/ico-call.svg`

---

## Working rules (project discipline)

- One thing at a time
- One file at a time
- Replace a small block, don’t rewrite everything
- If a change feels like “we should clean up,” stop and ask first

---

## Quick troubleshooting map

### “Title is showing”

- Check `js/page-frame.js` first (header area)
- Then check the specific renderer in `js/renderers/*`

### “Bubble rect not working”

- `js/avatar-pane.js` (rect logic)
- Then `css/app.css` for `.avatarBubble` positioning rules

### “Home pill is blank bar”

- `js/renderers/menu-page.js` must not render pill when message is empty

### “Special event not showing on Schedule”

- Confirm it’s `kind: "event"` in `data/events.json`
- Confirm date matches `dateLocal`
- Then check `js/renderers/schedule-page.js`

### “Line breaks not showing”

- `css/app.css` needs `white-space: pre-line;` on `.avatarBubbleText`
