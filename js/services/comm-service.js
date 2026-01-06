(function () {
  window.Tutor = window.Tutor || {};

  class CommService {
    constructor(ctx) {
      this.ctx = ctx;
    }

    requestCall(contactKey) {
      const contacts = this.ctx?.config?.contacts || {};
      const c = contacts[contactKey];
      if (!c || !c.phone) return false;

      const name = c.name || contactKey;
      const message = `Hi ${name} — David would like you to call him.`;

      this._sendSMS(c.phone, message);
      return true;
    }

    _sendSMS(phone, message) {
      const p = String(phone || "").trim();
      const m = String(message || "").trim();
      if (!p || !m) return;

      const encoded = encodeURIComponent(m);
      window.location.href = `sms:${p}?body=${encoded}`;
    }
  }

  Tutor.CommService = CommService;
})();
