/* LoadMatch — chatbot.js
   A lightweight assistant widget for customers (shippers) and drivers
   (carriers). This is a rule-based/pattern-matching bot wired to the real
   backend via LoadMatchAPI — it is NOT a hosted LLM (no API key is wired
   up here). It can:
     - answer common questions (verification, commission, escrow, GPS, POD)
     - run a live price estimate via /api/pricing/estimate
     - look up a truck or load by ID via the real API
     - check "my matches" if the visitor is logged in
     - route people to the right page (post-truck / post-load / dashboard)
   Drop <script src="assets/js/chatbot.js"></script> on any page, after
   api-client.js. It builds its own DOM and needs no page-specific markup. */
(function () {
  "use strict";
  var API = window.LoadMatchAPI;

  var CITIES = (window.LM && window.LM.CITIES) || ["Accra","Kumasi","Tema","Takoradi","Tamale","Ho","Cape Coast","Sunyani"];

  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return "GH₵ " + Number(n || 0).toLocaleString("en-GH"); }

  // ---------- build widget DOM ----------
  var fab = document.createElement("button");
  fab.className = "lm-chat-fab";
  fab.setAttribute("aria-label", "Open LoadMatch Assistant");
  fab.innerHTML = "💬";

  var panel = document.createElement("div");
  panel.className = "lm-chat-panel";
  panel.innerHTML =
    '<div class="lm-chat-head">' +
      '<div><strong>LoadMatch Assistant</strong><span>For carriers &amp; shippers</span></div>' +
      '<button class="lm-chat-close" aria-label="Close">&times;</button>' +
    '</div>' +
    '<div class="lm-chat-body" id="lm-chat-body"></div>' +
    '<div class="lm-chat-input-row">' +
      '<input id="lm-chat-input" type="text" placeholder="Type a message…" autocomplete="off">' +
      '<button class="btn btn-primary btn-sm" id="lm-chat-send">Send</button>' +
    '</div>';

  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(fab);
    document.body.appendChild(panel);
    wire();
  });
  // In case DOMContentLoaded already fired (script placed at end of body)
  if (document.readyState === "interactive" || document.readyState === "complete") {
    document.body.appendChild(fab);
    document.body.appendChild(panel);
    wire();
  }

  var body, input, sendBtn, wired = false;
  var state = { flow: null, step: null, data: {} };

  function wire() {
    if (wired) return; wired = true;
    body = document.getElementById("lm-chat-body");
    input = document.getElementById("lm-chat-input");
    sendBtn = document.getElementById("lm-chat-send");

    fab.addEventListener("click", function () {
      panel.classList.toggle("open");
      if (panel.classList.contains("open") && !body.dataset.greeted) {
        body.dataset.greeted = "1";
        greet();
      }
    });
    panel.querySelector(".lm-chat-close").addEventListener("click", function () {
      panel.classList.remove("open");
    });
    sendBtn.addEventListener("click", handleSend);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") handleSend(); });
  }

  function addMsg(text, who) {
    var div = document.createElement("div");
    div.className = "lm-msg " + (who === "user" ? "user" : "bot");
    div.innerHTML = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }
  function addQuickReplies(options) {
    var wrap = document.createElement("div");
    wrap.className = "lm-quick-replies";
    options.forEach(function (opt) {
      var b = document.createElement("button");
      b.textContent = opt.label;
      b.addEventListener("click", function () { addMsg(esc(opt.label), "user"); opt.onClick(); });
      wrap.appendChild(b);
    });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  function greet() {
    addMsg("Hi! I'm the LoadMatch Assistant. I can help carriers and shippers with pricing, verification, tracking, and getting listed. What brings you here today?");
    addQuickReplies([
      { label: "I'm a driver (carrier)", onClick: driverFlow },
      { label: "I'm a shipper (customer)", onClick: shipperFlow },
      { label: "Track my shipment", onClick: trackFlow },
      { label: "Ask a question", onClick: function () { addMsg("Sure — ask away (e.g. \"how does escrow work?\", \"what's the commission?\", \"how do I get verified?\")."); } },
    ]);
  }

  function driverFlow() {
    addMsg("Great — as a carrier you can list an empty return leg and get matched with a shipper heading the same way.");
    addQuickReplies([
      { label: "List my empty truck", onClick: function () { window.location.href = "post-truck.html"; } },
      { label: "How does pricing work?", onClick: function () { addMsg("Price = distance × your GH₵/km rate, adjusted for cargo weight/volume, with a small trust premium once you're Verified. You can get a live estimate — tell me your route, e.g. \"Accra to Kumasi\"."); } },
      { label: "How do I get verified?", onClick: function () { addMsg("Once you submit your truck listing, LoadMatch reviews it — typical turnaround is 24 hours. Verified trucks earn a small pricing premium and are trusted more by shippers."); } },
      { label: "Check my matches", onClick: myMatchesFlow },
    ]);
  }

  function shipperFlow() {
    addMsg("Got it — as a shipper you can post a load and get matched with a truck already heading your route empty.");
    addQuickReplies([
      { label: "Post a load", onClick: function () { window.location.href = "post-load.html"; } },
      { label: "How does escrow work?", onClick: function () { addMsg("You pay the agreed price into LoadMatch escrow when the contract is signed. Funds only release to the carrier once delivery is confirmed with a 6-digit OTP code from the recipient — so you're protected the whole way."); } },
      { label: "What's the commission?", onClick: function () { addMsg("LoadMatch takes 3–10% commission per completed deal, shown clearly on the digital contract before anyone signs."); } },
      { label: "Check my matches", onClick: myMatchesFlow },
    ]);
  }

  function trackFlow() {
    if (!API) { addMsg("Sorry, I can't reach the backend right now — try again in a moment."); return; }
    addMsg("You'll need to be logged in to check a shipment's status. What's your account email?");
    state.flow = "track"; state.step = "email"; state.data = {};
  }

  async function myMatchesFlow() {
    if (!API) { addMsg("Sorry, I can't reach the backend right now."); return; }
    if (!API.isLoggedIn()) { trackFlow(); return; }
    addMsg("Checking your matches…");
    try {
      var matches = await API.listMyMatches();
      if (!matches || !matches.length) {
        addMsg("You don't have any matches yet. Head to the Marketplace and hit \"Run matching\" to find one.");
      } else {
        var lines = matches.slice(0, 5).map(function (m) {
          return "#" + m.id + " — status: " + m.status + " — " + fmt(m.estimated_price_ghs);
        }).join("\n");
        addMsg("Here's what I found:\n" + esc(lines) + "\n\nOpen the Dashboard for full details on any of these.");
      }
    } catch (err) {
      addMsg("Couldn't fetch your matches: " + esc(err.message || String(err)));
    }
  }

  async function continueTrackFlow(text) {
    if (state.step === "email") {
      state.data.email = text.trim();
      addMsg("And your password?");
      state.step = "password";
      return;
    }
    if (state.step === "password") {
      state.data.password = text;
      try {
        await API.login(state.data.email, state.data.password);
        addMsg("Logged in! Checking your matches…");
        await myMatchesFlow();
      } catch (err) {
        addMsg("Login failed: " + esc(err.message || String(err)) + ". Want to try again? Just type your email.");
        state.step = "email";
        return;
      }
      state.flow = null; state.step = null;
    }
  }

  function findCity(text) {
    var lower = text.toLowerCase();
    for (var i = 0; i < CITIES.length; i++) {
      if (lower.indexOf(CITIES[i].toLowerCase()) !== -1) return CITIES[i];
    }
    return null;
  }

  async function tryPriceEstimate(text) {
    // Looks for "X to Y" or "X -> Y" pattern among known cities.
    var lower = text.toLowerCase();
    var cities = CITIES.filter(function (c) { return lower.indexOf(c.toLowerCase()) !== -1; });
    if (cities.length < 2) return false;
    var from = cities[0], to = cities[1];
    // Prefer the order they appear in the text.
    if (lower.indexOf(to.toLowerCase()) < lower.indexOf(from.toLowerCase())) { var tmp = from; from = to; to = tmp; }
    addMsg("Estimating a route price for " + esc(from) + " → " + esc(to) + "…");
    try {
      var est = await API.estimatePrice({ from: from, to: to, ratePerKmGhs: 5, weightKg: 3000, volumeM3: 15, verified: "true" });
      addMsg("That route is about " + est.distanceKm + " km. At a sample rate of GH₵5/km for a mid-size load, expect roughly " + fmt(est.estimatedPriceGhs) + ". Your actual price depends on your rate, cargo weight/volume, and verification status.");
    } catch (err) {
      addMsg("Couldn't get an estimate: " + esc(err.message || String(err)));
    }
    return true;
  }

  var FAQ = [
    { k: /verif/i, a: "Carriers submit truck + driver details when listing a truck; LoadMatch reviews within about 24 hours. Verified trucks get a small pricing premium and are trusted more by shippers." },
    { k: /commission|fee/i, a: "LoadMatch charges 3–10% commission per completed deal, shown on the digital contract before signing." },
    { k: /escrow|payment|paid|pay\b/i, a: "Shippers pay into escrow once the contract is signed. Funds release to the carrier only after the recipient confirms delivery with a 6-digit OTP code." },
    { k: /gps|track/i, a: "Once a shipment is in transit, the carrier's app posts GPS breadcrumbs the shipper can follow on the Dashboard." },
    { k: /otp|proof of delivery|pod/i, a: "At delivery, the recipient gives the carrier a 6-digit code shown on the Dashboard. Entering it confirms delivery and releases escrow." },
    { k: /list.*truck|empty truck/i, a: "Head to \"List an Empty Truck\" — plate number, route, capacity and dates. Takes about 2 minutes." },
    { k: /post.*load|ship.*cargo/i, a: "Head to \"Post a Load\" — describe your cargo, route, weight/volume, and budget." },
  ];

  async function handleFreeText(text) {
    if (state.flow === "track") { await continueTrackFlow(text); return; }

    var handled = await tryPriceEstimate(text);
    if (handled) return;

    for (var i = 0; i < FAQ.length; i++) {
      if (FAQ[i].k.test(text)) { addMsg(FAQ[i].a); return; }
    }

    addMsg("I'm not sure about that one — I can help with pricing estimates, verification, escrow/commission, tracking, or getting listed. Try one of the options below, or ask about a specific route like \"Accra to Kumasi price\".");
    addQuickReplies([
      { label: "I'm a driver", onClick: driverFlow },
      { label: "I'm a shipper", onClick: shipperFlow },
      { label: "Track my shipment", onClick: trackFlow },
    ]);
  }

  function handleSend() {
    var text = input.value.trim();
    if (!text) return;
    addMsg(esc(text), "user");
    input.value = "";
    handleFreeText(text);
  }
})();
