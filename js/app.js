/* ==========================================================
   КОКОФРЕШ — скролл, параллакс, темы, модальные окна
   ========================================================== */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mqMobile = matchMedia('(max-width: 860px)');
  const body = document.body;

  // вариант «блюдо по центру», как в референсах (вариант с блюдом сбоку — репозиторий cocofresh)
  const LAYOUT = 'center';
  if (LAYOUT === 'center') {
    body.classList.add('layout-center');
    // делим текст блока на две колонки вокруг блюда: слева заголовок, вводный абзац и фото,
    // справа детали (цифры, списки, цены, кнопки) — так обе колонки заполняют высоту экрана
    document.querySelectorAll('.scene-sec__content').forEach(c => {
      const kids = [...c.children];
      const split = kids.findIndex(k => k.tagName === 'P' && !k.matches('.eyebrow, .step-cap, .note'));
      const l = document.createElement('div'), r = document.createElement('div');
      l.className = 'col-l'; r.className = 'col-r';
      kids.forEach((k, i) => (i <= split || k.matches('.photos') ? l : r).appendChild(k));
      c.append(l, r);
      // если справа заметно меньше текста — переносим фото туда, чтобы колонки были поровну
      const ph = l.querySelector(':scope > .photos');
      const h = col => [...col.children].reduce((sum, k) => sum + k.offsetHeight, 0);
      if (ph && innerWidth > 860 && h(l) - h(r) > 250) r.appendChild(ph);
      if (l.querySelector('.photos')) l.classList.add('col-l--photos');
    });
  }
  let ready = false;

  // всегда начинаем с первого экрана — анимация идёт с начала
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ---------- плавный скролл ---------- */
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: .085, smoothWheel: true, wheelMultiplier: .95 });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const scrollToEl = el => lenis ? lenis.scrollTo(el, { duration: 1.8 }) : el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  const lock = on => { body.classList.toggle('is-locked', on); if (lenis) on ? lenis.stop() : lenis.start(); };

  /* ---------- сцена ---------- */
  const hasGsap = !!window.gsap;
  if (hasGsap) Scene.init();

  const stepsEl = $('#steps');
  if (hasGsap) {
    Scene.LABELS.forEach((l, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<b>0${i}</b><span>${l}</span>`;
      stepsEl.appendChild(li);
    });
    Scene.onStep = (n, phase) => {
      $$('li', stepsEl).forEach((li, i) => {
        li.classList.toggle('done', i < n || (i === n && phase === 'done'));
        li.classList.toggle('current', i === n);
      });
    };
  }

  /* ---------- позиции сцены по секциям ---------- */
  const POSES = {
    desktop: { hero: ['0vw', '6vh', 1], center: ['0vw', '3vh', .84], right: ['24vw', '2vh', .84], left: ['-24vw', '2vh', .84] },
    mobile:  { hero: ['0vw', '-8svh', .9], right: ['0vw', '-21svh', .9], left: ['0vw', '-21svh', .9] },
  };
  const pose = $('#stagePose');
  function setPose(name) {
    const mode = mqMobile.matches ? 'mobile' : 'desktop';
    const set = (LAYOUT === 'center' && mode === 'desktop' && (name === 'left' || name === 'right'))
      ? POSES.desktop.center
      : POSES[mode][name];
    if (!set) return; // «hide» — сцена просто перекрыта сплошной секцией
    pose.style.setProperty('--px', set[0]);
    pose.style.setProperty('--py', set[1]);
    pose.style.setProperty('--ps', set[2]);
  }

  const THEME_BG = { cream: '#F3ECDF', burgundy: '#4A0F1C', sand: '#E7D7BD', khaki: '#454D2B', wine: '#2B070F' };
  const sections = $$('main > section, footer');
  let active = null;
  function onActive(s) {
    body.dataset.theme = s.dataset.theme;
    body.classList.toggle('is-solid', s.dataset.pose === 'hide');
    body.classList.toggle('is-hero', s.id === 'hero');
    setPose(s.dataset.pose);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_BG[s.dataset.theme] || '#F3ECDF';
    if (ready && hasGsap && s.dataset.step != null) Scene.goTo(+s.dataset.step);
  }
  function updateActive() {
    const line = innerHeight * (mqMobile.matches ? .5 : .55);
    let cur = sections[0];
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) { cur = s; break; }
    }
    if (cur !== active) { active = cur; onActive(cur); }
  }

  /* ---------- параллакс ---------- */
  const par = $$('[data-speed]').map(el => ({ el, k: +el.dataset.speed, y: 0 }));
  const parX = $$('[data-speed-x]').map(el => ({ el, k: +el.dataset.speedX }));
  const stagePar = $('#stagePar');
  const hdr = $('#hdr');
  let lastY = -1;
  // параллакс сцены: цель считается по активному блоку и на границе блоков скачет,
  // поэтому сама сцена не прыгает к цели, а плавно догоняет её
  let parTarget = 0, parY = 0, lastT = 0;

  function frame(t = 0) {
    const y = window.scrollY;
    const dt = Math.min((t - lastT) / 1000 || 0, .1);
    lastT = t;
    if (y !== lastY) {
      const vh = innerHeight;
      updateActive();
      if (!reduce) {
        for (const p of par) {
          const r = p.el.getBoundingClientRect();
          const c = r.top + r.height / 2 - p.y;
          if (c < -vh || c > vh * 2) continue;
          p.y = (c - vh / 2) * -p.k;
          p.el.style.transform = `translate3d(0, ${p.y.toFixed(1)}px, 0)`;
        }
        for (const p of parX) {
          const r = p.el.parentElement.getBoundingClientRect();
          const prog = (r.top + r.height / 2 - vh / 2);
          p.el.style.transform = `translate3d(${(prog * p.k).toFixed(1)}px, 0, 0)`;
        }
        // лёгкий параллакс самой сцены внутри активного блока
        if (active && active.dataset.pose !== 'hide') {
          const r = active.getBoundingClientRect();
          const prog = (r.top + r.height / 2 - vh / 2) / r.height;
          parTarget = prog * (mqMobile.matches ? 30 : 60);
        }
      }
      hdr.classList.toggle('is-scrolled', y > 40);
      hdr.classList.toggle('is-hidden', y > lastY && y > innerHeight * .9 && !$('.mnav.is-open'));
      lastY = y;
    }
    if (!reduce && Math.abs(parTarget - parY) > .05) {
      parY += (parTarget - parY) * (1 - Math.exp(-dt * 3.2));
      stagePar.style.transform = `translate3d(0, ${parY.toFixed(2)}px, 0)`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  addEventListener('resize', () => { lastY = -1; if (active) setPose(active.dataset.pose); });
  // картинки подгружаются лениво и меняют высоту блоков — пересчитываем
  if (window.ResizeObserver) new ResizeObserver(() => { lastY = -1; }).observe(document.querySelector('main'));

  /* ---------- появление блоков ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('[data-reveal]').forEach((el, i) => {
    const sib = el.parentElement ? [...el.parentElement.children].filter(c => c.hasAttribute('data-reveal')) : [];
    el.style.transitionDelay = `${Math.min(sib.indexOf(el), 6) * 80}ms`;
    io.observe(el);
  });

  /* ---------- загрузка → первая анимация ---------- */
  function start() {
    if (ready) return;
    ready = true;
    $('#loader').classList.add('is-done');
    body.classList.add('is-ready');
    lastY = -1;
    if (hasGsap) Scene.goTo(0);
    if (active && active.dataset.step && hasGsap) Scene.goTo(+active.dataset.step);
  }
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([
    Promise.all([fontsReady, hasGsap ? Scene.imagesReady : null, new Promise(r => setTimeout(r, 900))]),
    new Promise(r => setTimeout(r, 4000)),
  ]).then(start);

  /* ---------- якоря ---------- */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id === '#top' ? $('#hero') : (id.length > 1 && $(id));
    if (!target) return;
    e.preventDefault();
    toggleNav(false);
    scrollToEl(target);
  });

  /* ---------- мобильное меню ---------- */
  const burger = $('#burger'), mnav = $('#mnav');
  function toggleNav(on) {
    if (!mnav) return;
    const open = on ?? !mnav.classList.contains('is-open');
    mnav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open);
    mnav.setAttribute('aria-hidden', !open);
    if (open) hdr.classList.remove('is-hidden');
    lock(open);
  }
  burger.addEventListener('click', () => toggleNav());

  /* ---------- модальные окна ---------- */
  let ageOk = false;
  try { ageOk = sessionStorage.getItem('kf-age') === '1'; } catch (_) {}
  let pendingTab = null;

  function openModal(id) {
    toggleNav(false);
    $$('.modal.is-open').forEach(m => m.classList.remove('is-open'));
    const m = $('#m-' + id);
    if (!m) return;
    m.classList.add('is-open');
    lock(true);
    const f = m.querySelector('input, button.is-active, button');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 350);
  }
  function closeModals() {
    $$('.modal.is-open, .lightbox.is-open').forEach(m => m.classList.remove('is-open'));
    lock(false);
  }
  document.addEventListener('click', e => {
    const o = e.target.closest('[data-open]');
    if (o) {
      e.preventDefault();
      const id = o.dataset.open;
      if (id === 'menu') {
        const tab = o.dataset.tab || 'kitchen';
        if (tab !== 'kitchen' && !ageOk) { pendingTab = tab; openModal('age'); return; }
        renderMenu(tab);
      }
      if (id === 'booking' && o.dataset.preset) {
        const sel = $('#f-booking select[name="kind"]');
        [...sel.options].forEach(op => { if (op.text === o.dataset.preset) sel.value = op.value; });
      }
      openModal(id);
      return;
    }
    if (e.target.closest('[data-close]') || e.target.classList.contains('modal') || e.target.classList.contains('lightbox') || e.target.closest('.lightbox img')) closeModals();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') { closeModals(); toggleNav(false); } });

  // возраст
  $('#age-yes').addEventListener('click', () => {
    ageOk = true;
    try { sessionStorage.setItem('kf-age', '1'); } catch (_) {}
    renderMenu(pendingTab || 'wine');
    openModal('menu');
  });
  $('#age-no').addEventListener('click', () => { $('.age-deny').hidden = false; });

  /* ---------- меню ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function renderMenu(tab) {
    if (tab !== 'kitchen' && !ageOk) { pendingTab = tab; openModal('age'); return; }
    $$('#m-menu .tabs button').forEach(b => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on);
    });
    const data = (window.MENU || {})[tab] || [];
    $('#menuBody').innerHTML = data.map(cat => `
      <div class="mcat"><h4>${esc(cat.title)}</h4><ul>
        ${cat.items.map(([n, d, v, p, sig]) => `
          <li>
            <span class="nm">${sig ? '<svg class="hen" aria-label="фермерское"><use href="#i-hen"/></svg>' : ''}${esc(n)}<i></i></span>
            <span class="pr">${v ? `<small>${esc(v)}</small>` : ''}${esc(p)}${/^\+/.test(p) ? '' : ' ₽'}</span>
            ${d ? `<span class="ds">${esc(d)}</span>` : ''}
          </li>`).join('')}
      </ul></div>`).join('');
    $('#m-menu .modal__panel').scrollTop = 0;
  }
  $$('#m-menu .tabs button').forEach(b => b.addEventListener('click', () => renderMenu(b.dataset.tab)));

  /* ---------- формы → WhatsApp / почта ---------- */
  const PHONE = '79099495555';
  const fmtDate = v => v ? v.split('-').reverse().join('.') : '';
  function bookingText(f) {
    const d = Object.fromEntries(new FormData(f));
    return [
      'Здравствуйте! Хочу забронировать столик в КОКОФРЕШ.',
      `Имя: ${d.name}`, `Телефон: ${d.phone}`,
      `Дата и время: ${fmtDate(d.date)} ${d.time}`,
      `Гостей: ${d.guests}`, `Повод: ${d.kind}`,
      d.comment ? `Комментарий: ${d.comment}` : '',
    ].filter(Boolean).join('\n');
  }
  function eventText(f) {
    const d = Object.fromEntries(new FormData(f));
    return [
      'Здравствуйте! Запрос на мероприятие в КОКОФРЕШ.',
      `Имя: ${d.name}`, `Телефон: ${d.phone}`,
      `Формат: ${d.kind}`, d.date ? `Дата: ${fmtDate(d.date)}` : '',
      `Гостей: ${d.guests}`, `Номер в отеле: ${d.room}`,
      d.comment ? `Комментарий: ${d.comment}` : '',
    ].filter(Boolean).join('\n');
  }
  const wa = text => window.open(`https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');

  const fb = $('#f-booking');
  const today = new Date().toISOString().slice(0, 10);
  $$('input[type="date"]').forEach(i => i.min = today);
  fb.addEventListener('submit', e => { e.preventDefault(); wa(bookingText(fb)); });
  const fe = $('#f-event');
  fe.addEventListener('submit', e => { e.preventDefault(); wa(eventText(fe)); });
  $('#ev-mail').addEventListener('click', () => {
    if (!fe.reportValidity()) return;
    location.href = `mailto:ok@cocofresh.ru?subject=${encodeURIComponent('Запрос на мероприятие')}&body=${encodeURIComponent(eventText(fe))}`;
  });

  /* ---------- галерея ---------- */
  const lb = $('#lightbox');
  $$('.gal__item').forEach(b => b.addEventListener('click', () => {
    const img = lb.querySelector('img');
    img.src = b.dataset.full;
    img.alt = b.querySelector('img').alt;
    lb.classList.add('is-open');
    lock(true);
  }));
})();
