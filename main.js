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
