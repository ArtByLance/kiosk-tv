(function () {
  window.Tutor = window.Tutor || {};

  function ConfigStore(opts) {
    opts = opts || {};
    this.localPath = opts.localPath || "data/config.local.json";
  }

  ConfigStore.prototype.load = async function () {
    const res = await fetch(this.localPath, { cache: "no-store" });
    if (!res.ok)
      throw new Error(
        "Config load failed (" + res.status + "): " + this.localPath
      );
    return await res.json();
  };

  window.Tutor.ConfigStore = ConfigStore;
})();
