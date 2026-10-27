/* Site Cinematográfico · © 2026 Labrego IA · LBG-SC-2026-v1
   Motor da rolagem cinematográfica, calculadora do HERO, modal simulador e formulário. */
(() => {
  const S = window.SITE || {};
  const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const celular = matchMedia("(max-width: 760px)").matches;

  console.log("%cSite Cinematográfico · Labrego IA", "font:600 12px sans-serif;color:#FFC200",
    `\nlabregoia.com.br · ${S.assinatura || ""}`);

  /* ── Contagem animada dos indicadores do HERO ─────────────────────────── */
  (() => {
    const els = document.querySelectorAll('.hero-ind strong[data-count]');
    if (!els.length) return;
    const duration = 1800;
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const formatNum = (n, el) => {
      const prefix = el.dataset.prefix || '';
      if (el.dataset.format === 'k') {
        return prefix + Math.round(n / 1000) + 'K';
      }
      const suffix = el.dataset.suffix || '';
      return prefix + n.toLocaleString('pt-BR') + suffix;
    };
    if (reduzir) {
      els.forEach(el => { el.textContent = formatNum(Number(el.dataset.count), el); });
      return;
    }
    let start = null;
    const step = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ep = easeOut(p);
      els.forEach(el => {
        const target = Number(el.dataset.count);
        const current = Math.max(1, Math.round(ep * target));
        el.textContent = formatNum(current, el);
      });
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  })();

  /* ── Estado global da simulação ──────────────────────────────────────── */
  const estadoSim = {
    gasto: 200,
    tipo: "",
    cidade: "",
    nome: "",
    whatsapp: "",
    email: "",
    kwh: null,
    armazenamento: false,
    solutionInterest: "",
    resultado: null,
  };

  const loadRules=()=>import('./catalogo.mjs');
  const loadIntegration=()=>import('./integracoes.mjs');
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function prepareForm(form,status){try{await (await loadIntegration()).prepare(form);}catch(error){if(status)status.textContent=error.message;}}
  async function calcularResultado() {
    const rules=await loadRules();const integration=await loadIntegration();let result,received=false;
    if(integration.isConfigured()){
      const system=estadoSim.armazenamento?'hybrid':estadoSim.solutionInterest||'on-grid';
      let field=formSim.querySelector('[name="system"]');if(!field){field=document.createElement('input');field.type='hidden';field.name='system';formSim.appendChild(field);}field.value=system;
      const response=await integration.submit('simulate',formSim);result=response.result;received=true;
    }else{
      const response=await fetch('catalogo.json',{cache:'no-store'});if(!response.ok)throw new Error('Não foi possível consultar o catálogo. Tente novamente.');
      const catalog=await response.json();const city=estadoSim.cidade.replace(/\s*[-/,]\s*[A-Z]{2}\s*$/i,'');const state=estadoSim.cidade.match(/[-/,]\s*([A-Z]{2})\s*$/i)?.[1]||'TO';
      result=rules.simulate({monthlyBill:estadoSim.gasto,consumptionKwh:estadoSim.kwh,segment:estadoSim.tipo,city,state,system:estadoSim.armazenamento?'hybrid':estadoSim.solutionInterest||'on-grid'},catalog);
    }
    if(!result)throw new Error('Não foi possível confirmar o resultado. Tente novamente.');
    const base={contaAtual:rules.money(Math.round(estadoSim.gasto*100)),received};
    if(result.mode!=='estimate')return {...base,modo:'analise',msg:result.message};
    const k=result.kit,f=k.finance;
    return {...base,modo:'catalogo',kit:k.name,potencia:result.powerKwp.toLocaleString('pt-BR')+' kWp',geracao:k.generationKwhMonth.toLocaleString('pt-BR')+' kWh/mês',modulos:k.modules.quantity+' × '+k.modules.brand+' '+k.modules.model+' ('+k.modules.watts+' Wp)',inversor:k.inverter.quantity+' × '+k.inverter.brand+' '+k.inverter.model,valorProjeto:rules.money(result.priceMinor),valorDesconto:rules.money(k.discountMinor),parcela:f?f.months+' × '+rules.money(f.installmentMinor):'Sob consulta',modalidade:f?.description||'Condições a confirmar',entrada:f?rules.money(f.downPaymentMinor):'Sob consulta',carencia:f?f.graceDays+' dias':'Sob consulta',validade:k.validUntil||'Confirmar na proposta',catalogVersion:result.catalogVersion,consumo:result.consumptionKwh.toLocaleString('pt-BR',{maximumFractionDigits:2})+' kWh/mês'};
  }


    function montarMensagemWhatsapp(resultado) {
    const linhas = [
      `Olá! Conheci a NORTINS ENERGY pelo site e gostaria de conversar sobre um projeto de energia solar.`,
      ``,
      `*Dados do simulador:*`,
      `• Nome: ${estadoSim.nome || "—"}`,
      `• Cidade/UF: ${estadoSim.cidade || "—"}`,
      `• Perfil: ${(estadoSim.tipo || "—").replace(/^\w/, c => c.toUpperCase())}`,
      `• Gasto mensal: ${resultado.contaAtual || `R$ ${estadoSim.gasto}`}`,
      estadoSim.kwh ? `• Consumo informado: ${estadoSim.kwh} kWh/mês` : null,
      estadoSim.armazenamento ? `• Interesse em híbrido/armazenamento: Sim` : null,
      estadoSim.solutionInterest ? `• Solução de interesse: ${estadoSim.solutionInterest === "on-grid" ? "On-grid" : estadoSim.solutionInterest === "hybrid" ? "Híbrido" : "Baterias / BESS"}` : null,
      ``,
      resultado.modo === "catalogo" ? `*Estimativa inicial de projeto:*` : `*Análise assistida:*`,
      resultado.modo === "catalogo" ? `• Kit: ${resultado.kit}` : null,
      resultado.modo === "catalogo" ? `• Potência: ${resultado.potencia}` : null,
      resultado.modo === "catalogo" ? `• Geração estimada: ${resultado.geracao}` : null,
      resultado.modo === "catalogo" ? `• Módulos: ${resultado.modulos}` : null,
      resultado.modo === "catalogo" ? `• Inversor: ${resultado.inversor}` : null,
      resultado.modo === "catalogo" ? `• Valor do projeto: ${resultado.valorProjeto}` : null,
      resultado.modo === "catalogo" ? `• Desconto: ${resultado.valorDesconto}` : null,
      resultado.modo === "catalogo" ? `• Parcela: ${resultado.parcela}` : null,
      resultado.modo === "catalogo" ? `• Modalidade: ${resultado.modalidade}` : null,
      resultado.modo === "catalogo" ? `• Entrada: ${resultado.entrada} | Carência: ${resultado.carencia}` : null,
      resultado.modo === "analise" ? `• ${resultado.msg}` : null,
    ].filter(Boolean).join("\n");
    return linhas;
  }

  /* ── Rolagem que toca o vídeo + transição dia/noite pela calculadora ── */
  const cine = document.querySelector(".cine");
  const canvas = cine && cine.querySelector(".cine-canvas");
  let frameAtual = 0;
  let totalFrames = 0;
  let quadros = [];
  let desenhado = -1;
  let alvoFrame = 0;
  let atualFrame = 0;

  if (cine && canvas && S.frames && S.frames.total) {
    const ctx = canvas.getContext("2d");
    totalFrames = S.frames.total;
    const padrao = celular ? S.frames.mobile : S.frames.desktop;
    const src = (i) => padrao.replace("{n}", String(i + 1).padStart(4, "0"));
    quadros = new Array(totalFrames);

    const carregar = (i) => {
      if (quadros[i]) return quadros[i];
      const img = new Image();
      img.decoding = "async";
      img.src = src(i);
      img.onload = () => { if (Math.round(atualFrame) === i || desenhado === -1) desenhar(i, true); };
      return (quadros[i] = img);
    };

    carregar(0);
    if (!reduzir) {
      const fila = [];
      for (const passo of [8, 4, 2, 1]) for (let i = 0; i < totalFrames; i += passo) if (!fila.includes(i)) fila.push(i);
      let k = 0;
      const lote = () => { for (let n = 0; n < 6 && k < fila.length; n++) carregar(fila[k++]); if (k < fila.length) setTimeout(lote, 40); };
      lote();
    }

    const pronto = (i) => quadros[i] && quadros[i].complete && quadros[i].naturalWidth;
    const maisProximo = (i) => {
      for (let d = 0; d < totalFrames; d++) {
        if (pronto(i - d)) return i - d;
        if (pronto(i + d)) return i + d;
      }
      return -1;
    };

    const ajustar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      desenhado = -1;
      desenhar(Math.round(atualFrame), true);
    };

    function desenhar(i, forcar) {
      const j = maisProximo(i);
      if (j < 0 || (j === desenhado && !forcar)) return;
      const img = quadros[j];
      const cw = canvas.width, ch = canvas.height;
      const escala = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * escala, h = img.naturalHeight * escala;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
      desenhado = j;
      frameAtual = j;
    }

    const progressoScroll = () => {
      const r = cine.getBoundingClientRect();
      const curso = cine.offsetHeight - innerHeight;
      return Math.min(1, Math.max(0, -r.top / (curso || 1)));
    };

    const quadro = () => {
      // Animação vinculada exclusivamente ao scroll da página
      alvoFrame = progressoScroll() * (totalFrames - 1);
      atualFrame += (alvoFrame - atualFrame) * 0.18;
      if (Math.abs(alvoFrame - atualFrame) < 0.05) atualFrame = alvoFrame;
      desenhar(Math.round(atualFrame));
      cine.classList.toggle("andou", atualFrame > 0.5);
      requestAnimationFrame(quadro);
    };

    addEventListener("resize", ajustar);
    ajustar();
    if (!reduzir) requestAnimationFrame(quadro);
  }

  /* ── Calculadora do HERO ─────────────────────────────────────────────── */
  const slider = document.getElementById("calc-slider");
  const inputCalc = document.getElementById("calc-input");
  const btnSimular = document.getElementById("btn-simular");
  const avisoCalc = document.getElementById("calc-aviso");

  function setGastoHero(valor, origem) {
    const min = 200, max = 1600, step = 100;
    let v = parseInt(valor, 10);
    if (isNaN(v)) v = min;
    let foraRange = false;
    if (v < min) { v = min; foraRange = origem === "input"; }
    if (v > max) { v = max; foraRange = origem === "input"; }
    if (origem === "slider") v = Math.round(v / step) * step;

    estadoSim.gasto = v;
    if (slider) slider.value = Math.min(max, Math.max(min, v));
    if (inputCalc) inputCalc.value = v;
    const footerValue = document.getElementById("calc-footer-valor");
    const footerRange = document.getElementById("calc-footer-range");
    if (footerValue) footerValue.value = v;
    if (footerRange) footerRange.value = v;

    if (avisoCalc) {
      avisoCalc.textContent = foraRange ? `Valor ajustado para a faixa de R$ ${min} a R$ ${max}.` : "";
    }
  }

  if (slider) slider.addEventListener("input", () => setGastoHero(slider.value, "slider"));
  if (inputCalc) inputCalc.addEventListener("input", () => setGastoHero(inputCalc.value, "input"));
  if (inputCalc) inputCalc.addEventListener("blur", () => setGastoHero(inputCalc.value, "input"));

  // Libera controle por scroll quando usuário rola significativamente além do HERO
  
  /* ── Modal Simulador ─────────────────────────────────────────────────── */
  const overlay = document.getElementById("modal-simulador");
  const telaForm = document.getElementById("tela-form");
  const telaResultado = document.getElementById("tela-resultado");
  const formSim = document.getElementById("form-simulador");
  const btnFechar = document.getElementById("modal-fechar");
  const btnEditar = document.getElementById("btn-editar");
  const btnWhatsResultado = document.getElementById("btn-whats-resultado");
  const resultadoConteudo = document.getElementById("resultado-conteudo");
  const resultadoModo = document.getElementById("resultado-modo");
  const simStatus = document.getElementById("sim-status");
  let ultimoFoco = null;

  function abrirModal() {
    ultimoFoco = document.activeElement;
    // Preenche gasto do HERO no formulário
    const campoGasto = document.getElementById("sim-gasto");
    if (campoGasto) campoGasto.value = estadoSim.gasto;
    // Restaura demais campos se já preenchidos
    if (estadoSim.tipo) document.getElementById("sim-tipo").value = estadoSim.tipo;
    if (estadoSim.cidade) document.getElementById("sim-cidade").value = estadoSim.cidade;
    if (estadoSim.nome) document.getElementById("sim-nome").value = estadoSim.nome;
    if (estadoSim.whatsapp) document.getElementById("sim-whats").value = estadoSim.whatsapp;
    if (estadoSim.email) document.getElementById("sim-email").value = estadoSim.email;
    if (estadoSim.kwh) document.getElementById("sim-kwh").value = estadoSim.kwh;
    if (estadoSim.armazenamento) document.getElementById("sim-armazenamento").checked = true;

    mostrarTela("form");
    overlay.hidden = false;
    prepareForm(formSim,simStatus);
    requestAnimationFrame(() => overlay.classList.add("aberto"));
    document.body.style.overflow = "hidden";
    // Foco no primeiro campo
    setTimeout(() => campoGasto && campoGasto.focus(), 100);
  }

  function fecharModal() {
    overlay.classList.remove("aberto");
    setTimeout(() => {
      overlay.hidden = true;
      document.body.style.overflow = "";
      if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    }, 300);
  }

  function mostrarTela(nome) {
    telaForm.classList.toggle("modal-tela--ativa", nome === "form");
    telaForm.hidden = nome !== "form";
    telaResultado.classList.toggle("modal-tela--ativa", nome === "resultado");
    telaResultado.hidden = nome !== "resultado";
  }

  if (btnSimular) btnSimular.addEventListener("click", abrirModal);
  if (btnFechar) btnFechar.addEventListener("click", fecharModal);
  if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) fecharModal(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay && !overlay.hidden) fecharModal(); });

  if (btnEditar) btnEditar.addEventListener("click", () => mostrarTela("form"));

  /* ── Submissão do formulário → resultado ─────────────────────────────── */
  if (formSim) {
    formSim.addEventListener("submit", async (ev) => {
      ev.preventDefault();const button=formSim.querySelector('button[type="submit"]');if(button.disabled)return;
      ev.preventDefault();
      // Coleta dados
      const fd = new FormData(formSim);
      estadoSim.gasto = parseInt(fd.get("gasto"), 10) || estadoSim.gasto;
      estadoSim.tipo = fd.get("tipo") || "";
      estadoSim.cidade = fd.get("cidade") || "";
      estadoSim.nome = fd.get("nome") || "";
      estadoSim.whatsapp = fd.get("whatsapp") || "";
      estadoSim.email = fd.get("email") || "";
      estadoSim.kwh = fd.get("kwh") ? Number(fd.get("kwh")) : null;
      estadoSim.armazenamento = fd.get("armazenamento") === "on";

      // Validação básica
      let valido = true;
      const obrigatorios = ["gasto", "tipo", "cidade", "nome", "whatsapp"];
      for (const campo of obrigatorios) {
        const el = formSim.querySelector(`[name="${campo}"]`);
        if (!el || !el.value.trim()) {
          el && el.closest(".campo").classList.add("erro");
          valido = false;
        } else {
          el.closest(".campo").classList.remove("erro");
        }
      }
      if (!valido) {
        simStatus.textContent = "Preencha todos os campos obrigatórios.";
        simStatus.className = "form-status campo--inteiro falha";
        return;
      }
      if(!/^\d{10,13}$/.test(estadoSim.whatsapp.replace(/\D/g,""))){simStatus.textContent="Confira seu WhatsApp com DDD.";return;}
      simStatus.textContent = "Preparando sua análise…";
      button.disabled=true;formSim.setAttribute("aria-busy","true");
      try{
      const resultado = await calcularResultado();
      estadoSim.resultado = resultado;

      // Renderiza tela de resultado
      renderizarResultado(resultado);
      mostrarTela("resultado");

      // Prepara link WhatsApp
      const msg = montarMensagemWhatsapp(resultado);
      const num = String(S.whatsapp?.numero || "").replace(/\D/g, "");
      if (btnWhatsResultado && num) {
        btnWhatsResultado.href = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
      }
      }catch(error){simStatus.textContent=error.message;simStatus.className="form-status campo--inteiro falha";}finally{button.disabled=false;formSim.removeAttribute("aria-busy");}
    });
  }

  function renderizarResultado(r) {
    if (r.modo === "analise") {
      resultadoConteudo.innerHTML = `<div class="resultado-item"><span class="resultado-label">Status</span><span class="resultado-valor">${safe(r.msg)}</span></div>`;
      resultadoModo.textContent = r.received?"Solicitação recebida. A equipe confirmará os próximos passos.":"Seus dados ainda não foram enviados. Use o botão do WhatsApp para solicitar sua análise.";
      return;
    }
    const itens = [
      ["Conta atual", r.contaAtual],
      ["Kit selecionado", r.kit],
      ["Potência do sistema", r.potencia],
      ["Geração média estimada", r.geracao],
      ["Módulos", r.modulos, true],
      ["Inversor", r.inversor, true],
      ["Valor do projeto", r.valorProjeto, false, "resultado-valor--destaque"],
      ["Desconto aplicado", r.valorDesconto],
      ["Parcela", r.parcela],
      ["Modalidade", r.modalidade],
      ["Entrada", r.entrada],
      ["Carência", r.carencia],
      ["Validade", r.validade],
    ];
    resultadoConteudo.innerHTML = itens.map(([label, valor, isEquip, extraClass]) => `
      <div class="resultado-item">
        <span class="resultado-label">${label}</span>
        <span class="resultado-valor ${extraClass || ""}">${safe(valor)}${isEquip ? `<div class="resultado-equip"></div>` : ""}</span>
      </div>
    `).join("");
    resultadoModo.textContent = "Estimativa inicial, sujeita à análise técnica e às condições do financiamento. " + (r.received?"Solicitação recebida.":"Seus dados ainda não foram enviados; continue pelo WhatsApp.");
  }

  /* ── Parallax leve nas artes ──────────────────────────────────────────── */
  const artes = reduzir ? [] : [...document.querySelectorAll(".arte")];
  if (artes.length) {
    const mover = () => {
      for (const a of artes) {
        const r = a.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) continue;
        const c = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        a.style.transform = `translate3d(0, ${(c * -60).toFixed(1)}px, 0) scale(1.08)`;
      }
    };
    addEventListener("scroll", () => requestAnimationFrame(mover), { passive: true });
    mover();
  }

  /* ── Topo, revelar e ano ──────────────────────────────────────────────── */
  const topo = document.querySelector(".topo");
  const whats = document.querySelector(".whats");
  let formNaTela = false;
  const aoRolar = () => {
    topo && topo.classList.toggle("rolou", scrollY > 40);
    whats && whats.classList.toggle("visivel", scrollY > innerHeight * 0.6 && !formNaTela);
  };
  const formEl = document.querySelector(".form:not(.form--modal)");
  if (formEl) new IntersectionObserver(([e]) => { formNaTela = e.isIntersecting; aoRolar(); }).observe(formEl);
  addEventListener("scroll", aoRolar, { passive: true });
  aoRolar();

  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("visto"); io.unobserve(e.target); }
  }), { threshold: 0.18 });
  document.querySelectorAll(".revelar").forEach((el) => io.observe(el));
  document.querySelectorAll("[data-ano]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ── WhatsApp flutuante ──────────────────────────────────────────────── */
  if (whats && S.whatsapp) {
    const num = String(S.whatsapp.numero || "").replace(/\D/g, "");
    whats.href = `https://wa.me/${num}?text=${encodeURIComponent(S.whatsapp.mensagem || "")}`;
  }

  /* ── Cartões de Benefícios (Flip 3D) ───────────────────────────────────── */
document.querySelectorAll(".cartao-flip").forEach((card) => {
const toggle = () => {
const isFlipped = card.classList.toggle("virado");
const verso = card.querySelector(".cartao-verso");
if (verso) verso.setAttribute("aria-hidden", String(!isFlipped));
};
card.addEventListener("click", toggle);
card.addEventListener("keydown", (e) => {
if (e.key === "Enter" || e.key === " ") {
e.preventDefault();
toggle();
}
});
});

/* ── Como funciona a energia solar? (abas + cenários + modal) ─────────── */
  /* ── Como funciona a energia solar? (visualizador único + quadros.json) ── */
  const solarSection = document.querySelector(".solar-how");
  if (solarSection) {
    const tabs = Array.from(solarSection.querySelectorAll("[role='tab']"));
    const conditionRadios = Array.from(solarSection.querySelectorAll("input[name='solar-condition']"));
    const imgEl = solarSection.querySelector(".solar-how__img");
    const captionEl = solarSection.querySelector(".solar-how__caption");
    const stepsList = solarSection.querySelector(".solar-how__steps");
    const ctaBtn = solarSection.querySelector(".solar-how__cta");
    const zoomBtn = solarSection.querySelector(".solar-how__zoom");

    let catalog = null;
    let currentSolution = "on-grid";
    let currentCondition = "day";
    let isUpdating = false;

    const findQuadro = (solution, condition) => {
      if (!catalog) return null;
      return catalog.images.find((q) => q.solution === solution && q.condition === condition) || null;
    };

    const updateView = async (solution, condition) => {
      if (isUpdating) return;
      isUpdating = true;
      const quadro = findQuadro(solution, condition);
      if (!quadro) { isUpdating = false; return; }

      // Atualiza seletores visuais
      tabs.forEach((t) => {
        const isActive = t.dataset.solution === solution;
        t.setAttribute("aria-selected", String(isActive));
        t.classList.toggle("solar-how__tab--active", isActive);
        t.tabIndex = isActive ? 0 : -1;
      });
      conditionRadios.forEach((r) => {
        const isActive = r.value === condition;
        r.checked = isActive;
        r.closest(".solar-how__condition")?.classList.toggle("solar-how__condition--active", isActive);
      });

      // Troca imagem com dissolução
      if (imgEl) {
        const basePath = "assets/img/solar/quadros/";
        const webpFile = quadro.file.replace(/\.png$/, ".webp");
        const nextSrc = basePath + webpFile;
        if (imgEl.getAttribute("src") !== nextSrc) {
          imgEl.style.opacity = "0";
          await new Promise((resolve) => {
            const preload = new Image();
            preload.onload = resolve;
            preload.onerror = resolve;
            preload.src = nextSrc;
          });
          imgEl.src = nextSrc;
          imgEl.alt = quadro.alt || quadro.label;
          imgEl.style.opacity = "1";
        }
      }

      // Atualiza legenda e etapas
      if (captionEl) captionEl.textContent = quadro.summary || "";
      if (stepsList && quadro.steps) {
        stepsList.innerHTML = quadro.steps.map((s) => `<li>${s}</li>`).join("");
      }

      // Atualiza CTA
      if (ctaBtn && catalog.ctas) {
        ctaBtn.textContent = catalog.ctas[solution] || ctaBtn.textContent;
        ctaBtn.dataset.simSolution = solution;
      }

      currentSolution = solution;
      currentCondition = condition;
      isUpdating = false;
    };

    // Carrega catálogo e inicializa
    fetch("assets/img/solar/quadros/quadros.json")
      .then((r) => r.json())
      .then((data) => {
        catalog = data;
        const def = data.defaultState || { solution: "on-grid", condition: "day" };
        updateView(def.solution, def.condition);
      })
      .catch(() => {
        // Fallback mínimo se JSON falhar
        if (captionEl) captionEl.textContent = "Não foi possível carregar o catálogo de quadros.";
      });

    // Eventos das abas (sistema)
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        updateView(tab.dataset.solution, currentCondition);
      });
      tab.addEventListener("keydown", (e) => {
        const idx = tabs.indexOf(tab);
        let next = -1;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % tabs.length;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        if (next >= 0) {
          e.preventDefault();
          tabs[next].focus();
          updateView(tabs[next].dataset.solution, currentCondition);
        }
      });
    });

    // Eventos dos rádios (condição)
    conditionRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        radio.closest(".solar-how__condition")?.classList.add("solar-how__condition--active");
        conditionRadios.forEach((r) => {
          if (r !== radio) r.closest(".solar-how__condition")?.classList.remove("solar-how__condition--active");
        });
        updateView(currentSolution, radio.value);
      });
    });

    // CTA abre modal preservando dados
    if (ctaBtn) {
      ctaBtn.addEventListener("click", () => {
        const solution = ctaBtn.dataset.simSolution;
        if (!solution) return;
        estadoSim.tipo = "residencial";
        estadoSim.armazenamento = solution !== "on-grid";
        estadoSim.solutionInterest = solution;
        const modalTrigger = document.querySelector('[data-abre="simulador"]') || document.querySelector('.botao[data-modal="simulador"]');
        if (modalTrigger) modalTrigger.click();
        else {
          const modal = document.getElementById("modal-simulador") || document.querySelector(".modal-simulador");
          if (modal) {
            modal.removeAttribute("hidden");
            modal.classList.add("aberto");
            document.body.style.overflow = "hidden";
          }
        }
      });
    }

    // Botão Ampliar quadro (lightweight lightbox)
    if (zoomBtn && imgEl) {
      zoomBtn.addEventListener("click", () => {
        const overlay = document.createElement("div");
        overlay.className = "solar-zoom-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-label", "Quadro ampliado");
        const clone = imgEl.cloneNode(true);
        clone.style.opacity = "1";
        clone.removeAttribute("loading");
        overlay.appendChild(clone);
        document.body.appendChild(overlay);
        document.body.style.overflow = "hidden";
        const close = () => {
          overlay.remove();
          document.body.style.overflow = "";
          zoomBtn.focus();
        };
        overlay.addEventListener("click", close);
        overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
        requestAnimationFrame(() => overlay.focus());
      });
    }
  }

  /* ── Calculadora do fechamento: mesma origem de dados do HERO ──────── */
  const calcFooterInput = document.getElementById("calc-footer-valor");
  const calcFooterRange = document.getElementById("calc-footer-range");
  const btnSimularFooter = document.getElementById("btn-simular-footer");
  if (calcFooterInput) {
    calcFooterInput.addEventListener("input", () => setGastoHero(calcFooterInput.value, "input"));
    calcFooterInput.addEventListener("blur", () => setGastoHero(calcFooterInput.value, "input"));
  }
  if (calcFooterRange) calcFooterRange.addEventListener("input", () => setGastoHero(calcFooterRange.value, "slider"));
  if (inputCalc || slider) setGastoHero(inputCalc ? inputCalc.value : slider.value, "slider");
  if (btnSimularFooter && overlay) btnSimularFooter.addEventListener("click", abrirModal);

  /* Preferências de cookies são gerenciadas em cookies.js. */

    /* ── Modais de Parceria e Talentos ─────────────────────────────────────── */
  const LABELS_PAR = { nome: "Nome completo", whatsapp: "WhatsApp", email: "E-mail", cidade: "Cidade", uf: "UF", atuacao: "Como deseja atuar", regiao: "Região pretendida", experiencia: "Experiência" };
  const ATUACAO_MAP = { indicacao: "Indicação de clientes", prospeccao: "Prospecção de clientes", representacao: "Representação comercial", entender: "Quero entender as possibilidades" };
  const LABELS_TAL = { nome: "Nome completo", whatsapp: "WhatsApp", email: "E-mail", cidade: "Cidade", uf: "UF", area: "Área de interesse", experiencia: "Experiência", linkedin: "LinkedIn / Portfólio", curriculo: "Currículo" };
  const AREA_MAP = { instalacao: "Instalação e técnica", engenharia: "Engenharia e projetos", comercial: "Comercial e vendas", atendimento: "Atendimento e pós-venda", administrativo: "Administrativo e financeiro", logistica: "Logística e almoxarifado", outra: "Outra área" };
  const EXT_VALIDAS = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  const MAX_SIZE = 5 * 1024 * 1024;

  let arquivoCurriculo = null;
  let triggerBtn = null;

  function abrirModalParticipacao(id, btn) {
    const modal = document.getElementById(id);
    if (!modal) return;
    triggerBtn = btn;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {modal.classList.add("aberto");modal.querySelector("input, select, textarea, button:not(.modal-fechar)")?.focus();});
  }

  function fecharModalParticipacao(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove("aberto");
    document.body.style.overflow = "";
    setTimeout(() => { modal.hidden = true; }, reduzir ? 0 : 220);
    if (triggerBtn) { triggerBtn.focus(); triggerBtn = null; }
  }

  // Delegação de eventos para abertura/fechamento
  document.addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-open-modal]");
    if (openBtn) { abrirModalParticipacao(openBtn.dataset.openModal, openBtn); return; }
    const closeBtn = e.target.closest("[data-close-modal]");
    if (closeBtn) { fecharModalParticipacao(closeBtn.dataset.closeModal); return; }
    // Fechar ao clicar no overlay
    if (["modal-parceria", "modal-talentos"].includes(e.target.id) && !e.target.hidden) {
      fecharModalParticipacao(e.target.id);
    }
  });

  document.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const modal=document.querySelector('#modal-parceria.aberto,#modal-talentos.aberto,#modal-simulador.aberto');if(!modal)return;
    const fields=Array.from(modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,a[href]')).filter(field=>field.offsetParent!==null);
    const first=fields[0],last=fields.at(-1);if(!first)return;
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  // Tecla Esc fecha modal aberto
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      ["modal-parceria", "modal-talentos"].forEach((id) => {
        const m = document.getElementById(id);
        if (m && !m.hidden) fecharModalParticipacao(id);
      });
    }
  });

  /* ── Navegação multi-etapas genérica ──────────────────────────────────── */
  function initMultiStep(formId, prefixo, labelsMap, extraMap) {
    const form = document.getElementById(formId);
    if (!form) return;
    const steps = form.querySelectorAll(".form-step");
    const stepLabel = document.getElementById(`${prefixo}-step-label`);
    const stepFill = document.getElementById(`${prefixo}-step-fill`);
    const stepsBar = form.querySelector(".form-steps");
    const revisaoEl = document.getElementById(`${prefixo}-revisao`);
    const enviandoEl = document.getElementById(`${prefixo}-enviando`);
    const sucessoEl = document.getElementById(`${prefixo}-sucesso`);

    function goTo(n) {
      steps.forEach((s) => s.classList.remove("ativo"));
      const alvo = form.querySelector(`.form-step[data-step="${n}"]`);
      if (n===3) prepareForm(form,form.querySelector("[data-form-status]"));
      if (alvo) {
        alvo.classList.add("ativo");
        const titulo = alvo.querySelector(".form-step__titulo");
        if (titulo) titulo.focus();
        if (stepLabel) stepLabel.textContent = `Etapa ${n} de 3`;
        if (stepFill) stepFill.style.width = `${(n / 3) * 100}%`;
        if (stepsBar) stepsBar.setAttribute("aria-valuenow", n);
      }
    }

    function validar(stepNum) {
      const step = form.querySelector(`.form-step[data-step="${stepNum}"]`);
      const campos = step.querySelectorAll("[required]");
      let ok = true;
      let primeiroErro = null;
      campos.forEach((c) => {
        const wrap = c.closest(".campo");
        let valido = c.type==="checkbox"?c.checked:c.value.trim() !== "";
        if(c.type==="tel"&&valido)valido=/^\d{10,13}$/.test(c.value.replace(/\D/g,""));
        if (c.type === "email" && valido) valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.value.trim());
        if (!valido) { wrap.classList.add("invalido"); if (!primeiroErro) primeiroErro = c; ok = false; }
        else wrap.classList.remove("invalido");
      });
      // Validação opcional de email não-required (parceria etapa 1)
      if (prefixo === "par" && stepNum === 1) {
        const em = form.querySelector("#par-email");
        if (em && em.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim())) {
          em.closest(".campo").classList.add("invalido");
          if (!primeiroErro) primeiroErro = em;
          ok = false;
        } else if (em) em.closest(".campo").classList.remove("invalido");
      }
      // Validação opcional de LinkedIn (talentos etapa 2)
      if (prefixo === "tal" && stepNum === 2) {
        const lk = form.querySelector("#tal-linkedin");
        if (lk && lk.value.trim() && !/^https?:\/\/.+/.test(lk.value.trim())) {
          lk.closest(".campo").classList.add("invalido");
          if (!primeiroErro) primeiroErro = lk;
          ok = false;
        } else if (lk) lk.closest(".campo").classList.remove("invalido");
      }
      if (primeiroErro) primeiroErro.focus();
      return ok;
    }

    function montarRevisao() {
      const fd = new FormData(form);
      const itens = [];
      Object.keys(labelsMap).forEach((k) => {
        if (k === "curriculo") return;
        const v = fd.get(k);
        if (v && v.trim()) {
          let display = v.trim();
          if (extraMap && extraMap[k]) display = extraMap[k][v] || v;
          itens.push(`<div class="revisao-item"><span class="revisao-label">${labelsMap[k]}</span><span class="revisao-valor">${safe(display)}</span></div>`);
        }
      });
      if (prefixo === "tal") {
        itens.push(`<div class="revisao-item"><span class="revisao-label">${labelsMap.curriculo}</span><span class="revisao-valor">${safe(arquivoCurriculo ? arquivoCurriculo.name : "Currículo não anexado")}</span></div>`);
      }
      if (revisaoEl) revisaoEl.innerHTML = itens.join("");
    }

    form.addEventListener("click", (e) => {
      const next = e.target.closest(".btn-proximo, .btn-revisar");
      const prev = e.target.closest(".btn-voltar");
      if (next) {
        const atual = parseInt(next.closest(".form-step").dataset.step);
        if (!validar(atual)) return;
        const prox = parseInt(next.dataset.next);
        if (prox === 3) montarRevisao();
        goTo(prox);
      }
      if (prev) goTo(parseInt(prev.dataset.prev));
    });

    // Prevenir Enter nas etapas intermediárias
    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
        const step = e.target.closest(".form-step");
        if (step && step.dataset.step !== "3") e.preventDefault();
      }
    });

    let sending=false;
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(sending)return;
      for(const step of [1,2,3])if(!validar(step)){goTo(step);return;}
      const status=form.querySelector('[data-form-status]');const button=form.querySelector('[type="submit"]');
      sending=true;button.disabled=true;form.setAttribute('aria-busy','true');enviandoEl?.classList.add('visivel');status.textContent='';
      try{
        await (await loadIntegration()).submit(prefixo==='par'?'partner':'talent',form,prefixo==='tal'?arquivoCurriculo:null);
        form.hidden=true;sucessoEl.classList.add('visivel');sucessoEl.setAttribute('tabindex','-1');sucessoEl.focus();
      }catch(error){status.textContent=error.message;}finally{sending=false;button.disabled=false;form.removeAttribute('aria-busy');enviandoEl?.classList.remove('visivel');}
    });
  }



    initMultiStep("form-parceria", "par", LABELS_PAR, { atuacao: ATUACAO_MAP });
  initMultiStep("form-talentos", "tal", LABELS_TAL, { area: AREA_MAP });

  /* ── Upload de currículo (modal talentos) ─────────────────────────────── */
  (() => {
    const fileInput = document.getElementById("tal-curriculo");
    const uploadArea = document.getElementById("tal-upload-area");
    const uploadInfo = document.getElementById("tal-upload-info");
    const uploadNome = document.getElementById("tal-upload-nome");
    const uploadErro = document.getElementById("tal-upload-erro");
    const btnSub = document.getElementById("tal-btn-substituir");
    const btnRem = document.getElementById("tal-btn-remover");
    if (!fileInput || !uploadArea) return;

    function validarArquivo(file) {
      if (!EXT_VALIDAS.includes(file.type)) {
        if (uploadErro) { uploadErro.textContent = "Formato inválido. Use PDF, DOC ou DOCX."; uploadErro.style.display = "block"; }
        return false;
      }
      if (file.size > MAX_SIZE) {
        if (uploadErro) { uploadErro.textContent = "Arquivo muito grande. Máximo 5 MB."; uploadErro.style.display = "block"; }
        return false;
      }
      if (uploadErro) { uploadErro.textContent = ""; uploadErro.style.display = "none"; }
      return true;
    }

    function mostrar(file) {
      if (file) {
        const mb = (file.size / 1024 / 1024).toFixed(2);
        if (uploadNome) uploadNome.textContent = `${file.name} (${mb} MB)`;
        if (uploadInfo) uploadInfo.classList.add("visivel");
        uploadArea.style.display = "none";
      } else {
        if (uploadInfo) uploadInfo.classList.remove("visivel");
        uploadArea.style.display = "";
      }
    }

    function limpar() {
      arquivoCurriculo = null;
      fileInput.value = "";
      mostrar(null);
    }

    fileInput.addEventListener("change", () => {
      const f = fileInput.files[0];
      if (f && validarArquivo(f)) { arquivoCurriculo = f; mostrar(f); }
      else if (f) { fileInput.value = ""; if (arquivoCurriculo) mostrar(arquivoCurriculo); }
    });

    uploadArea.addEventListener("dragover", (e) => { e.preventDefault(); uploadArea.classList.add("arrastando"); });
    uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("arrastando"));
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("arrastando");
      const f = e.dataTransfer.files[0];
      if (f && validarArquivo(f)) { arquivoCurriculo = f; mostrar(f); }
    });
    uploadArea.addEventListener("click", (event) => {if(event.target===fileInput||event.target.closest('label[for="tal-curriculo"]'))return;fileInput.click();});
    uploadArea.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
    if (btnSub) btnSub.addEventListener("click", () => fileInput.click());
    if (btnRem) btnRem.addEventListener("click", limpar);
  })();

  })();