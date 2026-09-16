/* LoadMatch — pages.js — page-specific logic, wired to the real backend
   via LoadMatchAPI. Field names below match api.js / db.js exactly:
   trucks:  plate_no, truck_type, from_city, to_city, capacity_kg, volume_m3,
            rate_per_km_ghs, available_from, available_to, status, user_id
   loads:   description, from_city, to_city, weight_kg, volume_m3, budget_ghs,
            pickup_date, delivery_date, status, user_id
   matches: truck_id, load_id, score, distance_km, estimated_price_ghs,
            commission_pct, status
   /api/matches/run candidates: { truckId, loadId, score, distanceKm,
            estimatedPriceGhs, reason, truckVerified } — camelCase, and no
            nested truck/load objects (look those up separately). */
(function(){
  "use strict";
  var API = window.LoadMatchAPI;
  if (!API) { console.error("LoadMatchAPI missing — check api-client.js loaded before pages.js"); return; }

  var $ = function(s, r){ return (r||document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  var esc = function(s){ return (s==null?"":String(s)).replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); };
  var fmt = function(n){ return "GH₵ " + Number(n||0).toLocaleString("en-GH"); };
  var badge = function(status){
    if (status === "verified") return '<span class="badge badge-verified">Verified</span>';
    if (status === "rejected") return '<span class="badge">Rejected</span>';
    return '<span class="badge badge-pending">Verification pending</span>';
  };
  function showError(container, err){
    if (!container) return;
    container.innerHTML = '<div class="empty-state">'+esc(err && err.message ? err.message : String(err))+'</div>';
  }

  /* ================= MARKETPLACE ================= */
  var truckList = $("#truck-list"), loadList = $("#load-list");
  if (truckList || loadList) {
    var cachedTrucks = [], cachedLoads = [];

    function truckCard(t){
      return '<article class="card"><div class="route"><span>'+esc(t.from_city)+'</span><span class="arrow" aria-hidden="true">→</span><span>'+esc(t.to_city)+'</span></div>'+
        '<p class="route-meta">'+esc(t.truck_type)+' · '+Number(t.capacity_kg).toLocaleString()+' kg · '+esc(t.volume_m3)+' m³ · '+esc(t.plate_no)+'</p>'+
        '<p>'+badge(t.status)+'</p>'+
        '<p class="price-tag">'+esc(t.rate_per_km_ghs)+' GH₵/km · returning '+esc(t.available_from)+' → '+esc(t.available_to)+'</p>'+
        '<a class="btn btn-primary btn-sm" href="dashboard.html">Book backhaul</a></article>';
    }
    function loadCard(l){
      return '<article class="card"><div class="route"><span>'+esc(l.from_city)+'</span><span class="arrow" aria-hidden="true">→</span><span>'+esc(l.to_city)+'</span></div>'+
        '<p class="route-meta">'+esc(l.description)+' · '+Number(l.weight_kg).toLocaleString()+' kg · '+esc(l.volume_m3)+' m³</p>'+
        '<p><span class="badge '+(l.status==="open"?"badge-live":"badge-match")+'">'+esc(l.status)+'</span></p>'+
        '<p class="price-tag">Budget '+fmt(l.budget_ghs)+' · pickup '+esc(l.pickup_date)+'</p>'+
        '<a class="btn btn-ghost btn-sm" href="dashboard.html">Find truck</a></article>';
    }
    function fillCities(){
      var sel = $("#mp-city");
      if (!sel) return;
      var cities = {};
      cachedTrucks.concat(cachedLoads).forEach(function(x){ if (x && x.from_city) cities[x.from_city] = true; });
      Object.keys(cities).sort().forEach(function(c){
        var o = document.createElement("option"); o.value = c; o.textContent = c; sel.appendChild(o);
      });
    }
    function renderLists(){
      var qEl = $("#mp-search"), cEl = $("#mp-city"), sEl = $("#mp-sort");
      var q = qEl ? qEl.value.toLowerCase().trim() : "";
      var city = cEl ? cEl.value : "";
      var sort = sEl ? sEl.value : "new";
      function match(x, extra){
        var hay = ((x.from_city||"")+" "+(x.to_city||")+" "+(extra||"")).toLowerCase();
        if (q && hay.indexOf(q) === -1) return false;
        if (city && x.from_city !== city) return false;
        return true;
      }
      function byPrice(a, b){
        var pa = Number(a.rate_per_km_ghs || a.budget_ghs || 0), pb = Number(b.rate_per_km_ghs || b.budget_ghs || 0);
        return sort === "price-desc" ? pb - pa : pa - pb;
      }
      if (truckList){
        var trucks = cachedTrucks.filter(function(t){ return match(t, (t.truck_type||"")+" "+(t.plate_no||"")); });
        if (sort !== "new") trucks = trucks.slice().sort(byPrice);
        truckList.innerHTML = trucks.length ? trucks.map(truckCard).join("")
          : '<div class="empty-state">No trucks match these filters.</div>';
      }
      if (loadList){
        var loads = cachedLoads.filter(function(l){ return match(l, l.description || ""); });
        if (sort !== "new") loads = loads.slice().sort(byPrice);
        loadList.innerHTML = loads.length ? loads.map(loadCard).join("")
          : '<div class="empty-state">No loads match these filters.</div>';
      }
    }
    async function render(){
      try {
        if (truckList) {
          truckList.innerHTML = '<div class="skeleton"><span class="sk-line sk-route"></span><span class="sk-line sk-meta"></span><span class="sk-line sk-badge"></span><span class="sk-line sk-price"></span><span class="sk-line sk-btn"></span></div>'.repeat(2);
          cachedTrucks = await API.listTrucks();
        }
        if (loadList) {
          loadList.innerHTML = '<div class="skeleton"><span class="sk-line sk-route"></span><span class="sk-line sk-meta"></span><span class="sk-line sk-badge"></span><span class="sk-line sk-price"></span><span class="sk-line sk-btn"></span></div>'.repeat(2);
          cachedLoads = await API.listLoads();
        }
        cachedTrucks = cachedTrucks || []; cachedLoads = cachedLoads || [];
        fillCities();
        renderLists();
      } catch (err) {
        showError(truckList, err); showError(loadList, err);
      }
    }
    ["mp-search","mp-city","mp-sort"].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.addEventListener(el.tagName === "SELECT" ? "change" : "input", renderLists);
    });
    (function(){
      var reset = document.getElementById("mp-reset");
      if (reset) reset.addEventListener("click", function(){
        ["mp-search","mp-city"].forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ""; });
        var s = document.getElementById("mp-sort"); if (s) s.value = "new";
        renderLists();
      });
    })();
    var matchBtn = $("#run-match"), banner = $("#match-banner");
    if (matchBtn) matchBtn.addEventListener("click", async function(){
      if (!banner) return;
      banner.className = "match-banner show"; banner.textContent = "Running matching engine…";
      try {
        var results = await API.runMatching();
        if (results && results.length) {
          var top = results[0];
          var t = cachedTrucks.filter(function(x){ return x.id === top.truckId; })[0];
          var l = cachedLoads.filter(function(x){ return x.id === top.loadId; })[0];
          banner.className = "match-banner show ok";
          banner.innerHTML = '<strong>Top match found — score '+esc(top.score)+'.</strong> '+
            (t ? esc(t.plate_no)+' ('+esc(t.from_city)+' → '+esc(t.to_city)+')' : 'Truck #'+esc(top.truckId)) +
            ' can carry ' +
            (l ? esc(l.description)+' ('+esc(l.from_city)+' → '+esc(l.to_city)+')' : 'load #'+esc(top.loadId)) +
            ' on the return leg. Estimated price '+fmt(top.estimatedPriceGhs)+'.';
        } else {
          banner.className = "match-banner show warn";
          banner.innerHTML = "<strong>No matches right now.</strong> Try adjusting dates, capacity, or budget — new trucks and loads join daily.";
        }
      } catch (err) {
        banner.className = "match-banner show warn";
        banner.textContent = "Couldn't reach the matching engine: " + (err.message || err);
      }
    });
    render();
  }

  /* ================= FORMS (post-truck / post-load) ================= */
  var form = $("#lm-form");
  if (form) {
    var isTruck = form.getAttribute("data-kind") === "truck";
    var loadedAt = Date.now();
    var hp = $(".hp-field input", form);
    var a = Math.floor(Math.random()*8)+2, b = Math.floor(Math.random()*8)+1;
    var capQ = $("#captcha-q"); if (capQ) capQ.textContent = "Spam check: what is " + a + " + " + b + "?";
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var phoneRe = /^[+0-9 ()-]{7,20}$/;

    function setErr(input, msg){
      var err = document.getElementById(input.id + "-error");
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (err) err.textContent = msg || "";
      return !msg;
    }
    function validate(){
      var ok = true;
      $$("input[required], select[required]", form).forEach(function(inp){
        var v = inp.value.trim(), msg = "";
        if (!v) msg = "This field is required.";
        else if (inp.type === "email" && !emailRe.test(v)) msg = "Enter a valid email address.";
        else if (inp.dataset.validate === "phone" && !phoneRe.test(v)) msg = "Enter a valid phone number.";
        else if (inp.type === "number" && !(Number(v) > 0)) msg = "Enter a number greater than 0.";
        else if (inp.dataset.validate === "date" && isNaN(Date.parse(v))) msg = "Enter a valid date.";
        if (!setErr(inp, msg)) ok = false;
      });
      var cap = $("#captcha-a");
      if (cap && Number(cap.value) !== a + b) { setErr(cap, "Incorrect answer."); ok = false; }
      else if (cap) setErr(cap, "");
      var pw = $("#pwd"), pw2 = $("#pwd2");
      if (pw && pw2) {
        if (pw.value.length < 8) { setErr(pw, "Minimum 8 characters."); ok = false; }
        else setErr(pw, "");
        if (pw2.value !== pw.value) { setErr(pw2, "Passwords do not match."); ok = false; }
        else setErr(pw2, "");
      }
      return ok;
    }

    form.addEventListener("submit", async function(e){
      e.preventDefault();
      if (hp && hp.value) return;
      if (Date.now() - loadedAt < 2500) { alert("Please take a moment to complete the form."); return; }
      if (!validate()) { var bad = $("[aria-invalid='true']", form); if (bad) bad.focus(); return; }

      var submitBtn = $("button[type='submit']", form);
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Submitting…"; }

      var fd = new FormData(form);
      var raw = {}; fd.forEach(function(v,k){ raw[k] = v; });

      try {
        if (!API.isLoggedIn()) {
          try {
            await API.register({
              role: isTruck ? "carrier" : "shipper",
              ownerName: raw.owner,
              company: isTruck ? undefined : raw.company,
              email: raw.email,
              phone: raw.phone,
              password: raw.password,
            });
          } catch (regErr) {
            /* Most likely an account with this email already exists — try logging in. */
            await API.login(raw.email, raw.password);
          }
        }

        if (isTruck) {
          await API.postTruck({
            plateNo: raw.plateNo,
            truckType: raw.truckType,
            fromCity: raw.from,
            toCity: raw.to,
            capacityKg: Number(raw.capacityKg),
            volumeM3: Number(raw.volumeM3),
            ratePerKmGhs: Number(raw.ratePerKm),
            availableFrom: raw.availableFrom,
            availableTo: raw.availableTo,
          });
        } else {
          await API.postLoad({
            description: raw.cargo,
            fromCity: raw.from,
            toCity: raw.to,
            weightKg: Number(raw.weightKg),
            volumeM3: Number(raw.volumeM3),
            budgetGhs: Number(raw.budgetGhs),
            pickupDate: raw.pickupDate,
            deliveryDate: raw.deliveryDate,
          });
        }

        form.reset();
        var box = $("#form-success");
        if (box) { box.classList.add("form-success"); box.removeAttribute("hidden");
          box.innerHTML = "<strong>Listing submitted.</strong> Our team will verify the details within 24 hours. <a href='marketplace.html'>View the marketplace →</a>"; box.focus(); }
      } catch (err) {
        alert("Couldn't submit: " + (err.message || err));
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = isTruck ? "Submit for verification" : "Post my load"; }
      }
    });
  }

  /* ================= DASHBOARD ================= */
  var dash = $("#dashboard");
  if (dash) {
    var container = $(".container", dash) || dash;

    if (!API.isLoggedIn()) renderLoginGate(); else initDashboard();

    function renderLoginGate(){
      var gate = document.createElement("div");
      gate.className = "card form-card";
      gate.style.maxWidth = "420px";
      gate.innerHTML =
        '<h2 style="margin-top:0">Log in to view the dashboard</h2>' +
        '<p class="route-meta">Demo logins (password <code>demo1234</code>):<br>' +
        'carrier — kwame@asantehaulage.example<br>shipper — ama@owusufurniture.example</p>' +
        '<label for="dash-email">Email</label><input id="dash-email" type="email" autocomplete="email">' +
        '<label for="dash-pwd">Password</label><input id="dash-pwd" type="password" autocomplete="current-password">' +
        '<button class="btn btn-primary" id="dash-login-btn" style="margin-top:1rem">Log in</button>' +
        '<p class="field-error" id="dash-login-error"></p>';
      $$(".kpi-row, .tabs, .panel", dash).forEach(function(el){ el.style.display = "none"; });
      container.insertBefore(gate, container.firstChild.nextSibling);

      $("#dash-login-btn", gate).addEventListener("click", async function(){
        var email = $("#dash-email", gate).value.trim();
        var pwd = $("#dash-pwd", gate).value;
        var err = $("#dash-login-error", gate);
        err.textContent = "";
        try {
          await API.login(email, pwd);
          gate.remove();
          $$(".kpi-row, .tabs, .panel", dash).forEach(function(el){ el.style.display = ""; });
          initDashboard();
        } catch (e) { err.textContent = e.message || "Login failed."; }
      });
    }

    function initDashboard(){
      var matches = [], truckCache = {}, loadCache = {}, selected = null;

      $$(".tab").forEach(function(tab){
        tab.addEventListener("click", function(){
          $$(".tab").forEach(function(t){ t.setAttribute("aria-selected","false"); });
          tab.setAttribute("aria-selected","true");
          $$(".panel").forEach(function(p){ p.classList.remove("active"); });
          $("#panel-" + tab.getAttribute("data-tab")).classList.add("active");
        });
      });

      function findMatch(id){ return matches.filter(function(m){ return String(m.id) === String(id); })[0] || null; }

      async function hydrate(m){
        if (!truckCache[m.truck_id]) { try { truckCache[m.truck_id] = await API.getTruck(m.truck_id); } catch(e){} }
        if (!loadCache[m.load_id])  { try { loadCache[m.load_id]  = await API.getLoad(m.load_id);  } catch(e){} }
      }

      var tbody = $("#matches-body");
      function renderMatches(){
        if (!tbody) return;
        if (!matches.length) {
          tbody.innerHTML = "<tr><td colspan='7'>No matches yet. Use the Marketplace's \"Run matching\" to find a pair.</td></tr>";
          return;
        }
        tbody.innerHTML = matches.map(function(m){
          var t = truckCache[m.truck_id], l = loadCache[m.load_id];
          return "<tr><td><strong>#"+esc(m.id)+"</strong></td>"+
            "<td>"+(t ? esc(t.plate_no)+"<br><small>"+esc(t.from_city)+" → "+esc(t.to_city)+"</small>" : "Truck #"+esc(m.truck_id))+"</td>"+
            "<td>"+(l ? esc(l.description)+"<br><small>"+esc(l.from_city)+" → "+esc(l.to_city)+"</small>" : "Load #"+esc(m.load_id))+"</td>"+
            "<td class='price-tag'>"+fmt(m.estimated_price_ghs)+"</td>"+
            "<td>"+esc(m.commission_pct)+"%</td>"+
            "<td><span class='badge "+(m.status==="delivered"||m.status==="paid"?"badge-verified":"badge-match")+"'>"+esc(m.status)+"</span></td>"+
            "<td><button class='btn btn-ghost btn-sm' data-select='"+esc(m.id)+"'>Manage</button></td></tr>";
        }).join("");
        $$("[data-select]", tbody).forEach(function(btn){
          btn.addEventListener("click", function(){ selected = btn.getAttribute("data-select"); renderAll(); });
        });
      }

      async function renderTracking(){
        var box = $("#tracking-body"); if (!box) return;
        var m = findMatch(selected);
        if (!m) { box.innerHTML = '<div class="empty-state">Select a match to track.</div>'; return; }
        try {
          var events = await API.getTracking(m.id);
          box.innerHTML = '<div class="card"><strong>GPS breadcrumbs</strong><ul class="timeline" style="margin-top:.6rem">' +
            (events && events.length ? events.map(function(ev){
              return "<li class='done'>"+esc(ev.note || "Checkpoint")+" — "+esc(ev.lat)+", "+esc(ev.lng)+" <small>"+esc(new Date(ev.created_at).toLocaleString())+"</small></li>";
            }).join("") : "<li>No tracking events yet.</li>") + "</ul>" +
            (m.status === "in_transit" ? '<button class="btn btn-ghost btn-sm" id="btn-in-transit" style="margin-top:1rem">Log a checkpoint</button>' : '') +
            "</div>";
        } catch (err) { showError(box, err); }
        var btn = $("#btn-in-transit");
        if (btn) btn.onclick = async function(){
          try { await API.postTrackingPoint(m.id, 5.6, -0.2, "Checkpoint logged"); renderAll(); }
          catch (err) { alert(err.message || err); }
        };
      }

      async function renderContract(){
        var box = $("#contract-body"); if (!box) return;
        var m = findMatch(selected);
        if (!m) { box.innerHTML = '<div class="empty-state">Select a match to view the contract.</div>'; return; }
        box.innerHTML = '<div class="card"><h3>Digital Contract — #'+esc(m.id)+'</h3>' +
          (m.status === "proposed" ? '<p class="route-meta">Accept this match before generating a contract.</p><button class="btn btn-primary" id="btn-accept">Accept match</button>' :
            '<button class="btn btn-ghost btn-sm" id="btn-gen-contract">Generate / view contract</button>' +
            '<pre id="contract-text" style="white-space:pre-wrap;margin-top:1rem;font-size:.9rem"></pre>' +
            '<label for="sig-name" style="margin-top:1rem">Type your full name to sign</label><input id="sig-name" type="text" autocomplete="name">' +
            '<button class="btn btn-primary" id="btn-sign" style="margin-top:1rem">Sign contract</button>') +
          "</div>";
        var acceptBtn = $("#btn-accept", box);
        if (acceptBtn) acceptBtn.addEventListener("click", async function(){
          try { await API.acceptMatch(m.id); await loadMatches(); await renderAll(); }
          catch (err) { alert(err.message || err); }
        });
        var genBtn = $("#btn-gen-contract", box);
        if (genBtn) genBtn.addEventListener("click", async function(){
          try { var c = await API.generateContract(m.id); $("#contract-text", box).textContent = c.terms_text; }
          catch (err) { alert(err.message || err); }
        });
        var signBtn = $("#btn-sign", box);
        if (signBtn) signBtn.addEventListener("click", async function(){
          var name = $("#sig-name", box).value.trim();
          if (name.length < 3) { alert("Please type your full name."); return; }
          try { await API.signContract(m.id, name); await loadMatches(); await renderAll(); }
          catch (err) { alert(err.message || err); }
        });
      }

      async function renderPayment(){
        var box = $("#payment-body"); if (!box) return;
        var m = findMatch(selected);
        if (!m) { box.innerHTML = '<div class="empty-state">Select a match to view payment.</div>'; return; }
        var detailsHtml = '<div class="empty-state">No payment yet — fund escrow once the contract is signed.</div>';
        try {
          var pay = await API.getPayment(m.id);
          detailsHtml = "<table><tr><th>Item</th><th>Amount</th></tr>" +
            "<tr><td>Shipper pays (escrow)</td><td class='price-tag'>"+fmt(pay.amount_ghs)+"</td></tr>" +
            "<tr><td>Commission</td><td>"+fmt(pay.commission_ghs)+"</td></tr>" +
            "<tr><td>Carrier payout</td><td><strong>"+fmt(pay.payout_ghs)+"</strong></td></tr></table>" +
            "<p style='margin-top:.6rem'>Status: <span class='badge "+(pay.status==="released"?"badge-verified":"badge-match")+"'>"+esc(pay.status)+"</span></p>";
        } catch (err) { /* no payment record yet — that's fine before funding */ }
        box.innerHTML = '<div class="card"><h3>Payment — #'+esc(m.id)+'</h3>' +
          (m.status === "contracted" ? '<button class="btn btn-primary" id="btn-pay">Shipper: fund escrow</button>' : '') +
          '<div style="margin-top:1rem">'+detailsHtml+'</div></div>';
        var payBtn = $("#btn-pay", box);
        if (payBtn) payBtn.addEventListener("click", async function(){
          try { await API.fundEscrow(m.id); await loadMatches(); await renderAll(); }
          catch (err) { alert(err.message || err); }
        });
      }

      async function renderPod(){
        var box = $("#pod-body"); if (!box) return;
        var m = findMatch(selected);
        if (!m) { box.innerHTML = '<div class="empty-state">Select a match to confirm delivery.</div>'; return; }
        if (m.status !== "in_transit" && m.status !== "delivered" && m.status !== "paid") {
          box.innerHTML = '<div class="empty-state">Fund escrow first — proof of delivery unlocks once the shipment is in transit.</div>';
          return;
        }
        box.innerHTML = '<div class="card"><h3>Proof of Delivery — #'+esc(m.id)+'</h3>' +
          (m.status === "delivered" || m.status === "paid"
            ? '<p><span class="badge badge-verified">Delivered</span> Escrow released.</p>'
            : '<button class="btn btn-ghost btn-sm" id="btn-req-otp">Request delivery code</button>' +
              '<label for="pod-otp" style="margin-top:1rem">Recipient enters the 6-digit delivery code</label>' +
              '<input id="pod-otp" inputmode="numeric" maxlength="6">' +
              '<button class="btn btn-primary" id="btn-pod" style="margin-top:1rem">Confirm delivery</button>') +
          "</div>";
        var reqBtn = $("#btn-req-otp", box);
        if (reqBtn) reqBtn.addEventListener("click", async function(){
          try { var r = await API.requestPodOtp(m.id); alert("Demo delivery code: " + r.devOnlyOtp); }
          catch (err) { alert(err.message || err); }
        });
        var podBtn = $("#btn-pod", box);
        if (podBtn) podBtn.addEventListener("click", async function(){
          var v = $("#pod-otp", box).value.trim();
          try { await API.verifyPodOtp(m.id, v); await loadMatches(); await renderAll(); }
          catch (err) { alert(err.message || err); }
        });
      }

      async function loadMatches(){
        try {
          matches = await API.listMyMatches();
          for (var i=0;i<matches.length;i++) await hydrate(matches[i]);
          if (matches.length && !selected) selected = matches[0].id;
          var openCount = matches.filter(function(m){ return m.status !== "delivered" && m.status !== "paid" && m.status !== "cancelled"; }).length;
          $("#kpi-matches").textContent = matches.length;
          var rev = matches.reduce(function(s,m){ return s + Math.round(m.estimated_price_ghs * (m.commission_pct/100)); }, 0);
          var revEl = $("#kpi-revenue"); if (revEl) revEl.textContent = fmt(rev);
        } catch (err) { showError(tbody, err); }
      }

      async function loadKpiCounts(){
        try {
          var trucks = await API.listTrucks();
          var loads = await API.listLoads({ status: "open" });
          var tEl = $("#kpi-trucks"); if (tEl) tEl.textContent = trucks.length;
          var lEl = $("#kpi-loads"); if (lEl) lEl.textContent = loads.length;
        } catch (err) { /* non-critical KPI, ignore */ }
      }

      async function renderAll(){
        renderMatches();
        await renderTracking();
        await renderContract();
        await renderPayment();
        await renderPod();
      }

      (async function(){
        await loadMatches();
        await loadKpiCounts();
        await renderAll();
      })();
    }
  }
})();
