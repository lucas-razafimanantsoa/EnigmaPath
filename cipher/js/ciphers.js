/* ==========================================================================
   Enigmatica — cipher engine
   Pure, dependency-free implementations of the Caesar and Vigenère ciphers,
   plus a small English-language heuristic used by the keyless cracker.
   ========================================================================== */
(function (global) {
  "use strict";

  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const A = 65;
  const Z = 90;
  const a = 97;
  const z = 122;

  const ENGLISH_FREQ = {
    A: 8.167, B: 1.492, C: 2.782, D: 4.253, E: 12.702, F: 2.228,
    G: 2.015, H: 6.094, I: 6.966, J: 0.153, K: 0.772, L: 4.025,
    M: 2.406, N: 6.749, O: 7.507, P: 1.929, Q: 0.095, R: 5.987,
    S: 6.327, T: 9.056, U: 2.758, V: 0.978, W: 2.360, X: 0.150,
    Y: 1.974, Z: 0.074
  };

  const COMMON_WORDS = new Set((
    "the of and a i to in is it you that he was for on are with as his they at be this have from or one had by word but not what all were we when your can said there use an each which she do how their if will up other about out many then them these so some her would make like him into time has look two more write go see number no way could people my than first water been call who oil its now find long down day did get come made may part over new sound take only little work know place year live me back give most very after thing our just name good sentence man think say great where help through much before line right too mean old any same tell boy follow came want show also around form three small set put end does another well large must big even such because turn here why ask went men read need land different home us move try kind hand picture again change off play spell air away animal house point page letter mother answer found study still learn should america world"
  ).split(/\s+/));

  const COMMON_BIGRAMS = new Set((
    "th he in er an re on at en nd ti es or te of ed is it al ar st to nt ng se ha as ou io le ve co me de hi ri ro ic ne ea ra ce li ch ll be ma si om ur"
  ).split(/\s+/));

  const COMMON_TRIGRAMS = new Set((
    "the and ing her ere ent tha nth was eth for hat ion ter est ers ati ver his con res all ons ted ith tio ate iti ive men oul but"
  ).split(/\s+/));

  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  function isUpper(code) { return code >= A && code <= Z; }
  function isLower(code) { return code >= a && code <= z; }

  function shiftChar(ch, shift) {
    const code = ch.charCodeAt(0);
    if (isUpper(code)) return String.fromCharCode(A + mod(code - A + shift, 26));
    if (isLower(code)) return String.fromCharCode(a + mod(code - a + shift, 26));
    return ch;
  }

  function caesar(text, shift, mode) {
    const amount = mode === "decrypt" ? -normalizeShift(shift) : normalizeShift(shift);
    return Array.from(String(text)).map(function (ch) {
      return shiftChar(ch, amount);
    }).join("");
  }

  function normalizeShift(shift) {
    const n = Number(shift);
    if (!Number.isFinite(n)) return 0;
    return mod(Math.trunc(n), 26);
  }

  function cleanKey(key) {
    return Array.from(String(key || ""))
      .map(function (ch) { return ch.toUpperCase(); })
      .filter(function (ch) { return ch >= "A" && ch <= "Z"; })
      .join("");
  }

  function vigenere(text, key, mode) {
    const k = cleanKey(key);
    if (!k) return String(text);
    let keyIndex = 0;
    return Array.from(String(text)).map(function (ch) {
      const code = ch.charCodeAt(0);
      let base = null;
      if (isUpper(code)) base = A;
      else if (isLower(code)) base = a;
      if (base === null) return ch;
      let shift = k.charCodeAt(keyIndex % k.length) - A;
      keyIndex += 1;
      if (mode === "decrypt") shift = -shift;
      return String.fromCharCode(base + mod(code - base + shift, 26));
    }).join("");
  }

  function keyAlignment(text, key, maxLetters) {
    const limit = maxLetters || 32;
    const k = cleanKey(key);
    if (!k) return [];
    const out = [];
    let keyIndex = 0;
    const chars = Array.from(String(text));
    for (let i = 0; i < chars.length && out.length < limit; i += 1) {
      const ch = chars[i];
      const code = ch.charCodeAt(0);
      let base = null;
      if (isUpper(code)) base = A;
      else if (isLower(code)) base = a;
      if (base === null) continue;
      const keyLetter = k[keyIndex % k.length];
      const shift = keyLetter.charCodeAt(0) - A;
      const cipher = String.fromCharCode(base + mod(code - base + shift, 26));
      out.push({
        plain: ch.toUpperCase(),
        key: keyLetter,
        cipher: cipher.toUpperCase(),
        shift: shift,
        index: keyIndex
      });
      keyIndex += 1;
    }
    return out;
  }

  function previewFirstWords(text, maxWords, maxChars) {
    const wordLimit = maxWords || 8;
    const charLimit = maxChars || 64;
    const source = String(text || "").trim();
    if (!source) return "";
    const words = source.split(/\s+/).filter(Boolean);
    let preview = words.slice(0, wordLimit).join(" ");
    let truncated = words.length > wordLimit;

    if (preview.length > charLimit) {
      const cut = preview.slice(0, charLimit);
      const lastSpace = cut.lastIndexOf(" ");
      preview = (lastSpace > 18 ? cut.slice(0, lastSpace) : cut).trimEnd();
      truncated = true;
    }
    if (truncated) preview += "…";
    return preview;
  }

  function scoreEnglish(raw) {
    const text = String(raw || "").toLowerCase();
    const letters = text.replace(/[^a-z]/g, "");
    if (!letters) return -Infinity;

    let score = 0;

    // Frequency log-likelihood. Caesar preserves the multiset, but the
    // *mapping* changes, so this still discriminates between shifts.
    for (let i = 0; i < letters.length; i += 1) {
      const freq = ENGLISH_FREQ[letters[i].toUpperCase()] / 100;
      score += Math.log(freq + 0.0001);
    }

    // Common words are a strong signal on short samples.
    const words = text.split(/[^a-z]+/).filter(Boolean);
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i];
      if (COMMON_WORDS.has(word)) {
        score += 8 + Math.min(word.length, 7) * 1.6;
      } else if (word.length >= 4) {
        if (/^(th|he|in|re|an|on|at|en|nd|ti|es|or|te|of|ed|is|it|al|ar|st|to|nt|ng|se|ha|as|ou|io|le|ve|co|me|de|hi|ri|ro|ic|ne|ea|ra|ce|li|ch|ll|be|ma|si|om|ur)/.test(word)) {
          score += 1.4;
        }
        if (/(ing|ion|ent|ers|ati|tio|and|the|her|ter|hat|tha|ere|ate|his|con|res|ver|all|ons|ith|ted)$/.test(word)) {
          score += 2.2;
        }
      }
    }

    for (let i = 0; i < letters.length - 1; i += 1) {
      if (COMMON_BIGRAMS.has(letters.slice(i, i + 2))) score += 0.32;
    }
    for (let i = 0; i < letters.length - 2; i += 1) {
      if (COMMON_TRIGRAMS.has(letters.slice(i, i + 3))) score += 0.9;
    }

    const vowelCount = (letters.match(/[aeiou]/g) || []).length;
    const vowelRatio = vowelCount / letters.length;
    if (vowelRatio < 0.18 || vowelRatio > 0.62) score -= 3.5;
    if (/q(?!u)/.test(letters)) score -= 2;

    return score;
  }

  function rankCaesar(text, options) {
    const opts = options || {};
    const maxWords = opts.maxWords || 8;
    const maxChars = opts.maxChars || 64;
    const candidates = [];

    for (let shift = 0; shift < 26; shift += 1) {
      const full = caesar(text, shift, "decrypt");
      const preview = previewFirstWords(full, maxWords, maxChars);
      const score = scoreEnglish(preview);
      candidates.push({
        shift: shift,
        full: full,
        preview: preview,
        score: score,
        confidence: 0,
        isBest: false
      });
    }

    const scores = candidates.map(function (c) { return c.score; });
    const max = Math.max.apply(null, scores);
    const min = Math.min.apply(null, scores);
    const span = max - min;

    candidates.forEach(function (candidate) {
      candidate.confidence = span > 0 ? Math.round(((candidate.score - min) / span) * 100) : 0;
      candidate.isBest = candidate.score === max;
    });

    return candidates;
  }

  function letterFrequency(text) {
    const counts = {};
    const letters = String(text || "").toUpperCase().replace(/[^A-Z]/g, "");
    for (let i = 0; i < letters.length; i += 1) {
      counts[letters[i]] = (counts[letters[i]] || 0) + 1;
    }
    return counts;
  }

  function topLetters(text, count) {
    const freq = letterFrequency(text);
    return Object.keys(freq)
      .map(function (letter) { return { letter: letter, count: freq[letter] }; })
      .sort(function (x, y) {
        if (y.count !== x.count) return y.count - x.count;
        return x.letter.localeCompare(y.letter);
      })
      .slice(0, count || 5);
  }

  function splitColumns(text, length) {
    const letters = String(text || "").toUpperCase().replace(/[^A-Z]/g, "");
    const columns = [];
    for (let i = 0; i < length; i += 1) {
      let col = "";
      for (let j = i; j < letters.length; j += length) col += letters[j];
      columns.push(col);
    }
    return columns;
  }

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x;
  }

  function factors(n) {
    const out = [];
    for (let i = 1; i <= n; i += 1) {
      if (n % i === 0) out.push(i);
    }
    return out;
  }

  function reverse(text) {
    return Array.from(String(text)).reverse().join("");
  }

  global.Ciphers = {
    ALPHABET: ALPHABET,
    ENGLISH_FREQ: ENGLISH_FREQ,
    mod: mod,
    caesar: caesar,
    vigenere: vigenere,
    cleanKey: cleanKey,
    normalizeShift: normalizeShift,
    keyAlignment: keyAlignment,
    previewFirstWords: previewFirstWords,
    scoreEnglish: scoreEnglish,
    rankCaesar: rankCaesar,
    letterFrequency: letterFrequency,
    topLetters: topLetters,
    splitColumns: splitColumns,
    gcd: gcd,
    factors: factors,
    reverse: reverse
  };
})(window);
