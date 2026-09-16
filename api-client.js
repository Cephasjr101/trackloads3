/**
 * LoadMatch API client — talks to the real Node backend.
 * Include this BEFORE any other page script that uses window.LoadMatchAPI
 * (data.js, pages.js, chatbot.js all depend on it).
 */
(function (global) {
  'use strict';

  var API_BASE = window.LOADMATCH_API_BASE || 'https://trackloadadmin.onrender.com';

  var TOKEN_KEY = 'lm_token';
  var USER_KEY = 'lm_user';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }
  function setUser(user) {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }
  function getUser() {
    try { var v = localStorage.getItem(USER_KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }

  async function request(method, path, opts) {
    opts = opts || {};
    var url = API_BASE + path;
    if (opts.query) {
      var qs = new URLSearchParams(
        Object.fromEntries(Object.entries(opts.query).filter(function (kv) {
          return kv[1] !== undefined && kv[1] !== null && kv[1] !== '';
        }))
      ).toString();
      if (qs) url += '?' + qs;
    }

    var headers = { 'Content-Type': 'application/json' };
    var auth = opts.auth !== false;
    if (auth && getToken()) headers.Authorization = 'Bearer ' + getToken();

    var res = await fetch(url, {
      method: method,
      headers: headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    var data;
    try { data = await res.json(); } catch (e) { data = {}; }

    if (!res.ok) {
      var err = new Error(data.error || ('Request failed (' + res.status + ')'));
      err.status = res.status;
      err.details = data.details;
      throw err;
    }
    return data;
  }

  var LoadMatchAPI = {
    baseUrl: API_BASE,

    // ---- auth ----
    async register(fields) {
      var data = await request('POST', '/api/auth/register', {
        body: {
          role: fields.role,
          ownerName: fields.ownerName,
          company: fields.company,
          email: fields.email,
          phone: fields.phone,
          password: fields.password,
        },
        auth: false,
      });
      setToken(data.token); setUser(data.user);
      return data.user;
    },
    async login(email, password) {
      var data = await request('POST', '/api/auth/login', { body: { email: email, password: password }, auth: false });
      setToken(data.token); setUser(data.user);
      return data.user;
    },
    logout() { setToken(null); setUser(null); },
    isLoggedIn() { return !!getToken(); },
    currentUser() { return getUser(); },
    async me() {
      var data = await request('GET', '/api/me');
      setUser(data.user);
      return data.user;
    },

    // ---- trucks ----
    postTruck(truck) {
      return request('POST', '/api/trucks', {
        body: {
          plateNo: truck.plateNo,
          truckType: truck.truckType,
          fromCity: truck.fromCity,
          toCity: truck.toCity,
          capacityKg: truck.capacityKg,
          volumeM3: truck.volumeM3,
          ratePerKmGhs: truck.ratePerKmGhs,
          availableFrom: truck.availableFrom,
          availableTo: truck.availableTo,
        },
      }).then(function (d) { return d.truck; });
    },
    listTrucks(filter) {
      return request('GET', '/api/trucks', { query: filter || {}, auth: false }).then(function (d) { return d.trucks; });
    },
    getTruck(id) {
      return request('GET', '/api/trucks/' + id, { auth: false }).then(function (d) { return d.truck; });
    },
    verifyTruck(id, decision) {
      return request('POST', '/api/trucks/' + id + '/verify', { body: { decision: decision } }).then(function (d) { return d.truck; });
    },

    // ---- loads ----
    postLoad(load) {
      return request('POST', '/api/loads', {
        body: {
          description: load.description,
          fromCity: load.fromCity,
          toCity: load.toCity,
          weightKg: load.weightKg,
          volumeM3: load.volumeM3,
          budgetGhs: load.budgetGhs,
          pickupDate: load.pickupDate,
          deliveryDate: load.deliveryDate,
        },
      }).then(function (d) { return d.load; });
    },
    listLoads(filter) {
      return request('GET', '/api/loads', { query: filter || {}, auth: false }).then(function (d) { return d.loads; });
    },
    getLoad(id) {
      return request('GET', '/api/loads/' + id, { auth: false }).then(function (d) { return d.load; });
    },

    // ---- pricing ----
    estimatePrice(params) {
      return request('GET', '/api/pricing/estimate', { query: params, auth: false });
    },

    // ---- matching ----
    // NOTE: candidates are { truckId, loadId, score, distanceKm, estimatedPriceGhs, reason, truckVerified }
    // — no nested truck/load objects. Look those up separately if you need details.
    runMatching() {
      return request('GET', '/api/matches/run', { auth: false }).then(function (d) { return d.candidates; });
    },
    proposeMatch(truckId, loadId) {
      return request('POST', '/api/matches', { body: { truckId: truckId, loadId: loadId } }).then(function (d) { return d.match; });
    },
    listMyMatches() {
      return request('GET', '/api/matches').then(function (d) { return d.matches; });
    },
    getMatch(id) {
      return request('GET', '/api/matches/' + id); // { match, truck, load }
    },
    acceptMatch(id) {
      return request('POST', '/api/matches/' + id + '/accept').then(function (d) { return d.match; });
    },
    setCommission(id, commissionPct) {
      return request('PATCH', '/api/matches/' + id + '/commission', { body: { commissionPct: commissionPct } }).then(function (d) { return d.match; });
    },

    // ---- contract ----
    generateContract(matchId) {
      return request('POST', '/api/matches/' + matchId + '/contract').then(function (d) { return d.contract; });
    },
    signContract(matchId, signatureName) {
      return request('POST', '/api/matches/' + matchId + '/contract/sign', { body: { signatureName: signatureName } });
    },

    // ---- escrow / payment ----
    fundEscrow(matchId) {
      return request('POST', '/api/matches/' + matchId + '/escrow/fund');
    },
    getPayment(matchId) {
      return request('GET', '/api/matches/' + matchId + '/payment').then(function (d) { return d.payment; });
    },

    // ---- GPS tracking ----
    postTrackingPoint(matchId, lat, lng, note) {
      return request('POST', '/api/matches/' + matchId + '/tracking', { body: { lat: lat, lng: lng, note: note } });
    },
    getTracking(matchId) {
      return request('GET', '/api/matches/' + matchId + '/tracking').then(function (d) { return d.events; });
    },

    // ---- proof of delivery ----
    requestPodOtp(matchId) {
      return request('POST', '/api/matches/' + matchId + '/pod/request-otp');
    },
    verifyPodOtp(matchId, otp) {
      return request('POST', '/api/matches/' + matchId + '/pod/verify', { body: { otp: otp } });
    },

    // ---- health ----
    health() {
      return request('GET', '/api/health', { auth: false });
    },
  };

  global.LoadMatchAPI = LoadMatchAPI;
})(window);
