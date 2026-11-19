/* ==========================================================================
   Enigmatica — router
   Tiny hash router with a cleanup registry. Hash routing means the app works
   from a plain file:// URL without a build step or a server.
   ========================================================================== */
(function (global) {
  "use strict";

  const ROUTES = {
    "": "home",
    "caesar": "caesar",
    "vigenere": "vigenere",
    "crack": "crack",
    "crack/caesar": "crackCaesar",
    "crack/vigenere": "crackVigenere",
    "learn/caesar": "learnCaesar",
    "learn/vigenere": "learnVigenere",
    "learn/kasiski": "learnKasiski",
    "about": "about"
  };

  const TITLES = {
    home: "Enigmatica — Cipher Lab",
    caesar: "Caesar cipher — Enigmatica Cipher Lab",
    vigenere: "Vigenère cipher — Enigmatica Cipher Lab",
    crack: "Decrypt without a key — Enigmatica Cipher Lab",
    crackCaesar: "Caesar brute force — Enigmatica Cipher Lab",
    crackVigenere: "Breaking Vigenère — Enigmatica Cipher Lab",
    learnCaesar: "How the Caesar cipher works — Enigmatica Cipher Lab",
    learnVigenere: "How the Vigenère cipher works — Enigmatica Cipher Lab",
    learnKasiski: "The Kasiski examination — Enigmatica Cipher Lab",
    about: "About — Enigmatica Cipher Lab",
    notFound: "404 — Enigmatica Cipher Lab"
  };

  const ACTIVE_NAV = {
    home: "home",
    caesar: "caesar",
    learnCaesar: "caesar",
    vigenere: "vigenere",
    learnVigenere: "vigenere",
    learnKasiski: "vigenere",
    crack: "crack",
    crackCaesar: "crack",
    crackVigenere: "crack"
  };

  const cleanups = [];
  const app = document.getElementById("app");

  const App = {
    onCleanup: function (fn) {
      if (typeof fn === "function") cleanups.push(fn);
    },
    runCleanups: function () {
      while (cleanups.length) {
        const fn = cleanups.pop();
        try {
          fn();
        } catch (error) {
          // Cleanup is best-effort; never let it block navigation.
        }
      }
    },
    route: function () {
      return currentRoute;
    }
  };
  global.App = App;

  let currentRoute = "home";

  function parseRoute() {
    const raw = String(global.location.hash || "")
      .replace(/^#\/?/, "")
      .replace(/\/+$/, "");
    return ROUTES[raw] || "notFound";
  }

  function setActiveNav(route) {
    const active = ACTIVE_NAV[route] || "";
    document.querySelectorAll("[data-nav]").forEach(function (link) {
      const isActive = link.getAttribute("data-nav") === active;
      link.classList.toggle("is-active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function render() {
    App.runCleanups();

    const route = parseRoute();
    currentRoute = route;

    const factory = Pages[route] || Pages.notFound;
    let view;
    try {
      view = factory();
    } catch (error) {
      console.error("Enigmatica page render failed:", error);
      view = Pages.notFound();
    }

    app.innerHTML = '<div class="page">' + view.html + "</div>";

    if (typeof view.setup === "function") {
      try {
        view.setup();
      } catch (error) {
        console.error("Enigmatica page setup failed:", error);
        UI.toast("Something went sideways on this page. The console has the details.", "warn");
      }
    }

    document.title = TITLES[route] || TITLES.notFound;
    document.body.dataset.route = route;
    setActiveNav(route);
    UI.setYear();

    // Reset the scroll position for a new view. The browser may also try to
    // restore a scroll position on hash navigation; this keeps it predictable.
    global.scrollTo({ top: 0, left: 0, behavior: "auto" });
    app.focus({ preventScroll: true });
  }

  function init() {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    UI.setYear();

    const skipLink = document.querySelector(".skip-link");
    if (skipLink) {
      skipLink.addEventListener("click", function (event) {
        event.preventDefault();
        app.focus({ preventScroll: true });
        app.scrollIntoView({ behavior: "auto", block: "start" });
      });
    }

    render();

    global.addEventListener("hashchange", render);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
