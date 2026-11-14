/*
  Background motes: a few dim, slow sparks behind the page (mostly cyan, some warm).
  - Scrolling pushes them along with the page (faster scroll = bigger push, by depth).
  - They lean gently away from the mouse.
  - Off when the visitor asks for reduced motion, paused when the tab is hidden.
  To switch the effect off entirely, set ENABLED to false.
*/
(function () {
  "use strict";
  var ENABLED = true;

  var theme = (window.SITE && window.SITE.theme) || {};
  var canvas = document.querySelector(".embers");
  if (!ENABLED || theme.particles === false || !canvas || !canvas.getContext) return;

  // Particle colour follows the site's accent colour (default cyan = hue 189).
  var baseHue = 189;
  var hex = /^#?([0-9a-f]{6})$/i.exec(String(theme.accent || "").trim());
  if (hex && hex[1].toLowerCase() !== "45e3f2") {
    var n = parseInt(hex[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d) {
      baseHue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      baseHue = (baseHue * 60 + 360) % 360;
    }
  }

  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  var w = 0, h = 0, embers = [];
  var mouse = { x: -9999, y: -9999 };
  var lastScroll = window.scrollY, scrollPush = 0;
  var running = false, frame = 0, last = 0;

  function count() {
    // About one ember per 30,000 px², capped, so phones get fewer.
    return Math.max(18, Math.min(48, Math.round((w * h) / 30000)));
  }

  function spawn(e, anywhere) {
    e.depth = 0.3 + Math.random() * 0.7;              // 0.3 far .. 1 near
    e.x = Math.random() * w;
    e.y = anywhere ? Math.random() * h : h + 10;
    e.r = 0.6 + e.depth * 1.6;
    e.vy = -(6 + Math.random() * 14) * e.depth;       // px per second, upward
    e.vx = (Math.random() - 0.5) * 6;
    e.phase = Math.random() * Math.PI * 2;
    e.alpha = 0.08 + e.depth * 0.24;
    e.hue = Math.random() < 0.8                       // mostly cyan motes, a few warm sparks
      ? baseHue - 7 + Math.random() * 14
      : 28 + Math.random() * 14;
    e.ox = 0;                                         // mouse lean offset
    return e;
  }

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = count();
    while (embers.length < n) embers.push(spawn({}, true));
    embers.length = n;
  }

  function tick(now) {
    if (!running) return;
    var dt = Math.min((now - (last || now)) / 1000, 0.05);
    last = now;

    // Scroll velocity, eased so it fades out after the page stops.
    var y = window.scrollY;
    scrollPush += (y - lastScroll);
    lastScroll = y;
    var push = scrollPush;
    scrollPush *= 0.82;

    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < embers.length; i++) {
      var e = embers[i];
      e.phase += dt * 0.8;
      e.x += (e.vx + Math.sin(e.phase) * 4) * dt;
      e.y += e.vy * dt - push * 0.35 * e.depth;

      // Lean away from the mouse within 140px.
      var dx = e.x - mouse.x, dy = e.y - mouse.y;
      var dist2 = dx * dx + dy * dy;
      var target = 0;
      if (dist2 < 19600) {
        var d = Math.sqrt(dist2) || 1;
        target = (dx / d) * (1 - d / 140) * 28 * e.depth;
      }
      e.ox += (target - e.ox) * Math.min(1, dt * 4);

      if (e.y < -20 || e.y > h + 40 || e.x < -20 || e.x > w + 20) {
        spawn(e, false);
        if (push < -2) e.y = -10;                     // scrolling up: enter from the top
      }

      var flicker = 0.75 + Math.sin(e.phase * 3.1) * 0.25;
      ctx.beginPath();
      ctx.arc(e.x + e.ox, e.y, e.r, 0, Math.PI * 2);
      var a = e.alpha * flicker;
      ctx.fillStyle = "hsla(" + e.hue + ", 90%, 66%, " + a.toFixed(3) + ")";
      ctx.fill();
      if (e.depth > 0.7) {                            // soft halo on the nearest ones
        ctx.beginPath();
        ctx.arc(e.x + e.ox, e.y, e.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = "hsla(" + e.hue + ", 90%, 60%, " + (a * 0.12).toFixed(3) + ")";
        ctx.fill();
      }
    }
    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (running || motion.matches || document.hidden) return;
    running = true;
    last = 0;
    lastScroll = window.scrollY;
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frame);
    if (motion.matches) ctx.clearRect(0, 0, w, h);
  }

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", function (ev) {
    if (ev.pointerType === "mouse") { mouse.x = ev.clientX; mouse.y = ev.clientY; }
  }, { passive: true });
  document.addEventListener("pointerleave", function () { mouse.x = mouse.y = -9999; });
  document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
  if (motion.addEventListener) motion.addEventListener("change", function () { motion.matches ? stop() : start(); });

  resize();
  start();
})();
