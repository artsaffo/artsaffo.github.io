/* Renders every page from data/projects.js: silent loops, click-to-load players, lists. */
(function () {
  "use strict";
  var site = window.SITE;
  if (!site) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var autoplay = !reduceMotion && !saveData;

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "text") node.textContent = attrs[key];
        else if (key === "className") node.className = attrs[key];
        else node.setAttribute(key, attrs[key]);
      });
    }
    (children || []).forEach(function (child) {
      if (child) node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function fill(name, items, make) {
    var host = document.querySelector('[data-list="' + name + '"]');
    if (!host || !items) return;
    items.filter(function (item) { return !(item && item.hidden); })
      .forEach(function (item, i) { host.appendChild(make(item, i)); });
  }

  function setField(name, value) {
    var node = document.querySelector('[data-field="' + name + '"]');
    if (node && value) node.textContent = value;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* ---------- Theme: colour and fonts from the data file (only when changed from the defaults) ---------- */

  var DISPLAY_FONTS = {
    "Oswald": "Oswald:wght@500;600;700",
    "Rajdhani": "Rajdhani:wght@500;600;700",
    "Chakra Petch": "Chakra+Petch:wght@500;600;700",
    "Cinzel": "Cinzel:wght@500;600;800",
    "Bebas Neue": "Bebas+Neue"
  };
  var BODY_FONTS = {
    "Inter": "Inter:wght@400;500;600",
    "Source Sans 3": "Source+Sans+3:wght@400;500;600",
    "Rajdhani": "Rajdhani:wght@400;500;600"
  };

  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function mix(rgb, target, amount) {
    return rgb.map(function (c, i) { return Math.round(c + (target[i] - c) * amount); });
  }
  function useFont(name, table, variable, fallback) {
    if (!name || !table[name]) return;
    document.head.appendChild(el("link", {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=" + table[name] + "&display=swap"
    }));
    document.documentElement.style.setProperty(variable, '"' + name + '", ' + fallback);
  }

  var theme = site.theme || {};
  var accent = hexToRgb(theme.accent);
  if (accent && String(theme.accent).trim().toLowerCase() !== "#45e3f2") {
    var rootStyle = document.documentElement.style;
    var deep = mix(accent, [0, 30, 50], 0.45);
    rootStyle.setProperty("--cyan", "rgb(" + accent.join(",") + ")");
    rootStyle.setProperty("--cyan-deep", "rgb(" + deep.join(",") + ")");
    rootStyle.setProperty("--cyan-bright", "rgb(" + mix(accent, [255, 255, 255], 0.3).join(",") + ")");
    rootStyle.setProperty("--glow", accent.join(", "));
    rootStyle.setProperty("--glow-deep", deep.join(", "));
  }
  useFont(theme.displayFont, DISPLAY_FONTS, "--display", '"Arial Narrow", system-ui, sans-serif');
  useFont(theme.bodyFont, BODY_FONTS, "--font", "system-ui, sans-serif");

  /* ---------- Navigation and name, from the data file ---------- */

  var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  var navHost = document.querySelector(".nav");
  if (navHost && site.nav && site.nav.length) {
    navHost.innerHTML = "";
    site.nav.forEach(function (item) {
      if (!item || item.hidden || !item.label) return;
      var attrs = { href: item.href || "#", text: item.label };
      if (String(item.href || "").toLowerCase() === here) attrs["aria-current"] = "page";
      if (/^https?:/i.test(item.href || "")) attrs.rel = "noopener";
      navHost.appendChild(el("li", {}, [el("a", attrs)]));
    });
  }
  if (site.person.name) {
    var mark = document.querySelector(".wordmark");
    if (mark && mark.lastChild) mark.lastChild.textContent = site.person.name;
    var bigName = document.querySelector("[data-name]");
    if (bigName) {
      bigName.innerHTML = "";
      site.person.name.split(/\s+/).forEach(function (word, i) {
        if (i) bigName.appendChild(el("br"));
        bigName.appendChild(document.createTextNode(word));
      });
    }
  }

  /* ---------- Sections: order, titles and which ones show ---------- */

  var pageKey = document.body.getAttribute("data-page");
  var layout = site.pages && site.pages[pageKey];
  var mainNode = document.getElementById("main");
  if (layout && layout.sections && mainNode) {
    var anchor = mainNode.querySelector(".contact");
    var shown = 0;
    layout.sections.forEach(function (s) {
      var node = mainNode.querySelector('[data-section="' + s.id + '"]');
      if (!node) return;
      if (s.show === false) { node.parentNode.removeChild(node); return; }
      mainNode.insertBefore(node, anchor);
      shown += 1;
      var num = node.querySelector(".section-num");
      if (num) num.textContent = pad(shown);
      var heading = node.querySelector("h2");
      if (heading && s.title) heading.textContent = s.title;
    });
    if (!document.getElementById("reel")) {
      var reelLink = document.querySelector('a[href="#reel"]');
      if (reelLink) reelLink.parentNode.removeChild(reelLink);
    }
  }
  setField("contact-title", site.contact && site.contact.title);

  /* ---------- Silent loops: load and play only while on screen ---------- */

  var watcher = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var video = entry.target;
      if (entry.isIntersecting) {
        if (!video.getAttribute("src")) video.src = video.dataset.src;
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      } else if (!video.paused) {
        video.pause();
      }
    });
  }, { rootMargin: "120px 0px", threshold: 0.2 }) : null;

  function loopVideo(src, label, eager) {
    var video = el("video", { muted: "", loop: "", playsinline: "", "aria-label": label });
    video.muted = true; // the attribute alone isn't enough for autoplay in every browser
    if (autoplay && watcher) {
      video.preload = eager ? "auto" : "none";
      video.dataset.src = src;
      watcher.observe(video);
    } else {
      // No autoplay: show a still frame and let the visitor press play.
      video.preload = "metadata";
      video.controls = true;
      video.src = src + "#t=0.5";
    }
    return video;
  }

  /* ---------- Click-to-load players (YouTube / Vimeo) ---------- */

  function embedUrl(video) {
    if (video.youtube) {
      return "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(video.youtube) +
        "?autoplay=1&rel=0&modestbranding=1&playsinline=1";
    }
    if (video.playlist) {
      return "https://www.youtube-nocookie.com/embed/videoseries?list=" + encodeURIComponent(video.playlist) +
        "&autoplay=1&rel=0&playsinline=1";
    }
    if (video.vimeo) {
      return "https://player.vimeo.com/video/" + encodeURIComponent(video.vimeo) + "?autoplay=1&dnt=1";
    }
    return "";
  }

  function loadPlayer(frame, src, label) {
    var iframe = el("iframe", {
      src: src,
      title: label,
      allow: "autoplay; fullscreen; picture-in-picture; encrypted-media",
      allowfullscreen: ""
    });
    frame.innerHTML = "";
    frame.classList.add("media--playing");
    frame.appendChild(iframe);
    iframe.focus();
  }

  function videoFacade(video, label) {
    var frame = el("div", { className: "media" });
    var src = embedUrl(video);
    if (!src) {
      frame.classList.add("media--pending");
      frame.appendChild(el("span", { className: "pending-label", text: "Video coming soon" }));
      return frame;
    }
    if (video.youtube) {
      frame.appendChild(el("img", {
        src: "https://i.ytimg.com/vi/" + encodeURIComponent(video.youtube) + "/hqdefault.jpg",
        alt: "", loading: "lazy", decoding: "async", width: "480", height: "360"
      }));
    } else {
      frame.classList.add("media--noposter");
    }
    var button = el("button", { type: "button", className: "play", "aria-label": "Play video: " + label },
      [el("span", { className: "play-icon", "aria-hidden": "true" })]);
    frame.appendChild(button);
    button.addEventListener("click", function () { loadPlayer(frame, src, label); });
    return frame;
  }

  /* ---------- Header: solid once the page scrolls ---------- */

  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 40); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Hero ---------- */

  setField("role", site.person.role);
  fill("stats", site.person.stats, function (stat) {
    var m = /^(\S+)\s+(.*)$/.exec(stat) || [stat, stat, ""];
    return el("li", { className: "stat" }, [
      el("span", { className: "stat-num", text: m[1] }),
      el("span", { className: "stat-label", text: m[2] })
    ]);
  });

  var heroHost = document.querySelector("[data-hero]");
  if (heroHost && site.hero && site.hero.loop) {
    var heroVideo = loopVideo(site.hero.loop, "", true);
    heroVideo.controls = false;          // decorative background
    heroVideo.removeAttribute("aria-label");
    heroVideo.tabIndex = -1;
    heroHost.appendChild(heroVideo);
    var cap = document.querySelector("[data-hero-caption]");
    if (cap && site.hero.caption) cap.textContent = "Now playing: " + site.hero.caption;
  }

  /* ---------- Reel ---------- */

  var reelHost = document.querySelector("[data-reel]");
  if (reelHost && site.reel) {
    var reel = site.reel;
    if (reel.comingSoon) {
      var holder = el("div", { className: "media reel-placeholder" }, [
        el("div", { className: "reel-copy" }, [
          el("p", { className: "reel-tag", text: "In the edit" }),
          el("p", { className: "reel-heading", text: "New " + reel.title + " coming soon" })
        ])
      ]);
      if (reel.previous) {
        var watch = el("button", { type: "button", className: "btn btn--glow", text: "Watch the " + reel.previous.title });
        holder.querySelector(".reel-copy").appendChild(watch);
        watch.addEventListener("click", function () {
          loadPlayer(holder, embedUrl(reel.previous), reel.previous.title);
          holder.classList.remove("reel-placeholder");
        });
      }
      reelHost.appendChild(holder);
    } else {
      reelHost.appendChild(videoFacade(reel, reel.title));
    }
  }

  /* ---------- Selected work ---------- */

  fill("featured", site.featured, function (item, i) {
    var label = item.title + (item.game && item.game !== item.title ? " (" + item.game + ")" : "");
    var meta = [item.game !== item.title ? item.game : "", item.studio].filter(Boolean).join(" · ");

    var media;
    if (item.loop) {
      media = el("div", { className: "media" }, [loopVideo(item.loop, label + ", effects clip")]);
      if (item.youtube) {
        var sound = el("button", { type: "button", className: "sound-btn", text: "▶ Watch with sound" });
        sound.addEventListener("click", function () { loadPlayer(media, embedUrl(item), label); });
        media.appendChild(sound);
      }
    } else {
      media = videoFacade(item, label);
    }
    media.insertBefore(el("p", { className: "card-num", "aria-hidden": "true", text: pad(i + 1) }), media.firstChild);

    return el("article", { className: "card" }, [
      media,
      el("div", { className: "card-body" }, [
        el("h3", { text: item.title }),
        meta ? el("p", { className: "card-meta", text: meta }) : null,
        el("p", { className: "card-text", text: item.text }),
        item.tools && item.tools.length
          ? el("ul", { className: "tags", "aria-label": "Tools" }, item.tools.map(function (t) { return el("li", { text: t }); }))
          : null
      ])
    ]);
  });

  /* ---------- Shipped titles ---------- */

  fill("credits", site.credits, function (c) {
    var art = c.image
      ? el("div", { className: "title-art" }, [el("img", { src: c.image, alt: "", loading: "lazy", decoding: "async", width: "460", height: "215" })])
      : el("div", { className: "title-art title-art--text", "aria-hidden": "true", text: c.game });
    var role = el("span", { className: "title-role" }, [el("b", { text: c.role })]);
    if (c.studio) role.appendChild(document.createTextNode(" · " + c.studio));
    if (c.year) role.appendChild(document.createTextNode(" · " + c.year));
    var body = [art, el("span", { className: "title-info" }, [el("span", { className: "title-name", text: c.game }), role])];
    var tile = c.url
      ? el("a", { className: "title-tile", href: c.url, rel: "noopener" }, body)
      : el("div", { className: "title-tile" }, body);
    return el("li", {}, [tile]);
  });

  fill("toolkit", site.toolkit, function (t) { return el("li", { text: t }); });

  /* ---------- More Projects page ---------- */

  fill("more", site.more, function (g, i) {
    var id = "group-" + (i + 1);
    var videos = g.videos || [];
    var clips = videos.length ? el("div", { className: "clips" + (g.loops ? " clips--loops" : "") }, videos.map(function (v, n) {
      var label = v.title || (g.title + " clip " + (n + 1));
      var media = v.loop
        ? el("div", { className: "media" }, [loopVideo(v.loop, g.title + ": " + label)])
        : videoFacade(v, g.title + ": " + label);
      return el("figure", { className: "clip" }, [media, v.title ? el("figcaption", { text: v.title }) : null]);
    })) : null;

    return el("section", { className: "section group wrap", "aria-labelledby": id }, [
      el("header", { className: "section-head" }, [
        el("p", { className: "section-num", "aria-hidden": "true", text: pad(i + 1) }),
        el("h2", { id: id, text: g.title }),
        g.meta ? el("p", { className: "group-meta", text: g.meta }) : null
      ]),
      g.text ? el("p", { className: "group-text", text: g.text }) : null,
      g.points ? el("ul", { className: "group-points" }, g.points.map(function (t) { return el("li", { text: t }); })) : null,
      g.chips ? el("ul", { className: "toolkit" }, g.chips.map(function (t) { return el("li", { text: t }); })) : null,
      clips,
      g.links ? el("ul", { className: "link-list" }, g.links.map(function (l) {
        return el("li", {}, [el("a", { className: "btn", href: l.url, rel: "noopener", text: l.label })]);
      })) : null
    ]);
  });

  /* ---------- About page ---------- */

  var bio = document.querySelector("[data-bio]");
  if (bio && site.aboutPage) {
    var ap = site.aboutPage;
    if (ap.photo) {
      bio.classList.add("bio--photo");
      bio.appendChild(el("img", { className: "bio-photo", src: ap.photo, alt: ap.photoAlt || "" }));
    }
    var docs = (ap.docs || []).filter(function (d) { return d.url; });
    bio.appendChild(el("div", { className: "bio-text" },
      ap.paragraphs.map(function (t) { return el("p", { text: t }); }).concat([
        el("p", { className: "education", text: site.person.education }),
        docs.length ? el("ul", { className: "docs" }, docs.map(function (d) {
          return el("li", {}, [el("a", { className: "btn btn--glow", href: d.url, text: d.label })]);
        })) : null
      ])));
  }

  /* ---------- About and contact ---------- */

  setField("about", site.about);
  setField("education", site.person.education);

  var mailNode = document.querySelector("[data-email]");
  if (mailNode && site.person.email) {
    var address = site.person.email.user + "@" + site.person.email.domain;
    mailNode.replaceWith(el("a", { href: "mailto:" + address, className: "email", text: address }));
  }

  fill("links", site.person.links, function (link) {
    return el("li", {}, [el("a", { href: link.url, rel: "me noopener", className: "btn", text: link.label })]);
  });

  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
