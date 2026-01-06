(function () {
  window.Tutor = window.Tutor || {};

  class PageFrame {
    constructor(opts) {
      this.opts = opts || {};
      this.ctx = null;

      // Root
      this.root = document.createElement("div");
      this.root.className = "frame";

      // Main split (left content + right avatar)
      this.main = document.createElement("div");
      this.main.className = "frame-main";

      this.contentHost = document.createElement("div");
      this.contentHost.className = "frame-content";

      this.avatarHost = document.createElement("div");
      this.avatarHost.className = "frame-avatar";

      this.main.appendChild(this.contentHost);
      // NOTE: avatarHost is now an overlay, not part of the split layout

      // Footer / persistent nav
      this.nav = document.createElement("div");
      this.nav.className = "frame-nav";

      this.btnHome = this._makeNavButton("HOME", "assets/icons/ico-home.svg");
      this.btnHelp = this._makeNavButton("HELP", "assets/icons/ico-help.svg");
      this.btnUp = this._makeNavButton(
        "POWER UP",
        "assets/icons/ico-power-on.svg"
      );
      this.btnDown = this._makeNavButton(
        "POWER DOWN",
        "assets/icons/ico-power-off.svg"
      );
      this.btnCall = this._makeNavButton("PHONE", "assets/icons/ico-call.svg");

      this.btnHome.classList.add("home");
      this.btnUp.classList.add("on");
      this.btnDown.classList.add("off");
      this.btnHelp.classList.add("help");
      this.btnCall.classList.add("call");

      this.nav.appendChild(this.btnHome);
      this.nav.appendChild(this.btnUp);
      this.nav.appendChild(this.btnDown);
      this.nav.appendChild(this.btnHelp);
      this.nav.appendChild(this.btnCall); // last in line

      // Assemble
      this.root.appendChild(this.main);
      this.root.appendChild(this.avatarHost); // overlay layer across whole screen
      this.root.appendChild(this.nav);

      // Avatar pane is created on attach(), not here
      this.avatarPane = null;

      this._wire();
    }

    _makeNavButton(label, icon) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nav-btn";

      if (icon) {
        const img = document.createElement("img");
        img.src = icon;
        img.alt = "";
        b.appendChild(img);
      }

      const span = document.createElement("span");
      span.textContent = label;
      b.appendChild(span);

      return b;
    }

    _wire() {
      // handlers set by attach()
    }

    attach(ctx) {
      this.ctx = ctx;

      if (!this.avatarPane && window.Tutor && Tutor.AvatarPane) {
        this.avatarPane = new Tutor.AvatarPane({ genericCount: 6 });
      }

      this.btnHome.onclick = () => {
        ctx.nav.goHome();
        ctx.render();
      };

      this.btnUp.onclick = () => {
        if (ctx?.content?.pages?.["say_power_up"]) ctx.nav.goTo("say_power_up");
        ctx.render();
      };

      this.btnDown.onclick = () => {
        if (ctx?.content?.pages?.["say_power_down"])
          ctx.nav.goTo("say_power_down");
        ctx.render();
      };

      this.btnHelp.onclick = () => {
        // Send to a standard info/help node
        if (ctx?.content?.pages?.["help_home"]) {
          ctx.nav.goTo("help_home");
          ctx.render();
          return;
        }
        // safe fallback
        ctx.nav.goHome();
        ctx.render();
      };

      this.btnCall.onclick = () => {
        if (ctx?.content?.pages?.["phone_help"]) {
          ctx.nav.goTo("phone_help");
          ctx.render();
          return;
        }
        console.log("Missing page: call_home");
      };
    }

    // BACK no longer exists, so this becomes a no-op (keeps callers safe)
    setCanGoBack(_canGoBack) {
      // intentionally blank
    }

    // Accept current page so AvatarPane can react
    setContent(node, page) {
      // Left side content
      while (this.contentHost.firstChild) {
        this.contentHost.removeChild(this.contentHost.firstChild);
      }
      if (node) this.contentHost.appendChild(node);

      // Right side avatar pane
      while (this.avatarHost.firstChild) {
        this.avatarHost.removeChild(this.avatarHost.firstChild);
      }

      if (this.avatarPane && this.ctx) {
        const avatarNode = this.avatarPane.render(this.ctx, page || null);
        if (avatarNode) this.avatarHost.appendChild(avatarNode);
      }
    }

    mount(host) {
      host.appendChild(this.root);
    }

    setHeader(text) {
      // Keep compatibility with older code that calls frame.setHeader(...)
      // If header UI is removed/hidden, this does nothing
      if (!this.headerTitle) return;

      // If you still have the header element in DOM but want it visually gone
      // you can keep this next line, or delete it
      this.header.style.display = "none";

      // If you later decide to show it again, remove the display:none line
      this.headerTitle.textContent = text || "";
    }
  }

  Tutor.PageFrame = PageFrame;
})();
