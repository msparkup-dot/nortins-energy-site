/* Navegação compartilhada NORTINS ENERGY. */
(() => {
  const header = document.querySelector('[data-site-header]');
  if (!header) return;
  const toggle = header.querySelector('.menu-toggle');
  const menu = header.querySelector('#site-menu');
  if (!toggle || !menu) return;
  const desktop = matchMedia('(min-width: 1101px)');
  const setOpen = open => {
    header.classList.toggle('menu-aberto', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu de navegação' : 'Abrir menu de navegação');
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('click', event => { if (!header.contains(event.target)) setOpen(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
  });
  desktop.addEventListener('change', event => { if (event.matches) setOpen(false); });
  const updateHeader = () => {
    document.documentElement.style.setProperty('--header-height', Math.ceil(header.getBoundingClientRect().height)+'px');
    header.classList.toggle('rolou', scrollY > 40 || !document.querySelector('#inicio'));
  };
  if ('ResizeObserver' in window) new ResizeObserver(updateHeader).observe(header);
  window.addEventListener('scroll', updateHeader, {passive:true});
  window.addEventListener('resize', updateHeader);
  const markCurrent = () => menu.querySelectorAll('a').forEach(link => {
    if (link.hash && link.hash === location.hash && link.pathname === location.pathname) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  });
  window.addEventListener('hashchange', markCurrent);
  markCurrent(); updateHeader();
})();
