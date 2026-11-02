/* PeruRail case study: the test strategy and findings from the playwright-e2e-framework
   repo (docs/test-strategy.md and docs/findings.md), drawn as a use case diagram,
   a risk matrix, a test matrix and a findings browser. */
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  // [id, test case, technique, risk, area, tag, known defect]
  const TESTS = [
    ["PR-001", "Search form loads with its default values", "Smoke", "R1", "search", "smoke"],
    ["PR-002", "One-way search Cusco → Machu Picchu shows available trains", "Use case", "R1", "search", "smoke"],
    ["PR-003", "Round-trip search shows outbound and return trains", "Use case", "R1", "search"],
    ["PR-004", "Search without a destination is blocked", "Negative testing", "R6", "search"],
    ["PR-005", "Destination list depends on the selected origin", "Decision table", "R6", "search"],
    ["PR-006", "Passenger total: 11 is accepted, 12 is rejected", "Boundary values", "R3", "pax"],
    ["PR-007", "Adult, child and infant age categories are offered", "Equivalence partitioning", "R3", "pax"],
    ["PR-008", "Past dates are disabled and the default date is not in the past", "Boundary values", "R4", "search"],
    ["PR-009", "Round-trip online price equals the list price minus 5%", "Business rule", "R2", "search"],
    ["PR-010", "Each train's duration equals arrival minus departure", "Business rule", "R5", "search"],
    ["PR-011", "Sorting by departure time orders trains chronologically", "Use case", "R5", "search"],
    ["PR-012", "English version shows no Spanish text", "i18n check", "R8", "search", "", "D2"],
    ["PR-013", "Search and results pages have no critical accessibility violations", "axe-core scan", "R9", "a11y", "a11y", "D1"],
    ["PR-014", "Search still works when the calendar service fails", "Network mocking", "R7", "resil", "", "D3"],
    ["PR-015", "The user is warned before the session expires", "Clock control", "R10", "session"],
    ["PR-016", "Search form is usable on iPhone and Android screens", "Device emulation", "R11", "mobile", "mobile"],
    ["PR-017", "Search page and trains list load within the performance budget", "Performance budget", "R12", "mobile", "perf"],
    ["PR-018", "The search flow throws no JavaScript errors", "Console monitoring", "R12", "resil", "", "D5"],
    ["PR-019", "The session warning announces the real time left", "Clock control", "R10", "session", "", "D4"],
  ].map(([id, name, tech, risk, area, tag = "", defect = ""]) => ({ id, name, tech, risk, area, tag, defect }));
  const byId = Object.fromEntries(TESTS.map((t) => [t.id, t]));

  // [id, risk, likelihood, impact]
  const RISKS = [
    ["R1", "Search fails or returns no trains for a valid route", 2, 3],
    ["R2", "Wrong price shown to the customer", 2, 3],
    ["R3", "Passenger limits or age rules not enforced", 2, 3],
    ["R4", "Past or invalid dates can be selected", 2, 3],
    ["R5", "Wrong schedule or duration shown", 1, 3],
    ["R6", "Incomplete form can be submitted", 2, 2],
    ["R7", "UI breaks when a back-end call fails", 2, 2],
    ["R8", "Foreign users see untranslated content", 3, 2],
    ["R9", "Users with disabilities cannot book", 3, 2],
    ["R10", "Session expiry is not handled clearly", 2, 2],
    ["R11", "Layout breaks on mobile devices", 2, 2],
    ["R12", "Slow pages or front-end errors hurt conversion", 2, 2],
  ].map(([id, name, l, i]) => ({ id, name, l, i, score: l * i, tests: TESTS.filter((t) => t.risk === id).map((t) => t.id) }));

  const USE_CASES = [
    { id: "search", name: "Search for trains", text: "Pick an origin, a destination and a trip type, then get the trains available, quickly.", tests: ["PR-001", "PR-002", "PR-003", "PR-004", "PR-005", "PR-017"] },
    { id: "compare", name: "Compare trains", text: "Read prices, schedules and durations, and sort the list.", tests: ["PR-009", "PR-010", "PR-011"] },
    { id: "pax", name: "Choose passengers", text: "Add adults, children and infants within the limits the site allows.", tests: ["PR-006", "PR-007", "PR-018"] },
    { id: "session", name: "Keep the session alive", text: "Get a clear, accurate warning before an idle session expires.", tests: ["PR-015", "PR-019"] },
    { id: "english", name: "Book in English", text: "A foreign traveller uses the English version of the site.", tests: ["PR-012"] },
    { id: "a11y", name: "Book with a screen reader", text: "A traveller with a disability uses assistive technology.", tests: ["PR-013"] },
    { id: "mobile", name: "Book on a phone", text: "The same flow on iPhone and Android screens.", tests: ["PR-016"] },
    { id: "dates", name: "Pick travel dates", text: "Choose dates from a calendar that only offers bookable days. The calendar service supplies those days, so its failure is tested too.", tests: ["PR-008", "PR-014"] },
  ];
  const OUT_OF_SCOPE = ["Enter passenger data", "Pay and confirm"];

  const AREAS = { search: "Train search", pax: "Passengers", session: "Session", a11y: "Accessibility", mobile: "Mobile · speed", resil: "Resilience" };

  const result = (t) => t.defect
    ? `<span class="res res-bad" title="Known defect, kept as test.fail()">Known defect · ${t.defect}</span>`
    : `<span class="res res-ok">Rule holds</span>`;

  /* ── Use case diagram: a UML-style SVG built from the data above ── */
  const ucRoot = $("#uc-diagram"), ucDetail = $("#uc-detail");
  if (ucRoot) {
    const W = 400, CX = 258, RX = 126, RY = 24, GAP = 58, TOP = 74;
    const cy = (i) => TOP + i * GAP;
    const lastY = cy(USE_CASES.length - 1);
    const divY = lastY + RY + 18;
    const outY = (i) => divY + 46 + i * GAP;
    const H = outY(OUT_OF_SCOPE.length - 1) + RY + 16;
    const actor = (x, y, label, cls = "") => `<g class="actor ${cls}" transform="translate(${x} ${y})">
        <circle cx="0" cy="-30" r="9"/><path d="M0 -21v24M-14 -10h28M0 3l-11 17M0 3l11 17"/>
        ${label.map((l, k) => `<text x="0" y="${38 + k * 14}" text-anchor="middle">${l}</text>`).join("")}</g>`;
    const travellerY = (cy(0) + cy(USE_CASES.length - 2)) / 2;
    const calendarY = lastY + 6;
    const defects = (u) => u.tests.filter((id) => byId[id].defect).length;
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="uc-svg">`;
    svg += `<rect class="boundary" x="${CX - RX - 14}" y="12" width="${2 * RX + 28}" height="${H - 18}" rx="14"/>`;
    svg += `<text class="boundary-label" x="${CX}" y="36" text-anchor="middle">book.perurail.com</text>`;
    // associations first, so the ovals sit on top of the lines
    USE_CASES.forEach((u, i) => {
      svg += `<line class="assoc" data-uc="${u.id}" x1="62" y1="${travellerY - 6}" x2="${CX - RX}" y2="${cy(i)}"/>`;
    });
    svg += `<line class="assoc assoc-sys" data-uc="dates" x1="62" y1="${calendarY + 4}" x2="${CX - RX}" y2="${lastY}"/>`;
    USE_CASES.forEach((u, i) => {
      const n = u.tests.length, d = defects(u);
      svg += `<g class="uc" data-uc="${u.id}" tabindex="0" role="button" aria-label="${u.name}, ${n} tests">
        <ellipse cx="${CX}" cy="${cy(i)}" rx="${RX}" ry="${RY}"/>
        <text class="uc-name" x="${CX}" y="${cy(i) - 2}" text-anchor="middle">${u.name}</text>
        <text class="uc-sub" x="${CX}" y="${cy(i) + 13}" text-anchor="middle">${n} test${n > 1 ? "s" : ""}${d ? ` · <tspan class="uc-bad">${d} defect${d > 1 ? "s" : ""}</tspan>` : ""}</text></g>`;
    });
    svg += `<line class="divider" x1="${CX - RX - 2}" y1="${divY}" x2="${CX + RX + 2}" y2="${divY}"/>`;
    svg += `<text class="oos-label" x="${CX}" y="${divY + 16}" text-anchor="middle">not tested on production</text>`;
    OUT_OF_SCOPE.forEach((name, i) => {
      svg += `<g class="uc uc-out"><ellipse cx="${CX}" cy="${outY(i)}" rx="${RX}" ry="${RY}"/>
        <text class="uc-name" x="${CX}" y="${outY(i) + 5}" text-anchor="middle">${name}</text></g>`;
    });
    svg += actor(40, travellerY, ["Traveller"]);
    svg += actor(40, calendarY + 30, ["Calendar", "service"], "actor-sys");
    svg += "</svg>";
    ucRoot.innerHTML = svg;

    const select = (id) => {
      const u = USE_CASES.find((x) => x.id === id);
      ucRoot.querySelectorAll("[data-uc]").forEach((el) => el.classList.toggle("on", el.dataset.uc === id));
      ucDetail.innerHTML = `<p class="uc-d-head">${u.name}</p><p class="uc-d-text">${u.text}</p>
        <ul class="uc-tests">${u.tests.map((tid) => { const t = byId[tid]; return `<li><code>${t.id}</code><span>${esc(t.name)}</span>${result(t)}</li>`; }).join("")}</ul>`;
    };
    ucRoot.querySelectorAll(".uc[data-uc]").forEach((g) => {
      g.addEventListener("click", () => {
        select(g.dataset.uc);
        // on narrow screens the panel sits below the diagram: bring it into view
        if (matchMedia("(max-width: 900px)").matches) ucDetail.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(g.dataset.uc); } });
    });
    select("search");
  }

  /* ── Risk matrix: likelihood rows (high on top) × impact columns ── */
  const heat = $("#heat"), riskList = $("#risk-list");
  if (heat) {
    const tier = (s) => (s >= 6 ? "hi" : s >= 3 ? "mid" : "lo");
    let html = `<span class="axis axis-y">Likelihood</span>`;
    for (let l = 3; l >= 1; l--) {
      html += `<span class="tick tick-y">${l}</span>`;
      for (let i = 1; i <= 3; i++) {
        const here = RISKS.filter((r) => r.l === l && r.i === i);
        html += `<div class="cell t-${tier(l * i)}"><span class="score">${l * i}</span>${here.map((r) => `<button type="button" class="rchip" data-risk="${r.id}">${r.id}</button>`).join("")}</div>`;
      }
    }
    html += `<span></span>${[1, 2, 3].map((i) => `<span class="tick tick-x">${i}</span>`).join("")}<span class="axis axis-x">Impact</span>`;
    heat.innerHTML = html;
    riskList.innerHTML = [...RISKS].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, "en", { numeric: true }))
      .map((r) => `<li data-risk="${r.id}" tabindex="0"><span class="r-id">${r.id}</span><span class="r-name">${r.name}</span><span class="r-score t-${tier(r.score)}">${r.score}</span><span class="r-tests">${r.tests.join(" · ")}</span></li>`).join("");
    const mark = (id) => document.querySelectorAll("[data-risk]").forEach((el) => el.classList.toggle("on", el.dataset.risk === id));
    document.querySelectorAll("[data-risk]").forEach((el) => {
      el.addEventListener("pointerenter", () => mark(el.dataset.risk));
      el.addEventListener("pointerleave", () => mark(null));
      el.addEventListener("focus", () => mark(el.dataset.risk));
      el.addEventListener("blur", () => mark(null));
      el.addEventListener("click", () => {
        mark(el.dataset.risk);
        if (el.matches(".rchip")) riskList.querySelector(`[data-risk="${el.dataset.risk}"]`).scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    });
  }

  /* ── Test matrix with filters ── */
  const tm = $("#tm"), filters = $("#tm-filters");
  if (tm) {
    const F = [
      ["all", "All", () => true],
      ["defect", "Known defects", (t) => t.defect],
      ["smoke", "Smoke", (t) => t.tag === "smoke"],
      ...Object.entries(AREAS).map(([k, v]) => [k, v, (t) => t.area === k]),
    ];
    filters.innerHTML = F.map(([k, label, fn]) =>
      `<button type="button" class="filter" data-f="${k}" aria-pressed="${k === "all"}">${label}<span>${TESTS.filter(fn).length}</span></button>`).join("");
    const body = tm.querySelector("tbody");
    const render = (k) => {
      const fn = F.find((f) => f[0] === k)[2];
      body.innerHTML = TESTS.filter(fn).map((t, n) => `<tr style="--i:${n}">
        <td class="c-id"><code>${t.id}</code>${t.tag === "smoke" ? '<span class="tag">smoke</span>' : ""}</td>
        <td class="c-name">${esc(t.name)}</td><td class="c-tech">${t.tech}</td><td class="c-risk">${t.risk}</td><td class="c-res">${result(t)}</td></tr>`).join("");
      filters.querySelectorAll(".filter").forEach((b) => b.setAttribute("aria-pressed", b.dataset.f === k));
    };
    filters.addEventListener("click", (e) => { const b = e.target.closest(".filter"); if (b) render(b.dataset.f); });
    render("all");
  }

  /* ── Findings browser ── */
  const FINDINGS = {
    defects: ["Defects", [
      ["D1", "Critical accessibility violations", "High", "PR-013", "An axe-core scan (WCAG 2 A and AA) finds buttons a screen reader announces only as \"button\", images with no text alternative, and form fields and a dropdown with no label, on both the search and trains pages."],
      ["D2", "Spanish text in the English version", "Medium", "PR-012", "The page declares lang=\"es\", so screen readers and translators treat it as Spanish, and it shows \"Sesión\", \"2 adultos (+12)\", \"[Seleccionar]\" and dates like \"Sáb 31 oct\"."],
      ["D3", "Search does nothing when the calendar service fails", "Medium", "PR-014", "With the dates service failing (simulated in the browser, never on PeruRail's server) every day is disabled and Search does nothing: no message, no request, no error."],
      ["D4", "The session warning announces the wrong time", "Medium", "PR-019", "After 25 idle minutes a warning says the session expires in 5 minutes. It actually ends 4 minutes later."],
      ["D5", "JavaScript error on a passenger counter", "Low", "PR-018", "Pressing \"−\" on a counter already at its minimum throws \"E.toFixed is not a function\" in Firefox and WebKit. No visible effect, but an unhandled exception in a normal action."],
    ]],
    minor: ["Minor issues", [
      ["M1", "Typo: \"dditional luggage storage\", missing the \"A\"", "Trains page"],
      ["M2", "Adding a second infant for one adult shows an info icon with no message", "Passengers"],
      ["M3", "While the page loads the departure date changes several times, once to a date in 2031", "Search page"],
      ["M4", "Only clicks count as activity: reading, scrolling or typing still triggers the expiry warning", "Whole site"],
      ["M5", "If renewing the session fails, the error handler itself throws an error", "Session warning"],
      ["M6", "The included luggage is described two different ways, so a traveller cannot know which applies", "Luggage page and FAQ"],
      ["M7", "Spanish text on the English luggage page", "Luggage page"],
    ]],
    questions: ["Questions for the business", [
      ["Q1", "Is today bookable, or is the earliest date tomorrow?", "The default date is tomorrow, but today can be picked."],
      ["Q2", "Is the 5% online discount meant for round trips only?", "One-way trips show the full price."],
      ["Q3", "When the dates cannot load, should the user search with the default date or see an error?", "Neither happens (D3)."],
      ["Q4", "Is it intended that Machu Picchu is already chosen as the destination?", "Earlier the destination started empty."],
    ]],
    rules: ["Business rules", [
      ["PR-006", "At most 11 passengers with a seat; infants travel without one"],
      ["PR-007", "Adults are 12 or older, children 3 to 11, infants under 3"],
      ["PR-007", "At least one adult, and one infant per adult"],
      ["PR-005", "Each origin offers its own list of destinations"],
      ["PR-009", "Round-trip online price is the list price minus 5%"],
      ["PR-011", "Trains sort by departure time, price or duration"],
      ["PR-015", "Warning after 25 minutes without a click; the session ends at 29"],
    ]],
    health: ["Technical health", [
      ["Search page speed", "Main content appears after 2.3 to 3.1 s; Google rates up to 2.5 s as good", "PR-017"],
      ["Trains list speed", "Trains appear 5.6 to 7.6 s after pressing Search, on a blank page", "PR-017"],
      ["Page weight", "140 to 160 requests and over 30 domains, many of them analytics and marketing", ""],
      ["Mobile", "Search form and trains list fit iPhone and Android screens with no sideways scroll", "PR-016"],
      ["Standards mode", "No <!DOCTYPE html>, so browsers render the page in quirks mode", ""],
      ["Blocking requests", "Synchronous requests freeze the browser while they wait", ""],
    ]],
  };
  const tabs = $("#fd-tabs"), panel = $("#fd-panel");
  if (tabs) {
    const views = {
      defects: (rows) => `<div class="defects">${rows.map(([id, title, sev, test, text]) => `<article class="defect">
          <p class="d-top"><code>${id}</code><span class="sev sev-${sev.toLowerCase()}">${sev}</span><code class="d-test">${test}</code></p>
          <h3>${title}</h3><p>${esc(text)}</p></article>`).join("")}</div>`,
      minor: (rows) => `<ul class="plain">${rows.map(([id, text, where]) => `<li><code>${id}</code><span>${esc(text)}</span><em>${where}</em></li>`).join("")}</ul>
          <p class="fd-note">M6 and M7 were found by the AI assistant: asked about the luggage allowance, it answered that its sources disagree, and the pages confirmed it.</p>`,
      questions: (rows) => `<ul class="plain">${rows.map(([id, q, seen]) => `<li><code>${id}</code><span>${q}<small>${seen}</small></span></li>`).join("")}</ul>
          <p class="fd-note">The tests check only what is certain and leave these open.</p>`,
      rules: (rows) => `<ul class="plain">${rows.map(([test, rule]) => `<li><code>${test}</code><span>${rule}</span></li>`).join("")}</ul>`,
      health: (rows) => `<ul class="plain">${rows.map(([topic, text, test]) => `<li><b>${topic}</b><span>${esc(text)}</span>${test ? `<code>${test}</code>` : "<em>no test</em>"}</li>`).join("")}</ul>`,
    };
    tabs.innerHTML = Object.entries(FINDINGS).map(([k, [label, rows]]) =>
      `<button type="button" role="tab" class="tab" data-tab="${k}" aria-selected="${k === "defects"}">${label}<span>${rows.length}</span></button>`).join("");
    const open = (k) => {
      panel.innerHTML = views[k](FINDINGS[k][1]);
      tabs.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === k));
    };
    tabs.addEventListener("click", (e) => { const t = e.target.closest(".tab"); if (t) open(t.dataset.tab); });
    open("defects");
  }

  /* ── Menu bar: highlight the section in view ── */
  const links = [...document.querySelectorAll(".mb-nav a")];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
  }, { rootMargin: "-40% 0px -55% 0px" });
  document.querySelectorAll("main .cs").forEach((s) => io.observe(s));
})();
