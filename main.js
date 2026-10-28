(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ── Deep-space background: milky way, twinkling stars, glows, shooting stars ── */
  const canvas = document.getElementById("stars");
  const ctx = canvas.getContext("2d");
  const sky = document.getElementById("sky");
  const sctx = sky.getContext("2d");
  const TINTS = ["255,255,255", "255,255,255", "205,218,255", "255,236,218", "222,208,255", "176,226,255"];
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  let W = 0, H = 0, dpr = 1, twinklers = [], giants = [], meteors = [], nextMeteor = 0;
  let scrolling = false, scrollTimer, lastFrame = 0;

  // Pre-rendered glow sprite per tint, so bright stars cost one drawImage per frame
  const sprites = {};
  for (const t of new Set(TINTS)) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, `rgba(${t},1)`);
    grd.addColorStop(0.12, `rgba(${t},0.55)`);
    grd.addColorStop(0.4, `rgba(${t},0.08)`);
    grd.addColorStop(1, `rgba(${t},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    // diffraction spikes
    g.globalCompositeOperation = "lighter";
    for (const [w, h] of [[64, 1.2], [1.2, 64]]) {
      const lg = w > h ? g.createLinearGradient(0, 0, 64, 0) : g.createLinearGradient(0, 0, 0, 64);
      lg.addColorStop(0, `rgba(${t},0)`);
      lg.addColorStop(0.5, `rgba(${t},0.7)`);
      lg.addColorStop(1, `rgba(${t},0)`);
      g.fillStyle = lg;
      g.fillRect(32 - w / 2, 32 - h / 2, w, h);
    }
    sprites[t] = c;
  }

  function buildSky() {
    sky.width = W * dpr;
    sky.height = H * dpr;
    sky.style.width = W + "px";
    sky.style.height = H + "px";
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Milky-way band: a diagonal river of faint dust and dense tiny stars
    const ang = -0.42, cx = W * 0.5, cy = H * 0.5, len = Math.hypot(W, H);
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const nx = -uy, ny = ux, band = Math.min(W, H) * 0.16;
    sctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 70; i++) {
      const d = (Math.random() - 0.5) * len, o = gauss() * band * 0.7;
      const x = cx + ux * d + nx * o, y = cy + uy * d + ny * o;
      const r = band * (0.5 + Math.random() * 0.9);
      const tint = pick(["120,140,220", "170,120,200", "110,170,210", "200,150,190"]);
      const g = sctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${tint},0.05)`);
      g.addColorStop(1, `rgba(${tint},0)`);
      sctx.fillStyle = g;
      sctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const dust = Math.round((W * H) / 900);
    for (let i = 0; i < dust; i++) {
      const inBand = Math.random() < 0.65;
      let x, y;
      if (inBand) {
        const d = (Math.random() - 0.5) * len, o = gauss() * band;
        x = cx + ux * d + nx * o; y = cy + uy * d + ny * o;
      } else { x = Math.random() * W; y = Math.random() * H; }
      sctx.fillStyle = `rgba(${pick(TINTS)},${Math.random() * 0.35 + 0.05})`;
      const r = Math.random() * 0.6 + 0.2;
      sctx.fillRect(x, y, r, r);
    }
    sctx.globalCompositeOperation = "source-over";
  }

  function sizeStars() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    buildSky();
    twinklers = Array.from({ length: Math.round((W * H) / 5500) }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 0.9 + 0.35, a: Math.random() * 0.6 + 0.3,
      s: Math.random() * 0.0025 + 0.0005, p: Math.random() * 6.28, t: pick(TINTS),
    }));
    giants = Array.from({ length: Math.max(5, Math.round((W * H) / 110000)) }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      size: Math.random() * 22 + 14, s: Math.random() * 0.0012 + 0.0004, p: Math.random() * 6.28, t: pick(TINTS),
    }));
  }

  function spawnMeteor(now) {
    const fromLeft = Math.random() < 0.5;
    meteors.push({
      x: fromLeft ? Math.random() * W * 0.6 : W * 0.4 + Math.random() * W * 0.6,
      y: Math.random() * H * 0.45,
      vx: (fromLeft ? 1 : -1) * (0.9 + Math.random() * 0.6), vy: 0.38 + Math.random() * 0.25,
      born: now, life: 900 + Math.random() * 500,
    });
    nextMeteor = now + 3500 + Math.random() * 6000;
  }

  function drawStars(now = 0) {
    if (!reduced) requestAnimationFrame(drawStars);
    // Twinkles are slow, so ~30fps is plenty; and while the page scrolls, keep the
    // canvas frozen so the main thread and compositor only have to move content.
    if (!reduced && (scrolling || now - lastFrame < 33)) return;
    lastFrame = now;
    if (!W || !H) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // twinkling stars
    for (const s of twinklers) {
      const tw = reduced ? 1 : 0.45 + 0.55 * Math.abs(Math.sin(now * s.s + s.p));
      ctx.fillStyle = `rgba(${s.t},${s.a * tw})`;
      ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }

    // bright stars with glow and spikes
    ctx.globalCompositeOperation = "lighter";
    for (const g of giants) {
      const tw = reduced ? 1 : 0.7 + 0.3 * Math.sin(now * g.s + g.p);
      const sz = g.size * tw;
      ctx.globalAlpha = 0.55 + 0.45 * tw;
      ctx.drawImage(sprites[g.t], g.x - sz / 2, g.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;

    // shooting stars
    if (!reduced) {
      if (!nextMeteor) nextMeteor = now + 2500;
      if (now > nextMeteor) spawnMeteor(now);
      meteors = meteors.filter((m) => now - m.born < m.life);
      for (const m of meteors) {
        const k = (now - m.born) / m.life;
        const dist = k * 520, x = m.x + m.vx * dist, y = m.y + m.vy * dist;
        const tail = 90 * Math.sin(Math.PI * k);
        const fade = Math.sin(Math.PI * k);
        const g = ctx.createLinearGradient(x, y, x - m.vx * tail, y - m.vy * tail);
        g.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
        g.addColorStop(1, "rgba(180,200,255,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - m.vx * tail, y - m.vy * tail);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  sizeStars();
  drawStars();
  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (innerWidth === W && Math.abs(innerHeight - H) < 160) return;
      sizeStars();
      if (reduced) drawStars();
    }, 150);
  });
  addEventListener("scroll", () => {
    scrolling = true;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { scrolling = false; }, 140);
  }, { passive: true });

  /* ── Reveal on scroll ── */
  const revealIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      revealIO.unobserve(e.target);
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal").forEach((el) => revealIO.observe(el));

  /* ── Menu bar clock (visitor's local time) ── */
  const clock = document.getElementById("clock");
  const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
  const tickClock = () => { clock.textContent = fmt.format(new Date()); };
  tickClock();
  setInterval(tickClock, 15000);
  document.getElementById("year").textContent = new Date().getFullYear();

  /* ── Active section → menu bar + dock ── */
  const links = [...document.querySelectorAll('.mb-nav a, .dock-item[href^="#"]')];
  const sectionIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const id = "#" + e.target.id;
      links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === id));
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll("main .section").forEach((s) => sectionIO.observe(s));

  /* ── Diagrams: blocks wired with elbow connectors. Selecting a block lights its
        wires and explains it in the panel underneath. Used by Stack and Portfolio. ── */
  const wireDiagram = (root, detail, { nodes, wires, order, pinned, markers = ["ah", "ah-on"] }) => {
    const svgG = root.querySelector(".wire-paths");
    const blocks = [...root.querySelectorAll("[data-node]")];
    // Wires attach to [data-wire] (a region) or to the block itself.
    const anchor = (id) => root.querySelector(`[data-wire="${id}"]`) || root.querySelector(`[data-node="${id}"]`);
    const wireOf = (id) => root.querySelector(`[data-node="${id}"]`).closest("[data-wire]")?.dataset.wire || id;
    const narrow = matchMedia("(max-width: 900px)");
    // In the single-column layout every block sits under the previous one,
    // so only consecutive steps are wired.
    const wiresNow = () => (narrow.matches ? order.slice(1).map((n, k) => [order[k], n]) : wires);
    let shown = null;

    // Polyline through points with rounded corners.
    const rounded = (pts, r = 10) => {
      pts = pts.filter((p, k) => k === 0 || p[0] !== pts[k - 1][0] || p[1] !== pts[k - 1][1]);
      let d = `M${pts[0][0]},${pts[0][1]}`;
      for (let k = 1; k < pts.length - 1; k++) {
        const [px, py] = pts[k - 1], [cx, cy] = pts[k], [nx, ny] = pts[k + 1];
        const r1 = Math.min(r, Math.hypot(cx - px, cy - py) / 2), r2 = Math.min(r, Math.hypot(nx - cx, ny - cy) / 2);
        const a = [cx - Math.sign(cx - px) * r1, cy - Math.sign(cy - py) * r1];
        const b = [cx + Math.sign(nx - cx) * r2, cy + Math.sign(ny - cy) * r2];
        d += ` L${a[0]},${a[1]} Q${cx},${cy} ${b[0]},${b[1]}`;
      }
      const last = pts[pts.length - 1];
      return d + ` L${last[0]},${last[1]}`;
    };

    const route = (from, to, kind) => {
      const box = root.getBoundingClientRect();
      const L = (el) => {
        const r = el.getBoundingClientRect();
        return { l: r.left - box.left, r: r.right - box.left, t: r.top - box.top, b: r.bottom - box.top, cx: r.left + r.width / 2 - box.left, cy: r.top + r.height / 2 - box.top };
      };
      const A = L(anchor(from)), B = L(anchor(to)), gap = 3;
      if (kind === "loop") {
        const y = box.height - 8;
        return rounded([[A.cx, A.b + gap], [A.cx, y], [B.cx, y], [B.cx, B.b + gap]], 14);
      }
      if (B.l >= A.r - 2) {                                   // target to the right
        const y1 = Math.max(A.t + 14, Math.min(A.b - 14, B.cy));
        const y2 = Math.max(B.t + 14, Math.min(B.b - 14, y1));
        const xm = (A.r + B.l) / 2;
        return rounded([[A.r + gap, y1], [xm, y1], [xm, y2], [B.l - gap - 2, y2]]);
      }
      if (B.t >= A.b - 2) {                                   // target below
        const x1 = Math.max(A.l + 14, Math.min(A.r - 14, B.cx));
        const x2 = Math.max(B.l + 14, Math.min(B.r - 14, x1));
        const ym = (A.b + B.t) / 2;
        return rounded([[x1, A.b + gap], [x1, ym], [x2, ym], [x2, B.t - gap - 2]]);
      }
      const ym = (A.t + B.b) / 2;                             // target above
      return rounded([[A.cx, A.t - gap], [A.cx, ym], [B.cx, ym], [B.cx, B.b + gap + 2]]);
    };

    const draw = () => {
      const lit = shown && wireOf(shown);
      svgG.innerHTML = wiresNow().map(([f, t, kind]) => {
        const on = lit && (f === lit || t === lit);
        return `<path class="${on ? "on" : ""}" d="${route(f, t, kind)}" marker-end="url(#${markers[on ? 1 : 0]})"/>`;
      }).join("");
    };

    const show = (id) => {
      if (id === shown) return;
      shown = id;
      const w = wireOf(id);
      const linked = new Set(wiresNow().flatMap(([f, t]) => (f === w ? [t] : t === w ? [f] : [])));
      if (w !== id) linked.add(w);
      root.classList.add("has-sel");
      blocks.forEach((b) => {
        const n = b.dataset.node;
        b.classList.toggle("selected", n === id);
        const region = b.closest("[data-wire]")?.dataset.wire;
        // Blocks inside a selected region count as part of it.
        b.classList.toggle("linked", linked.has(n) || linked.has(region) || (region === w && n !== id));
        b.setAttribute("aria-pressed", n === pinned);
      });
      const [title, text, items = []] = nodes[id];
      const list = items.map(([name, desc]) => `<li><b>${name}</b><span class="desc"> · ${desc}</span></li>`).join("");
      detail.innerHTML = `<div><p class="head"><b>${title}</b></p><p>${text}</p>${list ? `<ul>${list}</ul>` : ""}</div>`;
      draw();
    };

    // Reserve the tallest explanation so the diagram never jumps while hovering
    // (desktop only; on narrow screens the panel floats and sizes to its content).
    const reserveDetail = () => {
      detail.style.minHeight = "";
      if (narrow.matches) return;
      let max = 0;
      for (const id of Object.keys(nodes)) { shown = null; show(id); max = Math.max(max, detail.offsetHeight); }
      detail.style.minHeight = max + "px";
      shown = null;
      show(pinned);
    };

    blocks.forEach((b) => {
      const id = b.dataset.node;
      b.addEventListener("click", () => { pinned = id; shown = null; show(id); detail.classList.add("active"); root.classList.add("touched"); });
      b.addEventListener("focus", () => { if (b.matches(":focus-visible")) { pinned = id; show(id); detail.classList.add("active"); root.classList.add("touched"); } });
      b.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") show(id); });
    });
    root.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") show(pinned); });

    show(pinned);
    reserveDetail();
    // Wires follow the layout: after the window finishes opening, on resize and once fonts load.
    root.closest(".window").addEventListener("transitionend", draw);
    // Only width changes reflow the diagram; mobile browsers fire resize when the
    // address bar shows or hides during scrolling, and that shouldn't redraw anything.
    let wireTimer, lastWidth = innerWidth;
    addEventListener("resize", () => {
      if (innerWidth === lastWidth) return;
      lastWidth = innerWidth;
      clearTimeout(wireTimer);
      wireTimer = setTimeout(() => { reserveDetail(); draw(); }, 120);
    });
    document.fonts?.ready.then(() => { reserveDetail(); draw(); });
    return { draw };
  };

  const stackDiagram = document.getElementById("diagram");
  if (stackDiagram) {
    const TOOLS = {
      jira: ["Jira & Xray", "Test plans, cases and defects. Xray links every test to the requirement it covers."],
      "azure-devops": ["Azure DevOps", "Requirement traceability, test runs and defect tracking."],
      cucumber: ["Cucumber · BDD", "Gherkin scenarios that business, dev and QA agree on before any code is written."],
      serenity: ["Serenity BDD · Screenplay", "My main framework. The Screenplay pattern keeps web and API tests readable and reusable as suites grow."],
      playwright: ["Playwright", "Fast cross-browser web tests in TypeScript. It powers the portfolio project below."],
      selenium: ["Selenium", "Browser automation for web apps, also used under the hood by Serenity."],
      appium: ["Appium", "Tests for native mobile apps on Android and iOS."],
      restassured: ["RestAssured", "API tests in Java: REST services, authentication flows and response data."],
      karate: ["Karate DSL", "API tests in a readable syntax that non-developers can review."],
      testcontainers: ["TestContainers", "Throwaway databases and services in Docker, so tests don't share state."],
      java: ["Java", "Main language for frameworks, internal tools and test data utilities."],
      typescript: ["TypeScript", "Language for Playwright suites."],
      copilot: ["GitHub Copilot", "Writing and refactoring test code faster inside the IDE."],
      "ms-copilot": ["Microsoft Copilot", "Analysing requirements and drafting test cases and documentation at work."],
      "claude-code": ["Claude Code", "Agentic coding assistant with reusable skills. I built this site with it, reviewing each change like a release."],
      gemini: ["Gemini API", "Explains failed tests in my Playwright project, where I try newer AI ideas."],
      jenkins: ["Jenkins", "Pipelines that build, test and deploy on every change."],
      "github-actions": ["GitHub Actions", "CI for GitHub repositories, including the portfolio suite."],
      docker: ["Docker", "The same environment locally, in CI and in the cloud."],
      browserstack: ["BrowserStack", "Real devices and browsers in the cloud."],
      vault: ["HashiCorp Vault", "Secrets and certificates for test runs, never hard-coded."],
      "gh-secrets": ["GitHub Secrets", "Encrypted keys for CI runs, injected at run time and never stored in the code. The portfolio suite keeps its Gemini API key here."],
      salesforce: ["Salesforce", "CRM under test: UI, APIs and data."],
      sqlserver: ["SQL Server", "What the UI shows is what was stored."],
      mongodb: ["MongoDB", "Test data for NoSQL services."],
      oracle: ["OracleDB", "Enterprise data validation."],
      adf: ["Azure Data Factory", "ETL: files, rules and loads."],
      jmeter: ["JMeter", "Load, stress and spike tests on microservices."],
      k6: ["k6", "Scripted load tests that can run in CI."],
      zap: ["OWASP ZAP", "Automated security scans before a release reaches production."],
      burp: ["Burp Suite", "Hands-on security testing of web apps and APIs."],
      auth: ["JWT, SSO and MFA", "Certificate-based JWT Bearer login for automation, plus SSO and phishing-resistant MFA for elevated access."],
      payments: ["Payments · ISO 8583", "Card, POS and settlement flows."],
      allure: ["Allure Report", "Readable test reports with steps, screenshots, video and traces."],
    };
    const T = (ids) => ids.map((t) => TOOLS[t]);
    // Logo for each tool: [file, class]; "sil" = white silhouette, "color" = brand colors.
    const ICONS = {
      jira: ["jira.svg"], "azure-devops": ["azuredevops.svg"], cucumber: ["cucumber.svg"],
      java: ["openjdk.svg"], typescript: ["typescript.svg"], copilot: ["githubcopilot.svg"], "ms-copilot": ["mscopilot.png", "color"], "claude-code": ["claude.svg"], gemini: ["googlegemini.svg"],
      jenkins: ["jenkins.svg"], "github-actions": ["githubactions.svg"],
      serenity: ["serenity.png", "sil"], playwright: ["playwright.svg"], restassured: ["restassured.png", "sil"],
      karate: ["karate.svg"], selenium: ["selenium.svg"], appium: ["appium.svg"],
      docker: ["docker.svg"], testcontainers: ["testcontainers.svg", "color"], browserstack: ["browserstack.svg", "color"],
      vault: ["vault.svg"], "gh-secrets": ["github.svg"],
      jmeter: ["apachejmeter.svg"], k6: ["k6.svg"], zap: ["owasp.svg"], burp: ["burpsuite.svg"], auth: ["jwt.svg"], payments: ["payments.svg"],
      salesforce: ["salesforce.svg"], sqlserver: ["sqlserver.svg"], mongodb: ["mongodb.svg"],
      oracle: ["oracle.svg"], adf: ["azure.svg"], allure: ["allure.png", "color"],
    };
    const TOOLSET = {
      plan: ["jira", "azure-devops", "cucumber"],
      code: ["java", "typescript"],
      ai: ["copilot", "ms-copilot", "claude-code", "gemini"],
      ci: ["jenkins", "github-actions"],
      fw: ["serenity", "playwright", "restassured", "karate", "selenium", "appium"],
      exec: ["docker", "testcontainers", "browserstack", "vault", "gh-secrets"],
      load: ["jmeter", "k6", "zap", "burp", "auth"],
      sut: ["salesforce", "sqlserver", "mongodb", "oracle", "adf", "payments"],
      reports: ["allure"],
    };
    // On phones a block opens in place and shows its tools as icon chips.
    for (const [node, ids] of Object.entries(TOOLSET)) {
      const chips = ids.map((t) => {
        const [file, cls] = ICONS[t];
        return `<span class="tchip"><img src="assets/icons/${file}" alt=""${cls ? ` class="${cls}"` : ""}>${TOOLS[t][0]}</span>`;
      }).join("");
      stackDiagram.querySelector(`[data-node="${node}"]`).insertAdjacentHTML("beforeend", `<span class="tools" aria-hidden="true"><span class="tools-inner">${chips}</span></span>`);
    }
    const stack = wireDiagram(stackDiagram, document.getElementById("arch-detail"), {
      pinned: "fw",
      markers: ["dot", "dot-on"],
      nodes: {
        team: ["QA and dev team", "Where every test starts: a risk, a requirement or a bug worth never seeing again."],
        plan: ["Plan", "Decide what to test and agree on it before code exists.", T(TOOLSET.plan)],
        code: ["Code", "Write tests, frameworks and internal tooling.", T(TOOLSET.code)],
        ai: ["AI assist", "Copilot at work, an agent with skills for this site and an LLM that triages failures in my own project. Backed by ISTQB CT-AI: I also know how to test AI systems.", T(TOOLSET.ai)],
        ci: ["CI pipeline", "Every change triggers the suites automatically.", T(TOOLSET.ci)],
        fw: ["Test framework", "The automation itself: UI, API and mobile tests.", T(TOOLSET.fw)],
        exec: ["Execution", "Where the tests actually run.", T(TOOLSET.exec)],
        load: ["Load and security", "How the system behaves under pressure and under attack, and how it authenticates.", T(TOOLSET.load)],
        sut: ["Systems under test", "What gets checked: front ends, services and the data behind them.", T(TOOLSET.sut)],
        reports: ["Reports", "Evidence the team can read: what passed, what failed and why.", T(TOOLSET.reports)],
      },
      // [from, to, kind]; kind "loop" runs along the bottom back to the start.
      wires: [
        ["team", "plan"], ["team", "code"], ["plan", "code"], ["ai", "code"], ["ai", "reports"],
        ["code", "fw"], ["ci", "fw"], ["fw", "exec"], ["exec", "sut"],
        ["load", "sut"], ["fw", "reports"], ["reports", "team", "loop"],
      ],
      order: ["team", "plan", "code", "ai", "ci", "fw", "exec", "load", "sut", "reports"],
    });

    const phone = matchMedia("(max-width: 640px)");
    stackDiagram.querySelectorAll("[data-node]").forEach((b) => b.addEventListener("click", () => {
      if (!phone.matches || !b.querySelector(".tools")) return;
      const open = !b.classList.contains("open");
      stackDiagram.querySelectorAll(".open").forEach((o) => o.classList.remove("open"));
      b.classList.toggle("open", open);
      setTimeout(stack.draw, 300); // fallback if transitionend doesn't fire
    }));
    // Re-route the wires once a block finishes opening or closing.
    stackDiagram.addEventListener("transitionend", (e) => { if (e.propertyName === "grid-template-rows") stack.draw(); });
  }

  const repoDiagram = document.getElementById("repo-diagram");
  if (repoDiagram) {
    wireDiagram(repoDiagram, document.getElementById("repo-detail"), {
      pinned: "suite",
      nodes: {
        dev: ["A code change", "Someone pushes to GitHub. Nobody presses \"run\": everything after this is automatic."],
        repo: ["GitHub repository", "Tests, page objects and configuration live here, in TypeScript. Every push or pull request starts a run."],
        ci: ["GitHub Actions", "A clean Ubuntu machine installs everything from scratch, so results never depend on one laptop. Flaky tests get two retries, and the Gemini API key comes from GitHub Secrets."],
        suite: ["Playwright · 31 tests", "Every test runs in Chromium, Firefox and WebKit (Safari) and records a screenshot, a video and a trace. Select a group to see what it checks."],
        ui: ["Shopping flows · 9 tests", "Can people log in, browse and sort products, add to the cart and complete a purchase? Wrong passwords must be rejected."],
        api: ["API and contract · 9 tests", "Does PokeAPI return the right data and errors, and keep the fields and types that apps built on it rely on?"],
        a11y: ["Accessibility · 3 tests", "Can people using screen readers or a keyboard use the shop? Checked against WCAG 2.0 A and AA with axe-core."],
        visual: ["Visual regression · 3 tests", "Does every page still look like its approved screenshot? A change of more than 2% of pixels fails."],
        mobile: ["Mobile · 3 tests", "Does the shop work on iPhone 13 and Pixel 5 screens, not only on desktop?"],
        perf: ["Performance · 3 tests", "Does it load fast enough? First and largest paint (Core Web Vitals) and page load times are checked against budgets."],
        apps: ["Applications under test", "Public demo targets, so anyone can rerun the suite and get the same results.", [
          ["Sauce Demo", "a practice online store built for testing"],
          ["PokeAPI", "a free public REST API"],
        ]],
        ai: ["Gemini AI review · 1 test", "A demo of AI-assisted triage: a known login failure is sent to Google Gemini, which answers with the likely root cause, a fix and how to prevent it."],
        report: ["Live reports", "Published to GitHub Pages after every run: Allure for a readable story of each test, Playwright's own report for traces, screenshots and video. <a class=\"inline-link\" href=\"https://dwhytan.github.io/playwright-e2e-framework/allure/\" target=\"_blank\" rel=\"noopener\">Allure ↗</a> · <a class=\"inline-link\" href=\"https://dwhytan.github.io/playwright-e2e-framework/playwright/\" target=\"_blank\" rel=\"noopener\">Playwright ↗</a>"],
      },
      wires: [
        ["dev", "repo"], ["repo", "ci"], ["ci", "suite"], ["suite", "apps"],
        ["suite", "ai"], ["suite", "report"], ["report", "dev", "loop"],
      ],
      order: ["dev", "repo", "ci", "suite", "apps", "ai", "report"],
    });
  }

  /* ── Badges: name the badge in the caption beside the row. Mouse: hover only,
        so a click never leaves one stuck open. Keyboard: focus. Touch (no hover,
        and iOS Safari doesn't focus buttons on tap): tap selects, tap again or
        elsewhere clears. ── */
  const certsRow = document.querySelector(".certs-row");
  const badges = [...document.querySelectorAll(".badge")];
  const caption = certsRow && certsRow.querySelector(".cap-live");
  const show = (b) => {
    caption.innerHTML = `${b.dataset.name} <em>· ${b.dataset.org}</em>`;
    certsRow.classList.add("showing");
  };
  const clear = () => {
    certsRow.classList.remove("showing");
    badges.forEach((o) => o.classList.remove("active"));
  };
  badges.forEach((b) => {
    b.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") show(b); });
    b.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") clear(); });
    b.addEventListener("focus", () => { if (b.matches(":focus-visible")) show(b); });
    b.addEventListener("blur", clear);
    b.addEventListener("click", (e) => {
      if (finePointer) return;
      e.stopPropagation();
      const on = !b.classList.contains("active");
      clear();
      if (on) { b.classList.add("active"); show(b); }
    });
  });
  document.addEventListener("click", () => { if (!finePointer) clear(); });

  /* ── About: highlight chips explain themselves (hover / keyboard / tap) ── */
  const pcap = document.querySelector(".pchip-caption");
  if (pcap) {
    const pchips = [...document.querySelectorAll(".pchip")];
    const live = pcap.querySelector(".cap-live");
    if (!finePointer) pcap.querySelector(".cap-default").textContent = "how I work · tap a chip for details";
    const showTip = (c) => { live.textContent = c.dataset.tip; pcap.classList.add("showing"); };
    const hideTip = () => { pcap.classList.remove("showing"); pchips.forEach((o) => o.classList.remove("active")); };
    pchips.forEach((c) => {
      c.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") showTip(c); });
      c.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hideTip(); });
      c.addEventListener("focus", () => { if (c.matches(":focus-visible")) showTip(c); });
      c.addEventListener("blur", hideTip);
      c.addEventListener("click", (e) => {
        if (finePointer) return;
        e.stopPropagation();
        const on = !c.classList.contains("active");
        hideTip();
        if (on) { c.classList.add("active"); showTip(c); }
      });
    });
    document.addEventListener("click", () => { if (!finePointer) hideTip(); });
  }

  /* ── About: "whoami" types itself once on load ── */
  const typed = document.querySelector(".typed");
  if (typed && !reduced) {
    const text = typed.dataset.text;
    typed.textContent = "";
    typed.classList.add("typing");
    [...text].forEach((ch, k) => setTimeout(() => {
      typed.textContent += ch;
      if (k === text.length - 1) setTimeout(() => typed.classList.remove("typing"), 250);
    }, 300 + k * 75));
  }

  if (!finePointer || reduced) return;

  /* ── Dock magnification ── */
  const dock = document.querySelector(".dock");
  const items = [...dock.querySelectorAll(".dock-item")];
  dock.addEventListener("pointermove", (e) => {
    for (const it of items) {
      const r = it.getBoundingClientRect();
      const d = Math.abs(e.clientX - (r.left + r.width / 2));
      const s = 1 + 0.42 * Math.max(0, 1 - d / 110);
      it.style.setProperty("--s", s.toFixed(3));
    }
  });
  dock.addEventListener("pointerleave", () => items.forEach((it) => it.style.setProperty("--s", 1)));

  /* ── Glass sheen follows the pointer ── */
  document.querySelectorAll(".window").forEach((w) => {
    w.addEventListener("pointermove", (e) => {
      const r = w.getBoundingClientRect();
      w.style.setProperty("--mx", e.clientX - r.left + "px");
      w.style.setProperty("--my", e.clientY - r.top + "px");
    });
  });
})();
