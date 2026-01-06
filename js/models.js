(function () {
  window.Tutor = window.Tutor || {};

  class AppState {
    constructor() { this._data = {}; }
    setMany(obj) { Object.assign(this._data, obj || {}); }
    get(key) { return this._data[key]; }
    hasAll(keys) { return (keys || []).every(k => this._data[k] !== undefined && this._data[k] !== null && this._data[k] !== ""); }
    toJSON() { return { ...this._data }; }
  }

  class ContentModel {
    constructor(raw) {
      this.meta = raw.meta || {};
      this.homePageId = raw.homePageId;
      this.pages = raw.pages || {};
    }
    getPage(id) { return this.pages[id]; }
  }

  Tutor.AppState = AppState;
  Tutor.ContentModel = ContentModel;
})();