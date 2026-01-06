(function () {
  window.Tutor = window.Tutor || {};

  function IdleManager(opts) {
    opts = opts || {};
    this.onIdle = opts.onIdle || function () {};
    this.timerId = null;
    this.idleMs = 0;
    this.enabled = false;
  }

  IdleManager.prototype.start = function (idleMs) {
    this.stop();
    this.idleMs = Number(idleMs) || 0;
    if (this.idleMs <= 0) return;
    this.enabled = true;
    this._arm();
  };

  IdleManager.prototype.stop = function () {
    this.enabled = false;
    this.idleMs = 0;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  };

  IdleManager.prototype.bump = function () {
    if (!this.enabled || this.idleMs <= 0) return;
    this._arm();
  };

  IdleManager.prototype._arm = function () {
    if (this.timerId) clearTimeout(this.timerId);
    this.timerId = setTimeout(() => {
      if (!this.enabled) return;
      this.onIdle();
    }, this.idleMs);
  };

  Tutor.IdleManager = IdleManager;
})();
