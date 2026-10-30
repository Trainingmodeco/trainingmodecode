/* Home (Simplify concept): mode tabs, discipline strip, testimonial carousel, email capture.
   Every block is guarded — a missing element never throws. Replaces landing.js. */
(function () {
  document.documentElement.classList.add('js'); // no-JS fallback stacks every .tm-panel

  /* swipe helper — horizontal flicks on touch devices */
  function addSwipe(el, onLeft, onRight) {
    if (!el) return;
    var x0 = null, y0 = null;
    el.addEventListener('touchstart', function (e) {
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      var dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? onLeft : onRight)();
      x0 = null;
    }, { passive: true });
  }

  /* ---------- Stage 02: FIT / FIGHT / ARCADE tab switcher ---------- */
  var tablists = Array.prototype.slice.call(document.querySelectorAll('.tm-tabs[role="tablist"]'));
  tablists.forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;

    function panelsOf(tab) {
      var ids = (tab.getAttribute('aria-controls') || '').split(/\s+/).filter(Boolean);
      return ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    }
    var allPanels = [];
    tabs.forEach(function (t) { allPanels = allPanels.concat(panelsOf(t)); });

    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      var show = panelsOf(tab);
      allPanels.forEach(function (p) { p.hidden = show.indexOf(p) === -1; });
      if (focus) tab.focus();
      tab.dispatchEvent(new CustomEvent('tm:tabchange', { bubbles: true }));   // click or arrow keys
    }

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') n = tabs[0];
        else if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });

    var initial = tabs.filter(function (t) { return t.classList.contains('is-on'); })[0] || tabs[0];
    select(initial, false);
  });

  /* ---------- discipline strip (colour only) ---------- */
  Array.prototype.slice.call(document.querySelectorAll('.tm-disc[role="tablist"]')).forEach(function (strip) {
    var tabs = Array.prototype.slice.call(strip.querySelectorAll('.tm-disc__tab'));
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (o) {
          var on = o === t;
          o.classList.toggle('is-on', on);
          o.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        var key = (t.className.match(/\bis-([a-z]+)\b/g) || []).map(function (c) { return c.slice(3); })
          .filter(function (c) { return c !== 'on'; })[0];
        if (key) strip.setAttribute('data-on', key);
      });
    });
  });

  /* ---------- Stage 05: testimonial carousel (no autoplay) ---------- */
  var T = [
    { quote: 'Gaming aesthetic and layout is pretty cool. Love the gaming objective / mission tracking. Reminds me of my favorite parts of Ring Fit Adventure. I like the amount of "video coming soon" I see.', name: 'JAMIE VALLES', role: 'Gaming & Fitness Fan', initial: 'J', stars: 5 },
    { quote: 'Great potential. I can see this app becoming a staple in the fitness app community.', name: 'SOLUS 555', role: 'Fighter / Martial Artist', initial: 'S', stars: 5 },
    { quote: 'For gamers and anime lovers this app is perfect. We already enjoy anime and gaming — so why not add to that and actually get a workout with the same style of visuals? I would recommend it to all my gaming and anime friends.', name: 'Anonymous Tester', role: 'Gaming & Anime Fan', initial: 'A', stars: 4 },
    { quote: 'I liked how fast I could jump into a session. No overthinking, just pick a mode and start training.', name: 'CHRIS', role: 'Busy Professional', initial: 'C', stars: 5 },
    { quote: 'The video game style makes the app feel more fun than a regular workout tracker. It actually makes me want to come back.', name: 'ELIJAH', role: 'Anime / Fitness Fan', initial: 'E', stars: 5 },
    { quote: 'The layout makes training feel less intimidating. I can see myself using this for quick workouts after work.', name: 'DEVON', role: 'Beginner Fitness User', initial: 'D', stars: 5 },
    { quote: 'Fight Mode keeps my shadowboxing structured. It feels like having a coach call out the combos while I train solo.', name: 'MAYA', role: 'Combat Sports Fan', initial: 'M', stars: 5 },
    { quote: 'I started my fitness journey a little over a year ago. I found the Training Mode app, and it transformed my workout routine. It tracks my progress and suggests new routines. The app is designed to push your limits. Unlock your Fit Mode.', name: 'D.C.', role: 'Costume & Wardrobe Stylist', initial: 'D', stars: 5 },
  ];
  var tTrack = document.getElementById('testTrack');
  var tDotsBox = document.getElementById('testDots');
  var tPrev = document.getElementById('testPrev');
  var tNext = document.getElementById('testNext');
  if (tTrack && tDotsBox) {
    var PER = 3;
    var esc = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
    function cardHTML(t) {
      return '<div class="tcard">' +
        '<span class="corner corner--tl"></span><span class="corner corner--tr"></span><span class="corner corner--bl"></span><span class="corner corner--br"></span>' +
        '<div class="tcard__stars"><b>' + '★'.repeat(t.stars) + '</b><i>' + '★'.repeat(5 - t.stars) + '</i></div>' +
        '<p class="tcard__quote">“' + esc(t.quote) + '”</p>' +
        '<div class="tcard__who"><div class="tcard__avatar">' + esc(t.initial) + '</div>' +
        '<div class="tcard__meta"><div class="tcard__name">' + esc(t.name) + '</div><div class="tcard__role">' + esc(t.role) + '</div></div></div></div>';
    }
    var pages = '';
    for (var i = 0; i < T.length; i++) {
      var inner = '';
      for (var j = 0; j < PER; j++) inner += cardHTML(T[(i + j) % T.length]);
      pages += '<div class="test__page">' + inner + '</div>';
    }
    tTrack.innerHTML = pages;

    var ti = 0;
    T.forEach(function (_, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'dot';
      d.setAttribute('aria-label', 'Go to testimonials page ' + (i + 1));
      d.addEventListener('click', function () { goTest(i); });
      tDotsBox.appendChild(d);
    });
    var tDots = Array.prototype.slice.call(tDotsBox.children);

    function renderTest() {
      tTrack.style.transform = 'translateX(-' + (ti * 100) + '%)';
      tDots.forEach(function (d, i) {
        d.classList.toggle('is-on', i === ti);
        if (i === ti) { d.setAttribute('aria-current', 'true'); } else { d.removeAttribute('aria-current'); }
      });
    }
    function goTest(i) {
      ti = ((i % T.length) + T.length) % T.length;
      renderTest();
    }
    if (tPrev) tPrev.addEventListener('click', function () { goTest(ti - 1); });
    if (tNext) tNext.addEventListener('click', function () { goTest(ti + 1); });
    addSwipe(document.querySelector('.test__viewport'), function () { goTest(ti + 1); }, function () { goTest(ti - 1); });
    renderTest();
  }

  /* ---------- Stage 06: email capture (Netlify Form "launch-updates") ---------- */
  var form = document.getElementById('emailForm');
  var card = document.getElementById('emailCard');
  var emailErr = document.getElementById('emailErr');
  if (form && card) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var input = form.querySelector('input[type="email"]');
      var email = input ? input.value : '';
      if (btn) { btn.disabled = true; btn.textContent = 'SENDING…'; }
      if (emailErr) emailErr.hidden = true;
      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ 'form-name': 'launch-updates', 'email': email }).toString(),
      }).then(function (r) {
        if (!r.ok) throw new Error('status ' + r.status);
        card.classList.add('is-done');
      }).catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'NOTIFY ME ›'; }
        if (emailErr) emailErr.hidden = false;
      });
    });
  }
})();

/* ---------- Stage 02: "I want to…" goal row + mode cards ----------
   A goal button picks its tab. Each tab opens on its "what you get" card; tapping a hub row swaps in that
   feature's preview (copy + app screen). "‹ Overview" or any tab brings the card back. */
(function () {
  var hc = document.querySelector('.hub-cards'), pv = document.getElementById('mcPreview');
  if (!hc || !pv) return;
  var D = {"QUICK MISSION":["fit","FIT · 01","A workout built for today.","One tap builds a coached session. Or pick a classic like Murph.",["10–30 MIN","NO GEAR"],"quick-mission","/features#fit"],"BUILD WORKOUT":["fit","FIT · 02","Pick the muscles. We build it.","Tap the body map, set time and gear, swap any move.",["BODY MAP","SAVED ROUTINES"],"build","/features#fit"],"PROGRAMS":["fit","FIT · 03","Follow a plan, day by day.","20 plans, from full body to push/pull/legs.",["BODYWEIGHT","WEIGHTS","HYBRID"],"programs","/features#fit"],"CARDIO":["fit","FIT · 04","Run, ride, row.","GPS runs map your route and race your best. Machines get guided intervals.",["GPS ROUTE","GHOST RUNS"],"cardio","/features#fit"],"JUST TRAIN":["fight","FIGHT · 01","Your rounds, your rules.","A clean fight timer. Save presets, start in one tap.",["BAG","PADS","SPARRING"],"just-train","/features#fight"],"FIGHT FOCUS":["fight","FIGHT · 02","Every round has a job.","A coach-called focus each round, then race your best.",["112 ROUND FOCUSES"],"ghost-race","/features#fight"],"COMBO COACH":["fight","FIGHT · 03","Hear the combo. Throw the combo.","Strikes called out loud at your pace. Save your own combos.",["4 DISCIPLINES"],"combo-live","/features#fight"],"TRAINING CAMP":["fight","FIGHT · 04","Train like you have a fight booked.","12 levels, from Foundation to a Title Fight.",["EASY · NORMAL · HARD"],"training-camp","/features#camp"],"PRACTICE":["fight","SKILLS","Learn it right, then drill it.","Step-by-step lessons and a 77-technique library.",["EVERY DISCIPLINE"],"practice","/features#fight"],"CONDITIONING":["fight","SKILLS","Build a fighter’s gas tank.","Ring-ready circuits on a fight clock.",["4 PRESETS","ADD CARDIO"],"cond-live","/features#combat"]};
  var NAMES = { fit: 'FIT MODE', fight: 'FIGHT MODE' };
  var $ = function (id) { return document.getElementById(id); };
  function clearPick() { document.querySelectorAll('#paths .is-picked').forEach(function (e) { e.classList.remove('is-picked'); }); }
  function overview() { hc.classList.remove('is-previewing'); pv.hidden = true; clearPick(); }
  function keyOf(el) { var t = el.querySelector('.tm-band__title, .tm-tile__title'); return t ? t.textContent.trim() : null; }
  function show(el) {
    var d = D[keyOf(el)]; if (!d) return;
    pv.className = 'mcard mcard--preview mcard--' + d[0];
    $('mcBackTo').textContent = NAMES[d[0]];
    $('mcEye').textContent = d[1]; $('mcTitle').textContent = d[2]; $('mcP').textContent = d[3];
    $('mcChips').innerHTML = d[4].map(function (c) { return '<span class="tm-chip">' + c + '</span>'; }).join('');
    var im = $('mcImg');
    im.srcset = '/assets/app/' + d[5] + '-2026-10-480.webp 480w, /assets/app/' + d[5] + '-2026-10.webp 960w';
    im.src = '/assets/app/' + d[5] + '-2026-10.webp'; im.alt = keyOf(el) + ' in the Training Mode app';
    $('mcMore').setAttribute('href', d[6]);
    hc.classList.add('is-previewing'); pv.hidden = false;
    clearPick(); el.classList.add('is-picked');
    var r = pv.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.7) pv.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.querySelectorAll('#hubFit .tm-band, #hubFight .tm-band, #hubFight .tm-tile').forEach(function (el) {
    el.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); show(el); });
  });
  $('mcBack').addEventListener('click', overview);
  var goals = Array.prototype.slice.call(document.querySelectorAll('.hub-goal'));
  function mark(id) { goals.forEach(function (g) { g.classList.toggle('is-on', g.getAttribute('data-tab') === id); }); }
  ['tabFit', 'tabFight', 'tabArcade'].forEach(function (id) { var t = $(id); if (t) t.addEventListener('tm:tabchange', function () { overview(); mark(id); }); });
  goals.forEach(function (g) { g.addEventListener('click', function () { var t = $(g.getAttribute('data-tab')); if (t) t.click(); }); });
})();

/* ---------- Stage 03: saga carousel (the app's arcade carousel, auto-rotating) ----------
   Loops through the 13 sagas, pausing DWELL ms on each. Stops while hovered or focused, off-screen,
   in a hidden tab, after the pause button, or under reduced motion. The centre live saga opens the
   install sheet (install-modal.js); a locked one shakes and says why; any other card slides to centre. */
(function () {
  var car = document.getElementById('sagaCar'); if (!car) return;
  var slides = Array.prototype.slice.call(car.querySelectorAll('.saga'));
  var dots = Array.prototype.slice.call(car.querySelectorAll('.saga-car__dot'));
  var view = car.querySelector('.saga-car__view'), track = car.querySelector('.saga-car__track');
  var pauseBtn = car.querySelector('.saga-car__pause'), toast = car.querySelector('.saga-car__toast');
  var n = slides.length, active = 0, timer = 0, toastTimer = 0, DWELL = 3400;
  var reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var canHover = !!(window.matchMedia && matchMedia('(hover: hover)').matches);
  var userPaused = reduced, hovering = false, focused = false, onScreen = true;

  function wrap(i) { return ((i % n) + n) % n; }
  function offset(i) { var d = wrap(i - active); return d > n / 2 ? d - n : d; }
  function render() {
    slides.forEach(function (s, i) {
      var o = offset(i), card = s.querySelector('.saga__card'), img = s.querySelector('img');
      s.style.setProperty('--o', o);
      s.classList.toggle('is-on', o === 0);
      s.classList.toggle('is-far', Math.abs(o) > 2);
      if (o === 0) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      card.tabIndex = o === 0 ? 0 : -1;
      if (img && Math.abs(o) <= 3 && img.loading === 'lazy') img.loading = 'eager';   // warm the next cards before they slide in
    });
    dots.forEach(function (d, i) { d.classList.toggle('is-on', i === active); if (i === active) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
  }
  function running() { return !userPaused && !hovering && !focused && onScreen && !document.hidden; }
  function schedule() {
    clearTimeout(timer);
    track.setAttribute('aria-live', running() ? 'off' : 'polite');
    if (running()) timer = setTimeout(function () { go(active + 1); }, DWELL);
  }
  function go(i) { active = wrap(i); render(); schedule(); }
  function say(text) {
    toast.textContent = text; toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.hidden = true; }, 1800);
  }

  car.querySelector('.saga-car__arrow--prev').addEventListener('click', function () { go(active - 1); });
  car.querySelector('.saga-car__arrow--next').addEventListener('click', function () { go(active + 1); });
  dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });
  pauseBtn.addEventListener('click', function () {
    userPaused = !userPaused;
    pauseBtn.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
    pauseBtn.setAttribute('aria-label', userPaused ? 'Play the carousel' : 'Pause the carousel');
    schedule();
  });
  if (userPaused) { pauseBtn.setAttribute('aria-pressed', 'true'); pauseBtn.setAttribute('aria-label', 'Play the carousel'); }

  // swipe (touch or mouse drag); the click that ends a swipe is swallowed
  var x0 = null, y0 = 0, swiped = false;
  view.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; swiped = false; });
  view.addEventListener('pointerup', function (e) {
    if (x0 === null) return;
    var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { swiped = true; go(active + (dx < 0 ? 1 : -1)); }
  });
  view.addEventListener('pointercancel', function () { x0 = null; });
  view.addEventListener('dragstart', function (e) { e.preventDefault(); });

  slides.forEach(function (s, i) {
    s.querySelector('.saga__card').addEventListener('click', function (e) {
      var o = offset(i);
      if (swiped || o !== 0) { e.preventDefault(); e.stopPropagation(); if (!swiped) go(i); swiped = false; return; }
      if (s.classList.contains('saga--locked')) {
        e.preventDefault(); e.stopPropagation();
        s.classList.remove('is-shake'); void s.offsetWidth; s.classList.add('is-shake');
        say(this.getAttribute('data-note'));
      }
      // a centred live saga: data-install opens the install sheet
    });
  });

  car.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
  });
  if (canHover) {
    car.addEventListener('mouseenter', function () { hovering = true; schedule(); });
    car.addEventListener('mouseleave', function () { hovering = false; schedule(); });
  }
  car.addEventListener('focusin', function () { focused = true; schedule(); });
  car.addEventListener('focusout', function (e) { if (!car.contains(e.relatedTarget)) { focused = false; schedule(); } });
  document.addEventListener('visibilitychange', schedule);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { onScreen = entries[0].isIntersecting; schedule(); }, { threshold: 0.35 }).observe(view);
  }
  render(); schedule();
})();
