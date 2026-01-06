(function () {
  window.Tutor = window.Tutor || {};

  class Navigator {
    constructor(homePageId) {
      this.homePageId = homePageId;
      this.currentPageId = homePageId;
      this.history = [];
    }

    goTo(pageId) {
      if (!pageId) return;
      if (this.currentPageId) this.history.push(this.currentPageId);
      this.currentPageId = pageId;
    }

    goBack() {
      if (!this.history.length) return;
      this.currentPageId = this.history.pop();
    }

    goHome() {
      this.history = [];
      this.currentPageId = this.homePageId;
    }

    canGoBack() {
      return this.history.length > 0;
    }
  }

  Tutor.Navigator = Navigator;
})();