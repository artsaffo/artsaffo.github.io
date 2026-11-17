/* The interactive spiral: 50 points on a slowly turning logarithmic spiral with a spark riding it.
   Pointing at a point makes the spark arc over to it; letting go lets it ride on from there. */
(function () {
  "use strict";
  var canvas = document.querySelector("[data-spiral]");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");

  var N = 50, TAU = Math.PI * 2, TURNS = TAU * 2.75, R = Math.random;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Colours follow the theme (main.js may have changed --glow from the data file).
  var rootStyle = getComputedStyle(document.documentElement);
  var C = (rootStyle.getPropertyValue("--glow") || "").trim() || "69, 227, 242";
  var W = "255, 255, 255";
  var WARM = "255, 180, 94";

  var BLEED = 0.2;           // the canvas is this much larger than the spiral's box on every side,
                             // so glows and sparks near the edge have room to fade out
  var s = 0;                 // size of the spiral's box in device pixels
  var pad = 0;               // the bleed margin in device pixels
  var rot = 0, spin = 1;     // spiral rotation, and how fast it is turning (slows while held)
  var su = N * 0.3;          // spark position along the spiral, as a point index
  var hold = null;           // index of the point the spark is held on
  var ptr = null;            // pointer position in canvas pixels
  var last = null;           // where the spark was drawn last frame
  var heat = new Float32Array(N);
  var off = [];              // per point: offset x, y and velocity x, y (points shy from the pointer)
  for (var n = 0; n < N; n++) off.push([0, 0, 0, 0]);
  var waves = [], parts = [], arcs = [];

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var size = Math.round(canvas.clientWidth / (1 + 2 * BLEED) * dpr);
    if (size && size !== s) {
      s = size; pad = Math.round(s * BLEED);
      canvas.width = canvas.height = s + 2 * pad;
      if (reduceMotion) step(0, 0);
    }
  }

  function glow(x, y, r, a, col) {
    if (a <= 0.01) return;
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(" + col + "," + Math.min(1, a) + ")");
    g.addColorStop(1, "rgba(" + col + ",0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function jump(k, P) {
    var to = P[k], from = last || to;
    var d = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (d > s * 0.1) { // a real jump across the spiral: arc, burst and a pulse along the points
      arcs.push({ a: [from[0], from[1]], k: k, l: 1 });
      for (var i = 0; i < 10; i++) {
        var a = R() * TAU, v = (0.006 + R() * 0.016) * s;
        parts.push({ x: to[0], y: to[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, warm: R() < 0.18 });
      }
      waves.push({ k: k, r: 0, a: 1 });
    }
    hold = k; su = k;
  }

  function step(t, dt) {
    if (!s) return;
    var h = s / 2, i, k, p, o;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, pad, pad);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    spin += ((hold != null ? 0.12 : 1) - spin) * 0.08;
    rot -= 0.7 * dt * spin;

    // Point positions. Inner points barely react to the pointer so the core keeps its shape.
    var b = 0.2 + 0.025 * Math.sin(t * 1.3), a0 = h * 0.88 / Math.exp(b * TURNS), P = [];
    for (k = 0; k < N; k++) {
      var u = k / (N - 1), th = u * TURNS, r = a0 * Math.exp(b * th);
      var px = h + Math.cos(th + rot) * r, py = h + Math.sin(th + rot) * r;
      o = off[k];
      if (ptr && k !== hold) {
        var loc = Math.pow(Math.min(1, r / (h * 0.6)), 2.5);
        var dx = px + o[0] - ptr[0], dy = py + o[1] - ptr[1], d2 = dx * dx + dy * dy, rr = Math.pow(s * 0.1, 2);
        if (d2 < rr * 4) {
          var f = loc * Math.exp(-d2 / rr) * s * 0.00014 / Math.sqrt(d2 + 1);
          o[2] += dx * f * s; o[3] += dy * f * s;
        }
      }
      o[2] = (o[2] - o[0] * 0.12) * 0.78; o[3] = (o[3] - o[1] * 0.12) * 0.78;
      o[0] += o[2]; o[1] += o[3];
      P.push([px + o[0], py + o[1], u]);
    }

    // Which point the pointer is on: the nearest, with a little stickiness so it doesn't flicker.
    if (ptr) {
      var best = 1e18, bk = 0;
      for (k = 0; k < N; k++) {
        var dd = Math.pow(P[k][0] - ptr[0], 2) + Math.pow(P[k][1] - ptr[1], 2);
        if (dd < best) { best = dd; bk = k; }
      }
      if (hold != null && hold !== bk) {
        var dh = Math.pow(P[hold][0] - ptr[0], 2) + Math.pow(P[hold][1] - ptr[1], 2);
        if (dh < best * 1.6) bk = hold;
      }
      if (bk !== hold) jump(bk, P);
    }

    // The spark: held on a point, or riding from the centre out to the tip.
    var sp, env;
    if (hold != null) {
      sp = P[hold]; env = 1.15 + 0.2 * Math.sin(t * 9); heat[hold] = 1;
    } else {
      su += (N - 1) * 0.33 * dt;
      if (su >= N - 1) su -= N - 1;
      i = Math.floor(su);
      var fr = su - i, A = P[i], B = P[Math.min(N - 1, i + 1)];
      sp = [A[0] + (B[0] - A[0]) * fr, A[1] + (B[1] - A[1]) * fr];
      env = Math.min(1, Math.sin(Math.PI * su / (N - 1)) * 1.6);
      heat[i] = Math.max(heat[i], env);
    }
    last = [sp[0], sp[1]];

    // Pulses travel along the points in both directions from where the spark landed.
    for (i = waves.length; i--;) {
      var w = waves[i];
      w.r += 55 * dt; w.a *= Math.pow(0.063, dt);
      if (w.a < 0.05) { waves.splice(i, 1); continue; }
      [Math.round(w.k - w.r), Math.round(w.k + w.r)].forEach(function (j) {
        if (j >= 0 && j < N) heat[j] = Math.max(heat[j], w.a);
      });
    }

    // Faint line joining the points.
    for (i = 1; i < N; i++) {
      p = P[i];
      ctx.strokeStyle = "rgba(" + C + "," + (0.07 + 0.2 * p[2] + heat[i] * 0.35) + ")";
      ctx.lineWidth = Math.max(0.8, s * 0.016 * p[2] + 0.4);
      ctx.beginPath(); ctx.moveTo(P[i - 1][0], P[i - 1][1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
    }

    // The points. Each one keeps some heat after the spark or a pulse touches it.
    for (k = 0; k < N; k++) {
      p = P[k];
      var ht = heat[k];
      heat[k] *= Math.pow(0.02, dt);
      var pr = Math.max(0.9, s * 0.011 * (0.5 + p[2] * 1.5) * (1 + ht * (0.3 + 0.6 * p[2])));
      ctx.fillStyle = "rgba(" + C + "," + Math.min(1, 0.22 + 0.5 * p[2] + ht) + ")";
      ctx.beginPath(); ctx.arc(p[0], p[1], pr, 0, TAU); ctx.fill();
      if (ht > 0.25) {
        ctx.fillStyle = "rgba(" + W + "," + Math.min(1, (ht - 0.25) * 1.2) + ")";
        ctx.beginPath(); ctx.arc(p[0], p[1], pr * 0.7, 0, TAU); ctx.fill();
        glow(p[0], p[1], pr * 4, ht * 0.35, C);
      }
    }

    // Arcs: a short flickering bolt from where the spark was to where it landed.
    for (i = arcs.length; i--;) {
      var arc = arcs[i], to = P[arc.k];
      arc.l -= dt * 5;
      if (arc.l <= 0) { arcs.splice(i, 1); continue; }
      var ax = to[0] - arc.a[0], ay = to[1] - arc.a[1], d = Math.hypot(ax, ay) || 1, nx = -ay / d, ny = ax / d;
      [[s * 0.022, C, 0.5], [s * 0.008, W, 1]].forEach(function (pass) {
        ctx.strokeStyle = "rgba(" + pass[1] + "," + arc.l * pass[2] + ")";
        ctx.lineWidth = Math.max(0.8, pass[0]);
        ctx.beginPath(); ctx.moveTo(arc.a[0], arc.a[1]);
        for (var j = 1; j < 7; j++) {
          var q = j / 7, jit = (R() - 0.5) * d * 0.22 * Math.sin(q * Math.PI);
          ctx.lineTo(arc.a[0] + ax * q + nx * jit, arc.a[1] + ay * q + ny * jit);
        }
        ctx.lineTo(to[0], to[1]); ctx.stroke();
      });
      glow(arc.a[0], arc.a[1], s * 0.07, arc.l * 0.6, C);
    }

    // The spark itself, smaller near the core so it doesn't swamp the inner points.
    var gs = hold != null ? 0.6 + 0.4 * P[hold][2] : 1;
    glow(sp[0], sp[1], s * 0.12 * env * gs, 0.9 * env, C);
    glow(sp[0], sp[1], s * 0.042 * env * gs, env, W);

    // Burst particles.
    for (i = parts.length; i--;) {
      var q = parts[i];
      q.vx *= 0.93; q.vy = q.vy * 0.93 + s * 0.0004; q.x += q.vx; q.y += q.vy; q.l -= 0.04;
      if (q.l <= 0) { parts.splice(i, 1); continue; }
      ctx.strokeStyle = "rgba(" + (q.warm ? WARM : C) + "," + q.l + ")";
      ctx.lineWidth = Math.max(1, s * 0.011 * q.l);
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 2, q.y - q.vy * 2); ctx.stroke();
    }
  }

  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener("resize", resize);
  resize();

  // Reduced motion: one still frame, no interaction.
  if (reduceMotion) { su = N * 0.62; step(0, 0); return; }

  /* ---------- Pointer ---------- */

  var releaseTimer = 0;
  function point(e) {
    var box = canvas.getBoundingClientRect(), scale = canvas.width / (box.width || 1);
    clearTimeout(releaseTimer);
    ptr = [(e.clientX - box.left) * scale - pad, (e.clientY - box.top) * scale - pad];
  }
  function release() { ptr = null; hold = null; }
  canvas.addEventListener("pointermove", point);
  canvas.addEventListener("pointerdown", point);
  canvas.addEventListener("pointerleave", function (e) {
    // A tap has no hover, so keep the spark on the tapped point for a moment.
    if (e.pointerType === "mouse") release();
    else { clearTimeout(releaseTimer); releaseTimer = setTimeout(release, 1200); }
  });
  canvas.addEventListener("pointercancel", release);

  /* ---------- Run only while on screen ---------- */

  var frame = 0, prev = 0, start = 0;
  function loop(now) {
    if (!start) start = prev = now;
    var dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    step((now - start) / 1000, dt);
    frame = requestAnimationFrame(loop);
  }
  function run(on) {
    if (on && !frame) { prev = performance.now(); frame = requestAnimationFrame(loop); }
    else if (!on && frame) { cancelAnimationFrame(frame); frame = 0; }
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      run(entries[entries.length - 1].isIntersecting);
    }, { rootMargin: "80px 0px" }).observe(canvas);
  } else run(true);
})();
