(function () {
  window.Tutor = window.Tutor || {};

  class Template {
    static render(text, data) {
      const s = String(text || "");
      const d = data || {};
      return s.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const v = d[key];
        return (v === undefined || v === null) ? "" : String(v);
      });
    }
  }

  Tutor.Template = Template;
})();