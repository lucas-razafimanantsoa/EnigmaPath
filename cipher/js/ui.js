/* ==========================================================================
   Enigmatica — UI helpers
   Small, dependency-free utilities for animation, toasts, clipboard access,
   and the handoff between the keyless cracker and the cipher workspace.
   ========================================================================== */
(function (global) {
  "use strict";

  const ICONS = {
    lock: "\uf023",
    unlock: "\uf09c",
    unlockKeyhole: "\uf13e",
    key: "\uf084",
    terminal: "\uf120",
    code: "\uf121",
    copy: "\uf0c5",
    check: "\uf00c",
    refresh: "\uf021",
    bolt: "\uf0e7",
    info: "\uf05a",
    eye: "\uf06e",
    eyeOff: "\uf070",
    bulb: "\uf0eb",
    link: "\uf0c1",
    wrench: "\uf0ad",
    gears: "\uf085",
    arrowLeft: "\uf060",
    arrowRight: "\uf061",
    arrowUp: "\uf062",
    arrowDown: "\uf063",
    arrowCircleRight: "\uf0a9",
    wand: "\uf0d0",
    database: "\uf1c0",
    chip: "\uf2db",
    fire: "\uf06d",
    bell: "\uf0f3",
    menu: "\uf0c9",
    x: "\uf00d",
    plus: "\uf067",
    minus: "\uf068",
    gear: "\uf013",
    book: "\uf02d",
    university: "\uf19c",
    globe: "\uf0ac",
    flask: "\uf0c3",
    table: "\uf0ce",
    columns: "\uf0db",
    undo: "\uf0e2",
    gauge: "\uf0e4",
    exchange: "\uf0ec",
    mug: "\uf0f4",
    file: "\uf0f6",
    shield: "\uf132",
    search: "\uf002",
    repeat: "\uf0b6",
    certificate: "\uf0a3",
    userSecret: "\uf21b",
    plug: "\uf1e6",
    idCard: "\uf2c2",
    envelope: "\uf0e0",
    filter: "\uf0b0",
    caretDown: "\uf0d7",
    caretRight: "\uf0da"
  };

  const ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ESCAPE_MAP[ch];
    });
  }

  function icon(name, className) {
    const glyph = ICONS[name] || ICONS.info;
    return '<span class="nf ' + (className || "") + '" aria-hidden="true">' + glyph + "</span>";
  }

  function prefersReducedMotion() {
    return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function randomLetter(uppercase) {
    const letter = Ciphers.ALPHABET[Math.floor(Math.random() * 26)];
    return uppercase ? letter : letter.toLowerCase();
  }

  /**
   * Scramble a piece of text into its final form. Letters flicker through
   * random glyphs and settle in sequence. Only the first `maxAnimated`
   * characters are scrambled, which keeps long messages snappy.
   */
  function scrambleTo(element, finalText, options) {
    const opts = options || {};
    const duration = opts.duration == null ? 720 : opts.duration;
    const delay = opts.delay == null ? 0 : opts.delay;
    const direction = opts.direction === "rtl" ? "rtl" : "ltr";
    const maxAnimated = opts.maxAnimated == null ? 650 : opts.maxAnimated;
    const text = String(finalText == null ? "" : finalText);
    const chars = Array.from(text);

    if (!element) return Promise.resolve();
    if (prefersReducedMotion() || chars.length === 0) {
      element.textContent = text;
      return Promise.resolve();
    }

    const animateCount = Math.min(chars.length, maxAnimated);
    const animatedChars = chars.slice(0, animateCount);
    const staticSuffix = chars.slice(animateCount).join("");
    const settleAt = new Array(animateCount);
    for (let i = 0; i < animateCount; i += 1) {
      const progress = animateCount <= 1
        ? 1
        : (direction === "rtl" ? (animateCount - 1 - i) : i) / (animateCount - 1);
      settleAt[i] = delay + progress * duration;
    }

    const start = performance.now();
    return new Promise(function (resolve) {
      function frame(now) {
        if (!element.isConnected) {
          resolve();
          return;
        }
        const elapsed = now - start;
        if (elapsed >= delay + duration) {
          element.textContent = text;
          resolve();
          return;
        }
        let out = "";
        for (let i = 0; i < animatedChars.length; i += 1) {
          const ch = animatedChars[i];
          if (/[A-Za-z]/.test(ch) && elapsed < settleAt[i]) {
            out += randomLetter(ch === ch.toUpperCase());
          } else {
            out += ch;
          }
        }
        element.textContent = out + staticSuffix;
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  /**
   * Append status lines one by one, terminal style. `lines` may contain
   * trusted HTML (callers escape user data). Returns a promise that settles
   * when every line has been written.
   */
  function writeConsole(element, lines, options) {
    const opts = options || {};
    const interval = opts.interval == null ? 115 : opts.interval;
    if (!element) return Promise.resolve();

    const safeLines = lines || [];
    if (prefersReducedMotion()) {
      element.innerHTML = safeLines.map(function (line) {
        return '<div class="status-line">' + line + "</div>";
      }).join("");
      return Promise.resolve();
    }

    element.innerHTML = "";
    return new Promise(function (resolve) {
      let index = 0;
      function next() {
        if (!element.isConnected) {
          resolve();
          return;
        }
        if (index >= safeLines.length) {
          const cursor = document.createElement("span");
          cursor.className = "status-cursor";
          cursor.setAttribute("aria-hidden", "true");
          const last = element.lastElementChild;
          if (last) last.appendChild(cursor);
          else element.appendChild(cursor);
          resolve();
          return;
        }
        const line = document.createElement("div");
        line.className = "status-line";
        line.innerHTML = safeLines[index];
        element.appendChild(line);
        index += 1;
        setTimeout(next, interval);
      }
      next();
    });
  }

  function toast(message, type, timeout) {
    const stack = document.getElementById("toast-stack");
    if (!stack) return;
    const kind = type || "info";
    const iconName = kind === "good" ? "check" : kind === "warn" ? "info" : "terminal";
    const node = document.createElement("div");
    node.className = "toast " + kind;
    node.innerHTML = icon(iconName) + "<span>" + escapeHtml(message) + "</span>";
    stack.appendChild(node);

    while (stack.children.length > 4) stack.removeChild(stack.firstElementChild);

    const life = timeout == null ? 3200 : timeout;
    setTimeout(function () {
      node.classList.add("out");
      setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 240);
    }, life);
  }

  async function copyText(text) {
    const value = String(text == null ? "" : text);
    if (!value) return false;

    if (navigator.clipboard && global.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (error) {
        // fall through to the legacy path
      }
    }

    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    area.style.top = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, value.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  function setRangeFill(input) {
    if (!input) return;
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    const value = Number(input.value) || 0;
    const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
    input.style.setProperty("--fill", percent + "%");
  }

  function flash(element, className, duration) {
    if (!element) return;
    const cls = className || "is-done";
    element.classList.remove(cls);
    // force a reflow so the animation can restart
    void element.offsetWidth;
    element.classList.add(cls);
    setTimeout(function () { element.classList.remove(cls); }, duration || 700);
  }

  function formatMs(ms) {
    if (!Number.isFinite(ms)) return "0.0 ms";
    if (ms < 10) return ms.toFixed(2) + " ms";
    return ms.toFixed(1) + " ms";
  }

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      const self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  function saveHandoff(data) {
    try {
      sessionStorage.setItem("enigmatica:handoff", JSON.stringify(data));
    } catch (error) {
      // Storage can be unavailable in some private/file contexts.
    }
  }

  function takeHandoff() {
    try {
      const raw = sessionStorage.getItem("enigmatica:handoff");
      sessionStorage.removeItem("enigmatica:handoff");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function setYear() {
    const nodes = document.querySelectorAll("[data-year]");
    const year = String(new Date().getFullYear());
    nodes.forEach(function (node) { node.textContent = year; });
  }

  global.UI = {
    ICONS: ICONS,
    icon: icon,
    escapeHtml: escapeHtml,
    prefersReducedMotion: prefersReducedMotion,
    sleep: sleep,
    scrambleTo: scrambleTo,
    writeConsole: writeConsole,
    toast: toast,
    copyText: copyText,
    setRangeFill: setRangeFill,
    flash: flash,
    formatMs: formatMs,
    debounce: debounce,
    saveHandoff: saveHandoff,
    takeHandoff: takeHandoff,
    setYear: setYear
  };
})(window);
