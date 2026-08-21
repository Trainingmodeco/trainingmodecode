// ============ mobile menu ============
const menuToggle = document.querySelector('[data-menu-toggle]');
const mobileNav = document.querySelector('[data-mobile-nav]');
if (menuToggle && mobileNav) {
  menuToggle.addEventListener('click', () => mobileNav.classList.toggle('open'));
  mobileNav.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => mobileNav.classList.remove('open'))
  );
}

// ============ phone carousel ============
const carousel = document.querySelector('[data-carousel]');
if (carousel) {
  const slots = Array.from(carousel.querySelectorAll('.phone-slot'));
  const dotsWrap = carousel.querySelector('[data-carousel-dots]');
  const POS = ['pos-n2', 'pos-n1', 'pos-0', 'pos-1', 'pos-2'];
  let offset = 0;
  let timer = null;

  const dots = slots.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Show screenshot ' + (i + 1));
    b.addEventListener('click', () => {
      offset = (i - 2 + slots.length) % slots.length;
      render();
      restart();
    });
    dotsWrap.appendChild(b);
    return b;
  });

  function render() {
    slots.forEach((slot, i) => {
      slot.classList.remove(...POS);
      slot.classList.add(POS[(i - offset + slots.length) % slots.length]);
    });
    const centerIndex = (offset + 2) % slots.length;
    dots.forEach((d, i) => d.classList.toggle('active', i === centerIndex));
  }

  function restart() {
    if (timer) clearInterval(timer);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      timer = setInterval(() => {
        offset = (offset + 1) % slots.length;
        render();
      }, 3500);
    }
  }

  render();
  restart();
}

// ============ arcade stage selector ============
const stageCopy = {
  strength: 'Push strength with a focused lift plan, then log the session to your build.',
  technique: 'Sharpen combos, footwork, and clean reps with skill-focused rounds.',
  conditioning: 'Build stamina with sweat-heavy circuits and engine work.',
  boss: 'The hybrid test — strength, skill, and conditioning in one final round.',
};
const stageButtons = document.querySelectorAll('[data-stage]');
const stageOutput = document.querySelector('[data-stage-output]');
stageButtons.forEach((btn) =>
  btn.addEventListener('click', () => {
    stageButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    if (stageOutput) stageOutput.textContent = stageCopy[btn.dataset.stage] || '';
  })
);

// ============ contact form (mailto handoff) ============
const form = document.querySelector('[data-contact-form]');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const subject = encodeURIComponent('Training Mode — message from ' + (data.get('name') || 'the website'));
    const body = encodeURIComponent((data.get('message') || '') + '\n\nReply to: ' + (data.get('email') || ''));
    window.location.href = 'mailto:trainingmode.co@gmail.com?subject=' + subject + '&body=' + body;
    const status = form.querySelector('[data-form-status]');
    if (status) status.textContent = 'Opening your email app…';
  });
}

// ============ scroll reveal ============
const revealObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObs.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll('.reveal').forEach((el) => revealObs.observe(el));

// ============ active nav highlight ============
const sections = document.querySelectorAll('main section[id]');
const navLinks = document.querySelectorAll('.desktop-nav a');
const navObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        navLinks.forEach((a) =>
          a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id)
        );
      }
    });
  },
  { rootMargin: '-40% 0px -55% 0px' }
);
sections.forEach((s) => navObs.observe(s));
