/* LoadMatch — main.js
   Shared behavior: nav, cookie consent (gates analytics), footer year. */
(function(){
  "use strict";
  window.LM = window.LM || {};
  LM.CONFIG = { ANALYTICS_ID: "G-XXXXXXXXXX", COMMISSION_DEFAULT: 5, COMMISSION_MIN: 3, COMMISSION_MAX: 10 };

  /* ---------- Mobile nav ---------- */
  var toggle = document.getElementById("nav-toggle");
  var links = document.getElementById("nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function(){
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function(el){
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Cookie consent + analytics gating ---------- */
  var CONSENT_KEY = "lm_cookie_consent";
  function getConsent(){ try { return localStorage.getItem(CONSENT_KEY); } catch(e){ return null; } }
  function loadAnalytics(){
    if (LM.CONFIG.ANALYTICS_ID.indexOf("XXXX") !== -1) return; // not configured yet
    var s = document.createElement("script"); s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + LM.CONFIG.ANALYTICS_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", LM.CONFIG.ANALYTICS_ID, { anonymize_ip: true });
  }
  var banner = document.getElementById("cookie-banner");
  function refreshBanner(){
    if (banner && !getConsent()) banner.classList.add("show");
  }
  document.querySelectorAll("[data-consent]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var v = btn.getAttribute("data-consent");
      try { localStorage.setItem(CONSENT_KEY, v); } catch(e){}
      if (banner) banner.classList.remove("show");
      if (v === "accepted") loadAnalytics();
    });
  });
  refreshBanner();
  if (getConsent() === "accepted") loadAnalytics();

  /* ---------- Theme toggle (persisted, respects OS preference) ---------- */
  var THEME_KEY = "lm_theme";
  var metaTheme = document.querySelector('meta[name="theme-color"]');
  function applyTheme(t){
    document.documentElement.setAttribute("data-theme", t);
    if (metaTheme) metaTheme.setAttribute("content", t === "dark" ? "#0B3B2E" : "#FFFFFF");
    document.querySelectorAll(".theme-toggle").forEach(function(btn){
      btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
      btn.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
      var sun = btn.querySelector(".icon-sun"), moon = btn.querySelector(".icon-moon");
      if (sun && moon){
        sun.style.display = t === "dark" ? "block" : "none";
        moon.style.display = t === "dark" ? "none" : "block";
      }
    });
  }
  function getTheme(){
    try {
      var saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch(e){}
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  // Inject toggle into every nav (before the "Get Started" CTA if present)
  var navLinks = document.getElementById("nav-links");
  if (navLinks){
    var li = document.createElement("li");
    li.innerHTML = '<button class="theme-toggle" type="button" aria-label="Switch to dark mode" aria-pressed="false">'+
      '<svg class="icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'+
      '<svg class="icon-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:none"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.3 11.3 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'+
      '</button>';
    var cta = navLinks.querySelector(".btn-primary");
    navLinks.insertBefore(li, cta ? cta.parentNode : null);
    li.firstChild.addEventListener("click", function(){
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      try { localStorage.setItem(THEME_KEY, next); } catch(e){}
      applyTheme(next);
    });
  }
  applyTheme(getTheme());
})();