/* NORTINS ENERGY — preferências de cookies, sem rastreadores por padrão. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NortinsPrivacy = api.mount(root);
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const categories = ['analytics', 'marketing'];
  function createStore(options) {
    const key = 'nortins_cookie_prefs';
    const version = options.version || 2;
    const inventory = options.inventory || [];
    const fingerprint = JSON.stringify(inventory.map(s => [s.id,s.category,s.purpose || '']).sort());
    const ageLimit = (options.days || 365) * 86400000;
    const now = options.now || Date.now;
    let memory = null;
    function valid(value) {
      return !!value && value.version === version && value.inventory === fingerprint &&
        Number.isFinite(value.timestamp) && value.timestamp <= now() && now()-value.timestamp < ageLimit &&
        categories.every(c => typeof value.categories?.[c] === 'boolean');
    }
    function read() {
      if (valid(memory)) return memory;
      try { const saved = JSON.parse(options.storage.getItem(key)); return valid(saved) ? saved : null; }
      catch { return null; }
    }
    function save(choice) {
      const allowed = Object.fromEntries(categories.map(c => [c, choice[c] === true && inventory.some(s => s.category === c)]));
      memory = {version, inventory:fingerprint, timestamp:now(), categories:allowed};
      let persisted = true;
      try { options.storage.setItem(key,JSON.stringify(memory)); } catch { persisted = false; }
      return {choice:memory,persisted};
    }
    return {read,save,invalidate:() => { memory = null; },isAllowed:category => read()?.categories[category] === true};
  }

  function mount(win) {
    const doc = win.document;
    const config = win.SITE?.privacidade || {};
    const inventory = (Array.isArray(config.servicos) ? config.servicos : []).filter(s =>
      typeof s.id === 'string' && categories.includes(s.category) && typeof s.name === 'string');
    let storage;
    try { storage = win.localStorage; } catch { storage = {getItem(){throw new Error('unavailable')},setItem(){throw new Error('unavailable')}}; }
    const store = createStore({storage,version:config.versao || 2,days:config.validadeDias || 365,inventory});
    const adapters = new Map();
    let opener = null;
    let previousOverflow = '';
    let bannerWasVisible = false;
    let statusTimer;

    let banner = doc.getElementById('cookie-banner');
    if (!banner) {
      banner = doc.createElement('aside');
      banner.id = 'cookie-banner'; banner.className = 'cookie-banner'; banner.hidden = true;
      banner.setAttribute('aria-label','Preferências de cookies');
      banner.innerHTML = '<h3 class="cookie-banner__titulo">Sua privacidade importa.</h3><p class="cookie-banner__texto">Você pode escolher os cookies opcionais. Os recursos essenciais continuam funcionando ao recusar. Saiba mais na <a href="privacidade.html">Política de Privacidade</a>.</p><div class="cookie-banner__acoes"><button type="button" class="botao cookie-banner__btn" id="cookie-aceitar">Aceitar opcionais</button><button type="button" class="botao cookie-banner__btn" id="cookie-recusar">Recusar opcionais</button><button type="button" class="cookie-banner__personalizar" id="cookie-personalizar">Personalizar</button></div>';
      doc.body.appendChild(banner);
    }
    // O aviso inicial é não modal: não captura o foco nem impede a navegação.
    banner.removeAttribute('role');
    const modal = doc.createElement('div');
    modal.id = 'modal-cookies'; modal.className = 'modal-overlay'; modal.hidden = true;
    modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-labelledby','cookies-title');
    modal.innerHTML = '<div class="modal-container cookies-panel"><button type="button" class="modal-fechar" data-cookies-close aria-label="Fechar preferências de cookies">&times;</button><h2 class="modal-titulo" id="cookies-title">Suas preferências de cookies</h2><p class="modal-desc">Escolha quais categorias opcionais deseja permitir. Você pode mudar sua escolha pelo rodapé.</p><div class="cookies-category"><div><h3>Essenciais</h3><p>Permitem o funcionamento do site e o registro desta escolha.</p></div><label class="cookies-switch"><input type="checkbox" checked disabled aria-label="Cookies essenciais, sempre ativos"><span>Sempre ativos</span></label></div><div class="cookies-category"><div><h3>Medição</h3><p>Ajuda a entender visitas e conversões, quando houver uma ferramenta ativa.</p><p class="cookies-services" data-services="analytics"></p></div><label class="cookies-switch"><input type="checkbox" id="cookies-analytics"><span>Permitir medição</span></label></div><div class="cookies-category"><div><h3>Publicidade</h3><p>Permite medir campanhas e personalizar publicidade, quando disponível.</p><p class="cookies-services" data-services="marketing"></p></div><label class="cookies-switch"><input type="checkbox" id="cookies-marketing"><span>Permitir publicidade</span></label></div><p class="cookies-detail">Confira a <a href="privacidade.html">Política de Privacidade</a>. Recusar os opcionais não impede o uso da calculadora ou dos formulários.</p><div class="cookies-actions"><button type="button" class="botao" data-cookies-save>Salvar preferências</button><button type="button" class="botao cookies-equal" data-cookies-all>Aceitar opcionais</button><button type="button" class="botao cookies-equal" data-cookies-none>Recusar opcionais</button></div></div>';
    doc.body.appendChild(modal);
    const status = doc.createElement('p'); status.className = 'cookies-status'; status.setAttribute('role','status');
    status.setAttribute('aria-live','polite'); doc.body.appendChild(status);
    categories.forEach(category => {
      const services = inventory.filter(s => s.category === category);
      const field = modal.querySelector('#cookies-'+category);
      field.disabled = services.length === 0;
      modal.querySelector('[data-services="'+category+'"]').textContent = services.length
        ? 'Ferramentas: '+services.map(s => s.name).join(', ')+'.'
        : 'Nenhuma ferramenta desta categoria está ativa no momento.';
    });

    function clearCookies(service) {
      (service.cookies || []).forEach(cookie => {
        if (!cookie || !/^[a-zA-Z0-9_.-]+$/.test(cookie.name)) return;
        const domain = typeof cookie.domain === 'string' ? cookie.domain.replace(/^\./,'') : '';
        if (domain && win.location.hostname !== domain && !win.location.hostname.endsWith('.'+domain)) return;
        const path = typeof cookie.path === 'string' && /^\/[a-zA-Z0-9_/-]*$/.test(cookie.path) ? cookie.path : '/';
        doc.cookie = cookie.name+'=; Max-Age=0; path='+path+'; SameSite=Lax';
        if (domain) doc.cookie = cookie.name+'=; Max-Age=0; path='+path+'; domain='+domain+'; SameSite=Lax';
      });
    }
    function apply() {
      adapters.forEach((adapter,id) => {
        const service = inventory.find(s => s.id === id);
        const allowed = store.isAllowed(service.category);
        try {
          if (allowed && !adapter.active) { adapter.start(); adapter.active = true; }
          if (!allowed) { if (adapter.active) adapter.stop(); adapter.active = false; clearCookies(service); }
        } catch { console.warn('Não foi possível atualizar uma ferramenta opcional de privacidade.'); }
      });
      win.dispatchEvent(new CustomEvent('nortins:privacy-change',{detail:{analytics:store.isAllowed('analytics'),marketing:store.isAllowed('marketing')}}));
    }
    function close() {
      modal.classList.remove('aberto'); modal.hidden = true;
      doc.body.style.overflow = previousOverflow;
      if (!store.read() && bannerWasVisible) banner.hidden = false;
      if (opener?.isConnected) opener.focus();
    }
    function open() {
      if (!modal.hidden) return;
      if (doc.querySelector('.modal-overlay:not([hidden])')) return;
      opener = doc.activeElement; previousOverflow = doc.body.style.overflow;
      bannerWasVisible = !banner.hidden; banner.hidden = true;
      categories.forEach(c => { modal.querySelector('#cookies-'+c).checked = store.isAllowed(c); });
      modal.hidden = false; doc.body.style.overflow = 'hidden';
      win.requestAnimationFrame(() => {modal.classList.add('aberto');win.setTimeout(()=>{if(!modal.hidden)modal.querySelector('[data-cookies-close]').focus({preventScroll:true});},60);});
    }
    function save(choice) {
      const result = store.save(choice); apply(); banner.hidden = true;
      if (!modal.hidden) close();
      status.textContent = result.persisted ? 'Preferências de cookies salvas.' : 'Preferência aplicada nesta visita. O navegador não permitiu salvá-la para a próxima visita.';
      win.clearTimeout(statusTimer);
      statusTimer = win.setTimeout(() => { status.textContent = ''; },5000);
    }
    const all = () => save({analytics:true,marketing:true});
    const none = () => save({analytics:false,marketing:false});
    doc.getElementById('cookie-aceitar')?.addEventListener('click',all);
    doc.getElementById('cookie-recusar')?.addEventListener('click',none);
    doc.getElementById('cookie-personalizar')?.addEventListener('click',open);
    doc.querySelectorAll('#btn-preferencias-cookies,[data-preferencias-cookies]').forEach(button => button.addEventListener('click',open));
    modal.querySelector('[data-cookies-close]').addEventListener('click',close);
    modal.querySelector('[data-cookies-save]').addEventListener('click',() => save(Object.fromEntries(categories.map(c => [c,modal.querySelector('#cookies-'+c).checked]))));
    modal.querySelector('[data-cookies-all]').addEventListener('click',all);
    modal.querySelector('[data-cookies-none]').addEventListener('click',none);
    modal.addEventListener('click',event => { if (event.target === modal) close(); });
    doc.addEventListener('keydown',event => {
      if(modal.hidden)return;
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const fields = Array.from(modal.querySelectorAll('button,a[href],input:not(:disabled)')).filter(e => e.offsetParent !== null);
      const first = fields[0],last = fields.at(-1);
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && (doc.activeElement === last || !modal.contains(doc.activeElement))) { event.preventDefault(); first.focus(); }
    });
    win.addEventListener('storage',event => { if (event.key === 'nortins_cookie_prefs' || event.key === null) { store.invalidate(); apply(); } });
    banner.hidden = !!store.read(); apply();
    return {
      open,
      isAllowed:store.isAllowed,
      registerService(adapter) {
        const service = inventory.find(s => s.id === adapter.id);
        if (!service || typeof adapter.start !== 'function' || typeof adapter.stop !== 'function' || adapters.has(adapter.id)) throw new Error('Ferramenta opcional não declarada ou inválida.');
        adapters.set(adapter.id,{...adapter,active:false}); apply();
      }
    };
  }
  return {createStore,mount};
});
