/* Regras compartilhadas pelo simulador, painel e recebimento. Valores em centavos. */
export const SYSTEMS = ['on-grid','hybrid','bess'];
export const SEGMENTS = ['residencial','empresarial','agronegocio'];
export function decimal(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;
  let text=value.trim().replace(/^R\$\s*/,'');
  if (text.includes(',')) text=text.replace(/\./g,'').replace(',','.');
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : NaN;
}
export function money(value) { return Number.isInteger(value) ? (value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : 'Sob consulta'; }
export function power(kit) { return kit.modules.quantity*kit.modules.watts/1000; }
function validDate(value) { return value===null || value==='' || (typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value); }
export function validateKit(kit) {
  if(!kit || typeof kit!=='object')return ['Kit inválido.'];
  const errors=[];
  const required=(ok,message)=>{if(!ok)errors.push(message)};
  required(typeof kit.id==='string' && /^[a-zA-Z0-9_-]{2,80}$/.test(kit.id),'Informe um código de kit válido.');
  required(typeof kit.name==='string' && kit.name.trim().length>=3 && kit.name.length<=140,'Informe o nome do kit.');
  required(SYSTEMS.includes(kit.system),'Tipo de sistema inválido.');
  required(Array.isArray(kit.segments) && kit.segments.length>0 && kit.segments.every(s=>SEGMENTS.includes(s)),'Escolha os segmentos atendidos.');
  required(Array.isArray(kit.regions) && kit.regions.length>0 && kit.regions.every(s=>typeof s==='string'&&s.length>0&&s.length<=100),'Informe a região atendida.');
  required(Number.isFinite(kit.generationKwhMonth) && kit.generationKwhMonth>0,'Informe a geração mensal estimada em kWh.');
  required(Number.isInteger(kit.modules?.quantity) && kit.modules.quantity>0,'Quantidade de módulos inválida.');
  required(Number.isFinite(kit.modules?.watts) && kit.modules.watts>0,'Potência do módulo inválida.');
  required(['brand','model'].every(k=>typeof kit.modules?.[k]==='string'&&kit.modules[k].trim().length>0),'Informe marca e modelo dos módulos.');
  required(Number.isInteger(kit.inverter?.quantity) && kit.inverter.quantity>0,'Quantidade de inversores inválida.');
  required(['brand','model'].every(k=>typeof kit.inverter?.[k]==='string'&&kit.inverter[k].trim().length>0),'Informe marca e modelo do inversor.');
  required(kit.installedPriceMinor===null || (Number.isSafeInteger(kit.installedPriceMinor)&&kit.installedPriceMinor>0),'Preço instalado inválido.');
  required(Number.isSafeInteger(kit.discountMinor) && kit.discountMinor>=0 && (kit.installedPriceMinor===null ? kit.discountMinor===0 : kit.discountMinor<kit.installedPriceMinor),'Desconto inválido.');
  required(typeof kit.active==='boolean' && typeof kit.available==='boolean' && typeof kit.commercialApproved==='boolean','Situação do kit inválida.');
  for(const key of ['validFrom','validUntil']) required(validDate(kit[key]),'Data de validade inválida.');
  required(!kit.validFrom || !kit.validUntil || kit.validFrom<=kit.validUntil,'A validade final deve ser posterior ao início.');
  if(kit.finance) {
    required(Number.isInteger(kit.finance.months)&&kit.finance.months>0&&kit.finance.months<=120,'Número de parcelas inválido.');
    required(Number.isSafeInteger(kit.finance.installmentMinor)&&kit.finance.installmentMinor>0,'Informe a parcela real aprovada.');
    required(Number.isSafeInteger(kit.finance.downPaymentMinor)&&kit.finance.downPaymentMinor>=0,'Entrada inválida.');
    required(Number.isInteger(kit.finance.graceDays)&&kit.finance.graceDays>=0,'Carência inválida.');
    required(typeof kit.finance.description==='string'&&kit.finance.description.trim().length>0,'Descreva as condições do financiamento.');
  }
  return errors;
}
export function validateCatalog(catalog) {
  const errors=[];
  if(catalog?.schemaVersion!==1)errors.push('Versão do catálogo inválida.');
  if(!Array.isArray(catalog?.kits))return [...errors,'Lista de kits ausente.'];
  const ids=new Set();
  catalog.kits.forEach((kit,i)=>{if(kit && ids.has(kit.id))errors.push('Código duplicado: '+kit.id);if(kit)ids.add(kit.id);errors.push(...validateKit(kit).map(e=>'Kit '+(i+1)+': '+e));});
  if(catalog.tariff && (!(decimal(catalog.tariff.value)>0)||catalog.tariff.unit!=='BRL/kWh'||typeof catalog.tariff.verified!=='boolean'))errors.push('Parâmetro de tarifa inválido.');
  if(catalog.tariff){if(!validDate(catalog.tariff.validFrom)||!validDate(catalog.tariff.validUntil)||(catalog.tariff.validFrom&&catalog.tariff.validUntil&&catalog.tariff.validFrom>catalog.tariff.validUntil))errors.push('Validade da tarifa inválida.');if(catalog.tariff.verified&&(typeof catalog.tariff.source!=='string'||!catalog.tariff.source.trim()||!catalog.tariff.validFrom||!catalog.tariff.validUntil))errors.push('A tarifa validada precisa de fonte e período de validade.');}
  return errors;
}
export function simulate(input,catalog,{now=new Date()}={}) {
  const errors=validateCatalog(catalog);
  if(errors.length)return {mode:'assisted',reason:'catalog-invalid',message:'Nossa equipe vai preparar uma análise personalizada para seu projeto.'};
  const system=input.system || (input.storageInterest?'hybrid':'on-grid');
  if(system!=='on-grid')return {mode:'assisted',reason:'storage-assessment',message:'Para híbridos e baterias, precisamos avaliar os equipamentos que você quer manter ligados e a autonomia desejada.'};
  const informedKwh=decimal(input.consumptionKwh);
  const bill=decimal(input.monthlyBill);
  let consumption,source;
  if(informedKwh>0&&informedKwh<=10000000){consumption=informedKwh;source='informed-kwh';}
  else {
    const tariff=catalog.tariff;
    const day=now.toISOString().slice(0,10);
    const usable=tariff?.verified===true && decimal(tariff.value)>0 && (!tariff.validFrom||day>=tariff.validFrom) && (!tariff.validUntil||day<=tariff.validUntil);
    if(!usable)return {mode:'assisted',reason:'tariff-unverified',message:'Informe o consumo em kWh da sua conta para uma análise mais precisa. Nossa equipe pode ajudar a avaliar seu projeto.'};
    if(!(bill>0&&bill<=10000000))return {mode:'assisted',reason:'invalid-consumption',message:'Informe o gasto mensal ou o consumo em kWh.'};
    consumption=bill/decimal(tariff.value);source='estimated-from-bill';
  }
  const today=now.toISOString().slice(0,10);
  const region=String(input.state||'TO').toUpperCase();
  const city=String(input.city||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const eligible=catalog.kits.filter(k=>k.active&&k.available&&k.commercialApproved&&k.system===system&&k.segments.includes(input.segment)&&
    (!k.validFrom||today>=k.validFrom)&&(!k.validUntil||today<=k.validUntil)&&
    k.regions.some(r=>r.toUpperCase()===region || r.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===city)&&k.generationKwhMonth>=consumption);
  eligible.sort((a,b)=>a.generationKwhMonth-b.generationKwhMonth || (a.installedPriceMinor??Infinity)-(b.installedPriceMinor??Infinity));
  if(!eligible.length)return {mode:'assisted',reason:'no-compatible-kit',consumptionKwh:consumption,source,message:'Seu consumo precisa de uma proposta personalizada. Fale com a NORTINS para dimensionarmos o sistema adequado.'};
  const kit=eligible[0];
  if(!kit.installedPriceMinor)return {mode:'assisted',reason:'price-unavailable',consumptionKwh:consumption,source,message:'Identificamos uma opção técnica inicial. Nossa equipe vai confirmar o preço e as condições do projeto.'};
  return {mode:'estimate',consumptionKwh:consumption,source,kit:structuredClone(kit),catalogVersion:catalog.version||null,priceMinor:kit.installedPriceMinor-kit.discountMinor,powerKwp:power(kit)};
}

export const CSV_FIELDS=['id','name','system','segments','regions','generationKwhMonth','moduleQuantity','moduleWatts','moduleBrand','moduleModel','inverterQuantity','inverterBrand','inverterModel','installedPriceBRL','discountBRL','active','available','commercialApproved','validFrom','validUntil','financeMonths','installmentBRL','downPaymentBRL','graceDays','financeDescription'];
export function parseCsv(text) {
  const input=String(text).replace(/^\uFEFF/,'');
  const first=input.split(/\r?\n/)[0]||'';
  const separator=first.includes(';')?';':',';
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<input.length;i++) {
    const c=input[i];
    if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===separator&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(s=>s.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('O CSV possui aspas sem fechamento.');
  row.push(cell);if(row.some(s=>s.trim()))rows.push(row);
  const headers=(rows.shift()||[]).map(s=>s.trim());
  if(!headers.includes('id')||!headers.includes('name'))throw new Error('O CSV precisa dos cabeçalhos id e name.');
  return rows.map((cells,i)=>{if(cells.length!==headers.length)throw new Error('Colunas inconsistentes na linha '+(i+2));return Object.fromEntries(headers.map((h,j)=>[h,cells[j].trim()]));});
}
export function kitFromFlat(row) {
  const number=key=>decimal(row[key]);
  const cents=key=>Math.round(number(key)*100);
  const bool=key=>['true','1','sim'].includes(String(row[key]).toLowerCase());
  return {id:String(row.id||'').trim(),name:String(row.name||'').trim(),system:row.system||'on-grid',segments:String(row.segments||'').split('|').filter(Boolean),regions:String(row.regions||'TO').split('|').filter(Boolean),generationKwhMonth:number('generationKwhMonth'),modules:{quantity:number('moduleQuantity'),watts:number('moduleWatts'),brand:row.moduleBrand||'',model:row.moduleModel||''},inverter:{quantity:number('inverterQuantity'),brand:row.inverterBrand||'',model:row.inverterModel||''},installedPriceMinor:row.installedPriceBRL?cents('installedPriceBRL'):null,discountMinor:row.discountBRL?cents('discountBRL'):0,active:bool('active'),available:bool('available'),commercialApproved:bool('commercialApproved'),validFrom:row.validFrom||null,validUntil:row.validUntil||null,finance:row.financeMonths?{months:number('financeMonths'),installmentMinor:cents('installmentBRL'),downPaymentMinor:row.downPaymentBRL?cents('downPaymentBRL'):0,graceDays:row.graceDays?number('graceDays'):0,description:row.financeDescription||''}:null};
}
