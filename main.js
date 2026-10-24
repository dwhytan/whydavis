(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ── Starfield ── */
  const canvas = document.getElementById("stars");
  const ctx = canvas.getContext("2d");
  let stars = [];

  function sizeStars() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((innerWidth * innerHeight) / 6000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: Math.random() * 1.1 + 0.2,
      a: Math.random() * 0.7 + 0.2,
      s: Math.random() * 0.002 + 0.0006,
      p: Math.random() * Math.PI * 2,
    }));
  }

  function drawStars(t = 0) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const s of stars) {
      const tw = reduced ? 1 : 0.55 + 0.45 * Math.sin(t * s.s + s.p);
      ctx.fillStyle = `rgba(255,255,255,${s.a * tw})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!reduced) requestAnimationFrame(drawStars);
  }

  sizeStars();
  drawStars();
  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { sizeStars(); if (reduced) drawStars(); }, 150);
  });

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
