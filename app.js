/* ==========================================================================
   [BRO] BROTHERHOOD — shared site script
   - sticky nav shadow + mobile drawer
   - i18n (English native, switchable, graceful fallback)
   - Bear Trap countdown / timezone
   - recruitment application helper
   ========================================================================== */

/* ----------------------------------------------------------------------
   1. I18N
   English is the source language. Translatable elements are tagged with
   data-i18n="key" (textContent) or data-i18n-attr="placeholder:key".
   Missing keys fall back to the English already in the HTML — so the site
   never breaks and can be translated incrementally without redesign.
---------------------------------------------------------------------- */
const I18N = {
  en: {
    "nav.home": "Home",
    "nav.guides": "Guides",
    "nav.beartrap": "Bear Trap",
    "nav.recruit": "Join Us",
    "nav.apply": "Apply",
    "cta.apply": "Apply to Join",
    "cta.readGuides": "Read the Guides",
    "cta.readMore": "Read More",
    "footer.tagline": "A coordinated Kingshot alliance built on shared knowledge, disciplined event play, and members who show up for each other.",
    "footer.explore": "Explore",
    "footer.alliance": "Alliance",
    "footer.rights": "Not affiliated with the developers of Kingshot. Made by the Brotherhood, for the Brotherhood."
  },
  es: {
    "nav.home": "Inicio",
    "nav.guides": "Guías",
    "nav.beartrap": "Trampa del Oso",
    "nav.recruit": "Únete",
    "nav.apply": "Solicitar",
    "cta.apply": "Solicita Unirte",
    "cta.readGuides": "Leer las Guías",
    "cta.readMore": "Leer Más",
    "footer.tagline": "Una alianza coordinada de Kingshot construida sobre el conocimiento compartido, el juego disciplinado y miembros que se apoyan.",
    "footer.explore": "Explorar",
    "footer.alliance": "Alianza",
    "footer.rights": "No afiliado con los desarrolladores de Kingshot. Hecho por la Brotherhood, para la Brotherhood."
  },
  pt: {
    "nav.home": "Início",
    "nav.guides": "Guias",
    "nav.beartrap": "Armadilha do Urso",
    "nav.recruit": "Junte-se",
    "nav.apply": "Candidatar",
    "cta.apply": "Candidate-se",
    "cta.readGuides": "Ler os Guias",
    "cta.readMore": "Saber Mais",
    "footer.tagline": "Uma aliança coordenada de Kingshot construída sobre conhecimento partilhado, jogo disciplinado e membros que se apoiam.",
    "footer.explore": "Explorar",
    "footer.alliance": "Aliança",
    "footer.rights": "Não afiliado aos desenvolvedores de Kingshot. Feito pela Brotherhood, para a Brotherhood."
  }
};

const LANGS = [
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "pt", flag: "🇵🇹", label: "Português" }
];

function applyLang(lang) {
  const dict = I18N[lang] || I18N.en;
  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] != null) el.textContent = dict[key];
    else if (I18N.en[key] != null && lang !== "en") el.textContent = I18N.en[key]; // fallback
  });

  document.querySelectorAll("[data-i18n-attr]").forEach(el => {
    el.getAttribute("data-i18n-attr").split(",").forEach(pair => {
      const [attr, key] = pair.split(":").map(s => s.trim());
      if (dict[key] != null) el.setAttribute(attr, dict[key]);
      else if (I18N.en[key] != null) el.setAttribute(attr, I18N.en[key]);
    });
  });

  const cur = LANGS.find(l => l.code === lang) || LANGS[0];
  const lbl = document.querySelector("[data-lang-label]");
  if (lbl) lbl.textContent = cur.code.toUpperCase();
  document.querySelectorAll("[data-lang-option]").forEach(b =>
    b.classList.toggle("active", b.getAttribute("data-lang-option") === lang)
  );
  try { localStorage.setItem("bro-lang", lang); } catch (e) {}
}

function initLang() {
  const menu = document.querySelector("[data-lang-menu]");
  if (menu) {
    menu.innerHTML = LANGS.map(l =>
      `<button data-lang-option="${l.code}"><span class="flag">${l.flag}</span> ${l.label}</button>`
    ).join("");
    menu.querySelectorAll("[data-lang-option]").forEach(b =>
      b.addEventListener("click", () => {
        applyLang(b.getAttribute("data-lang-option"));
        document.querySelector(".lang")?.classList.remove("open");
      })
    );
  }
  const toggle = document.querySelector("[data-lang-toggle]");
  if (toggle) {
    toggle.addEventListener("click", e => {
      e.stopPropagation();
      document.querySelector(".lang")?.classList.toggle("open");
    });
    document.addEventListener("click", () => document.querySelector(".lang")?.classList.remove("open"));
  }
  let saved = "en";
  try { saved = localStorage.getItem("bro-lang") || "en"; } catch (e) {}
  applyLang(I18N[saved] ? saved : "en");
}

/* ----------------------------------------------------------------------
   2. NAV — shadow on scroll + mobile drawer
---------------------------------------------------------------------- */
function initNav() {
  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  const burger = document.querySelector("[data-burger]");
  const drawer = document.querySelector("[data-drawer]");
  if (burger && drawer) {
    burger.addEventListener("click", () => {
      const open = drawer.classList.toggle("open");
      burger.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
    });
    drawer.querySelectorAll("a").forEach(a =>
      a.addEventListener("click", () => {
        drawer.classList.remove("open");
        burger.innerHTML = '<i class="fa-solid fa-bars"></i>';
      })
    );
  }
}

/* ----------------------------------------------------------------------
   3. BEAR TRAP — timezone aware countdown (UTC 08:00 & 13:00)
---------------------------------------------------------------------- */
function initCountdown() {
  const sel = document.getElementById("tzSelect");
  if (!sel) return;

  const fallback = ["UTC","Europe/London","Europe/Berlin","Europe/Paris","Europe/Moscow",
    "Asia/Dubai","Asia/Kolkata","Asia/Singapore","Asia/Shanghai","Asia/Tokyo",
    "Australia/Sydney","America/New_York","America/Chicago","America/Los_Angeles","America/Sao_Paulo"];
  let zones = fallback;
  if (typeof Intl.supportedValuesOf === "function") {
    try { zones = Intl.supportedValuesOf("timeZone"); } catch (e) {}
  }
  const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  zones.forEach(z => {
    const o = document.createElement("option");
    o.value = z; o.textContent = z;
    if (z === userTZ) o.selected = true;
    sel.appendChild(o);
  });

  // ----- Bear Trap cadence: EVERY SECOND DAY, phases at 08:00 & 13:00 UTC -----
  // ANCHOR_UTC is any date that IS a Bear Trap day. If the schedule is ever a
  // day out of sync, shift this by one day. (2026-06-09 is a Bear Trap day.)
  const DAY_MS = 86400000;
  const BT1_H = 8, BT2_H = 13;
  const CYCLE_DAYS = 2;
  const ANCHOR_DAY = Math.floor(Date.UTC(2026, 5, 9) / DAY_MS);

  const RUN_MS = 30 * 60000; // the bear is live for 30 minutes after each phase starts
  const isBTDay = (d) => ((((d - ANCHOR_DAY) % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS) === 0;

  // Per phase: is it live right now, and if so for how long; otherwise the next
  // future occurrence (always within the 48h cycle).
  const phaseInfo = (hour) => {
    const now = Date.now();
    const today = Math.floor(now / DAY_MS);
    if (isBTDay(today)) {
      const start = today * DAY_MS + hour * 3600000;
      if (now >= start && now < start + RUN_MS) {
        return { live: true, date: new Date(start), ms: (start + RUN_MS) - now };
      }
    }
    for (let i = 0; i < 30; i++) {
      const d = today + i;
      if (!isBTDay(d)) continue;
      const start = d * DAY_MS + hour * 3600000;
      if (start > now) return { live: false, date: new Date(start), ms: start - now };
    }
    return { live: false, date: new Date(today * DAY_MS + hour * 3600000), ms: 0 };
  };
  const fmt = (d, tz) => ({
    time: new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d),
    date: new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "2-digit", month: "short" }).format(d)
  });
  const cd = ms => {
    if (ms < 0) return "starting now…";
    const t = Math.floor(ms / 1000), d = Math.floor(t / 86400),
      h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return "in " + (d > 0 ? d + "d " : "") +
      String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  };
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const mmss = ms => {
    const t = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
  };

  const render = (id, info, tz) => {
    const f = fmt(info.date, tz);
    set(id + "Time", f.time);
    set(id + "Date", f.date + " · " + tz);
    const cdEl = document.getElementById(id + "Countdown");
    if (!cdEl) return;
    const card = cdEl.closest(".tz-card");
    if (info.live) {
      cdEl.textContent = "🔴 ON NOW · ends in " + mmss(info.ms);
      if (card) card.classList.add("live");
    } else {
      cdEl.textContent = cd(info.ms);
      if (card) card.classList.remove("live");
    }
  };

  const banner = document.getElementById("liveBanner");
  const updateBanner = (i1, i2) => {
    if (!banner) return;
    const live = i1.live || i2.live;
    banner.classList.toggle("show", live);
    if (live) {
      const ms = Math.max(i1.live ? i1.ms : 0, i2.live ? i2.ms : 0);
      const t = document.getElementById("liveBannerTime");
      if (t) t.textContent = mmss(ms);
    }
  };

  const tick = () => {
    const tz = sel.value;
    const i1 = phaseInfo(BT1_H), i2 = phaseInfo(BT2_H);
    render("bt1", i1, tz);
    render("bt2", i2, tz);
    updateBanner(i1, i2);
  };
  sel.addEventListener("change", tick);
  tick();
  setInterval(tick, 1000);
}

/* ----------------------------------------------------------------------
   4. RECRUITMENT — build a copy-ready in-game message
---------------------------------------------------------------------- */
function initApply() {
  const form = document.getElementById("applyForm");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = (document.getElementById("igName").value || "").trim();
    const power = (document.getElementById("igPower").value || "").trim();
    const msg = (document.getElementById("igMsg").value || "").trim();
    if (!name || !power) return;

    const out =
`Brotherhood application — Server #1581
In-game name: ${name}
Power: ${power}
${msg ? "Message: " + msg : ""}
→ Send this to R5 Trick or R4 Kadi in game.`;

    const box = document.getElementById("applyCopy");
    const success = document.getElementById("applySuccess");
    if (box) box.textContent = out;
    if (success) success.classList.add("show");
    success?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const copyBtn = document.getElementById("applyCopyBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const text = document.getElementById("applyCopy")?.textContent || "";
      navigator.clipboard?.writeText(text).then(() => {
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
        setTimeout(() => { copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy message'; }, 1800);
      });
    });
  }
}

/* ----------------------------------------------------------------------
   5. HERO ROSTER — generation filter (Bear Trap guide)
   "now" = heroes obtainable at Gen 3 (data-gen <= 3); "all" = everything.
---------------------------------------------------------------------- */
function initHeroFilter() {
  const buttons = document.querySelectorAll("[data-hero-filter]");
  if (!buttons.length) return;
  const cards = document.querySelectorAll(".hcard[data-gen]");
  const hint = document.querySelector("[data-hero-hint]");
  const CURRENT_GEN = 3;

  const apply = mode => {
    cards.forEach(c => {
      const gen = parseInt(c.getAttribute("data-gen"), 10) || 1;
      c.hidden = (mode === "now" && gen > CURRENT_GEN);
    });
    buttons.forEach(b => b.classList.toggle("active", b.getAttribute("data-hero-filter") === mode));
    if (hint) {
      hint.textContent = mode === "now"
        ? "Showing heroes obtainable at Gen 3. Switch to see upcoming Gen 4–7 joiners."
        : "Showing every joiner across all generations, including future Gen 4–7 heroes.";
    }
  };

  buttons.forEach(b => b.addEventListener("click", () => apply(b.getAttribute("data-hero-filter"))));
  apply("now");
}

/* ----------------------------------------------------------------------
   6. SCROLL-SPY — highlight the current section in the guide sub-nav
---------------------------------------------------------------------- */
function initScrollSpy() {
  const links = Array.from(document.querySelectorAll(".subnav a"));
  if (!links.length) return;

  const map = {};
  links.forEach(a => { map[a.getAttribute("href").slice(1)] = a; });
  const sections = Object.keys(map)
    .map(id => document.getElementById(id))
    .filter(Boolean);
  if (!sections.length) return;

  const currentLabel = document.querySelector(".subnav-current");
  let active = null;
  const setActive = id => {
    if (id === active) return;
    active = id;
    links.forEach(a => a.classList.remove("active"));
    const a = map[id];
    if (a) {
      a.classList.add("active");
      if (currentLabel) currentLabel.textContent = a.textContent;          // mobile dropdown label
      if (window.innerWidth > 768) a.scrollIntoView({ inline: "center", block: "nearest" }); // desktop bar only
    }
  };

  const obs = new IntersectionObserver(entries => {
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible[0]) setActive(visible[0].target.id);
  }, { rootMargin: "-130px 0px -62% 0px", threshold: 0 });

  sections.forEach(s => obs.observe(s));
}

/* ----------------------------------------------------------------------
   7. SUB-NAV DROPDOWN (mobile) — open/close the section menu
---------------------------------------------------------------------- */
function initTranslateMenu() {
  const wrap = document.querySelector("[data-tl-menu]");
  const btn = document.querySelector("[data-tl-btn]");
  if (!wrap || !btn) return;
  btn.addEventListener("click", e => {
    e.stopPropagation();
    const open = wrap.classList.toggle("open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", () => {
    wrap.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  });
}

function initSubnav() {
  const nav = document.querySelector(".subnav");
  const toggle = document.querySelector("[data-subnav-toggle]");
  if (!nav || !toggle) return;

  const close = () => { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); };

  toggle.addEventListener("click", e => {
    e.stopPropagation();
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  nav.querySelectorAll(".subnav-inner a").forEach(a => a.addEventListener("click", close));
  document.addEventListener("click", e => { if (!nav.contains(e.target)) close(); });
}

/* ----------------------------------------------------------------------
   7. BOOT
---------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initLang();
  initCountdown();
  initApply();
  initHeroFilter();
  initScrollSpy();
  initSubnav();
  initTranslateMenu();
});
