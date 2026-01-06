(function () {
  window.Tutor = window.Tutor || {};

  class ActionRouter {
    constructor(ctx) {
      this.ctx = ctx;
    }

    run(action, payload) {
      const a = String(action || "").trim();
      if (!a) return false;

      // CALL: send_sms_<contactKey>
      if (a.startsWith("send_sms_")) {
        const key = a.replace("send_sms_", "").trim();
        this.ctx?.services?.comm?.requestCall(key);
        this.ctx.nav.goTo("call_answer_phone");
        if (typeof this.ctx.render === "function") this.ctx.render();
        return true;
      }

      // Unknown action
      return false;
    }
  }

  Tutor.ActionRouter = ActionRouter;
})();
