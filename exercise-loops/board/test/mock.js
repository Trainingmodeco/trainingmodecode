// Stand-in for the claude.ai runtime: an in-memory db (several collections) and an assets store, so the board's editing can be exercised offline.
(function () {
  var params = new URLSearchParams(location.search);
  if (params.get('runtime') === 'none') return;
  var cols = {}, listeners = {}, failNext = 0, failCode = 'unavailable';
  try { var saved = sessionStorage.getItem('mockdb2'); if (saved) cols = JSON.parse(saved); } catch (e) {}
  var clone = function (d) { return JSON.parse(JSON.stringify(d)); };
  var col = function (name) { return cols[name] || (cols[name] = {}); };
  var persist = function () { try { sessionStorage.setItem('mockdb2', JSON.stringify(cols)); } catch (e) {} };
  // Like the real store: documents come back ordered by id, each with data() returning a copy.
  var snap = function (name) { var c = col(name); return { docs: Object.keys(c).sort().map(function (id) { return { id: id, exists: true, data: function () { return clone(c[id]); } }; }) }; };
  var fire = function (name) { (listeners[name] || []).forEach(function (l) { if (!l.dead) l.next(snap(name)); }); };
  var split = function (path) { var i = path.indexOf('/'); return [path.slice(0, i), path.slice(i + 1)]; };
  window.__mock = {
    // store() is the "items" collection, as before; store('segs') is any other.
    store: function (name) { return col(name || 'items'); },
    failNext: function (n, code) { failNext = n; failCode = code || 'unavailable'; },
    // What Claude would do from its side: write a document and let the page hear about it.
    seed: function (name, id, data) { col(name)[id] = clone(data); persist(); setTimeout(function () { fire(name); }, 0); },
    remove: function (name, id) { delete col(name)[id]; persist(); setTimeout(function () { fire(name); }, 0); },
    // Ends every subscription with an error, as a withdrawn grant does.
    kill: function () { Object.keys(listeners).forEach(function (n) { listeners[n].forEach(function (l) { if (!l.dead) { l.dead = true; if (l.error) l.error({ code: 'revoked' }); } }); }); },
    writes: 0,
    assets: [],
    // delay: every write takes this many ms. throwNext: the next n db.doc() calls throw at once, as the real store does for a path it will not take.
    delay: 0,
    throwNext: 0,
  };
  var db = {
    doc: function (path) {
      if (window.__mock.throwNext > 0) { window.__mock.throwNext--; throw new TypeError('bad path segment: ' + path); }
      var p = split(path), name = p[0], id = p[1];
      var later = function () { var d = window.__mock.delay; return d ? new Promise(function (r) { setTimeout(r, d); }) : Promise.resolve(); };
      return {
        set: function (d) { return later().then(function () { return new Promise(function (res, rej) { if (failNext > 0) { failNext--; return rej({ code: failCode }); } window.__mock.writes++; col(name)[id] = clone(d); persist(); setTimeout(function () { fire(name); }, 0); res(); }); }); },
        delete: function () { return later().then(function () { return new Promise(function (res) { window.__mock.writes++; delete col(name)[id]; persist(); setTimeout(function () { fire(name); }, 0); res(); }); }); },
      };
    },
    collection: function (name) {
      var sub = { onSnapshot: function (next, error) { var l = { next: next, error: error, dead: false }; (listeners[name] = listeners[name] || []).push(l); setTimeout(function () { if (!l.dead) next(snap(name)); }, 0); return function () { l.dead = true; }; } };
      return { limit: function () { return sub; }, onSnapshot: sub.onSnapshot, doc: function (id) { return db.doc(name + '/' + id); } };
    },
  };
  var assets = {
    upload: function (file, opts) { return new Promise(function (res, rej) { if (file.size > 20 * 1024 * 1024) return rej({ code: 'too_large' }); var id = ''; for (var i = 0; i < 32; i++) id += 'abcdef0123456789'[Math.floor(Math.random() * 16)]; window.__mock.assets.push({ id: id, name: file.name, type: (opts && opts.type) || file.type }); setTimeout(function () { res({ id: id, url: '/_blob/' + id, sizeBytes: file.size, contentType: (opts && opts.type) || file.type }); }, 30); }); },
    delete: function (id) { window.__mock.assets = window.__mock.assets.filter(function (a) { return a.id !== id; }); return Promise.resolve({ deleted: true }); },
  };
  window.claude = { use: function (name) { return Promise.resolve(name === 'db' ? db : name === 'assets' && params.get('runtime') !== 'readonly' ? assets : null); } };
})();
