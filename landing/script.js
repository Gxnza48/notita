(function () {
  var STORAGE_KEY = "notita-landing-theme";
  var toggle = document.getElementById("themeToggle");
  function systemPrefersDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function resolved(pref) {
    if (pref === "dark" || pref === "light") return pref;
    return systemPrefersDark() ? "dark" : "light";
  }
  function apply(pref) {
    document.documentElement.setAttribute("data-theme", resolved(pref));
  }
  var stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (e) {}
  apply(stored || "system");
  toggle.addEventListener("click", function () {
    var current = resolved(stored || "system");
    var next = current === "dark" ? "light" : "dark";
    stored = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {}
    apply(next);
  });
})();

(function () {
  var els = document.querySelectorAll("[data-reveal]");
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 },
  );
  els.forEach(function (el) {
    io.observe(el);
  });
})();

(function () {
  var textEl = document.getElementById("demoText");
  var wpmWrap = document.getElementById("demoWpm");
  var wpmValue = document.getElementById("demoWpmValue");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var lines = [
    { text: "Today we learned the chain rule for composite functions.", cls: null },
    { text: "Exam is Friday — covers chapters 4 through 6.", cls: "important" },
    { text: "Ask about exercise 7, part b.", cls: "question" },
    { text: "Finish problem set before Thursday.", cls: "task" },
  ];

  if (reduceMotion) {
    textEl.innerHTML = lines
      .map(function (l) {
        var body = l.text;
        return l.cls ? '<span class="marker-line ' + l.cls + '">' + body + "</span>" : "<p>" + body + "</p>";
      })
      .join("");
    wpmWrap.classList.add("visible");
    wpmValue.textContent = "134";
    return;
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    runTyping();
  }
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) start();
      });
    },
    { threshold: 0.4 },
  );
  io.observe(document.getElementById("demoWpm").closest(".demo-card"));

  function runTyping() {
    var lineIndex = 0;
    var charIndex = 0;
    var typedChars = 0;
    var startTime = Date.now();
    var container = document.createElement("div");
    textEl.innerHTML = "";
    textEl.appendChild(container);
    var caret = document.createElement("span");
    caret.className = "demo-caret";
    textEl.appendChild(caret);

    var currentLineEl = null;

    function newLineEl(cls) {
      var el = document.createElement(cls ? "span" : "p");
      if (cls) el.className = "marker-line " + cls;
      container.appendChild(el);
      return el;
    }

    function tick() {
      if (lineIndex >= lines.length) {
        setTimeout(function () {
          wpmWrap.classList.remove("visible");
        }, 1400);
        return;
      }
      var line = lines[lineIndex];
      if (!currentLineEl) currentLineEl = newLineEl(line.cls);

      if (charIndex < line.text.length) {
        currentLineEl.textContent = line.text.slice(0, charIndex + 1);
        charIndex++;
        typedChars++;

        var elapsedMin = (Date.now() - startTime) / 60000;
        var wpm = elapsedMin > 0.02 ? Math.round(typedChars / 5 / elapsedMin) : 0;
        wpm = Math.min(wpm, 168);
        if (typedChars > 8) {
          wpmWrap.classList.add("visible");
          wpmValue.textContent = String(wpm);
        }

        setTimeout(tick, 34 + Math.random() * 30);
      } else {
        lineIndex++;
        charIndex = 0;
        currentLineEl = null;
        setTimeout(tick, 260);
      }
    }
    tick();
  }
})();
