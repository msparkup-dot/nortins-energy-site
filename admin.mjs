import {validateCatalog,validateKit,kitFromFlat,parseCsv,CSV_FIELDS,money,power} from './catalogo.mjs';
import {api} from './integracoes.mjs';
const $=id=>document.getElementById(id);
let token='',role='',revision=0,editing=null,dirty=false;
let catalog=await fetch('catalogo.json',{cache:'no-store'}).then(r=>r.json());
const config=window.SITE?.integracoes||{};
const ready=!!config.supabaseUrl&&!!config.publicKey&&!!config.apiBase;
const status=message=>{$('admin-status').textContent=message};
const fields=[
 ['id','Código do kit','text'],['name','Nome do kit','text'],['system','Tipo de sistema','system'],['segments','Segmentos atendidos','segments'],['regions','Regiões — TO ou cidades separadas por |','text'],['generationKwhMonth','Geração média — kWh/mês','number'],
 ['moduleQuantity','Quantidade de módulos','number'],['moduleWatts','Potência de cada módulo — Wp','number'],['moduleBrand','Marca dos módulos','text'],['moduleModel','Modelo dos módulos','text'],['inverterQuantity','Quantidade de inversores','number'],['inverterBrand','Marca do inversor','text'],['inverterModel','Modelo do inversor','text'],
 ['installedPriceBRL','Preço instalado — R$','text'],['discountBRL','Desconto em reais — R$','text'],['validFrom','Início da validade','date'],['validUntil','Fim da validade','date'],['financeMonths','Prazo do financiamento — meses','number'],['installmentBRL','Parcela aprovada — R$','text'],['downPaymentBRL','Entrada — R$','text'],['graceDays','Carência — dias','number'],['financeDescription','Condições e observações do financiamento','text'],['active','Kit ativo','checkbox'],['available','Disponível para instalação','checkbox'],['commercialApproved','Dados técnicos e condições comerciais conferidos pela NORTINS','checkbox']
];
for(const [name,label,type] of fields){
 const wrapper=document.createElement('label');wrapper.textContent=label;
 let input;
 if(type==='system'||type==='segments'){
  input=document.createElement('select');if(type==='segments')input.multiple=true;
  const options=type==='system'?[['on-grid','On-grid'],['hybrid','Híbrido'],['bess','Baterias / BESS']]:[['residencial','Residencial'],['empresarial','Empresarial'],['agronegocio','Agronegócio']];
  options.forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;input.appendChild(option)});
 }else{input=document.createElement('input');input.type=type;if(type==='checkbox')wrapper.className='admin-check';if(type==='number'){input.min='0';input.step=name==='generationKwhMonth'?'any':'1';}}
 input.name=name;wrapper.appendChild(input);$('kit-fields').appendChild(wrapper);
}
function noteDirty(){dirty=true;$('catalog-mode').textContent=token?'Há alterações locais. Salve o rascunho antes de publicar.':'Preparação local. Nada é publicado ao editar.';$('catalog-publish').disabled=true;}
function loadTariff(){const t=catalog.tariff||{};$('tariff-value').value=String(t.value||'').replace('.',',');$('tariff-source').value=t.source||'';$('tariff-verified').checked=t.verified===true;$('tariff-from').value=t.validFrom||'';$('tariff-until').value=t.validUntil||'';}
function takeTariff(){const raw=$('tariff-value').value.trim().replace(',','.');catalog.tariff=raw?{value:Number(raw),unit:'BRL/kWh',verified:$('tariff-verified').checked,source:$('tariff-source').value.trim(),validFrom:$('tariff-from').value||null,validUntil:$('tariff-until').value||null}:null;}
function render(){
 $('kit-list').replaceChildren();$('catalog-empty').hidden=catalog.kits.length>0;
 catalog.kits.forEach(kit=>{const tr=document.createElement('tr');for(const text of [kit.name+' ('+kit.id+')',power(kit).toLocaleString('pt-BR')+' kWp / '+kit.generationKwhMonth+' kWh',money(kit.installedPriceMinor===null?null:kit.installedPriceMinor-kit.discountMinor),kit.active&&kit.available&&kit.commercialApproved?'Apto para publicação':'Rascunho / indisponível']){const td=document.createElement('td');td.textContent=text;tr.appendChild(td)}const action=document.createElement('td');const button=document.createElement('button');button.type='button';button.className='botao botao--secundario';button.textContent='Editar';button.addEventListener('click',()=>editKit(kit));action.appendChild(button);tr.appendChild(action);$('kit-list').appendChild(tr)});
}
function flat(kit){return {id:kit.id,name:kit.name,system:kit.system,segments:kit.segments.join('|'),regions:kit.regions.join('|'),generationKwhMonth:kit.generationKwhMonth,moduleQuantity:kit.modules.quantity,moduleWatts:kit.modules.watts,moduleBrand:kit.modules.brand,moduleModel:kit.modules.model,inverterQuantity:kit.inverter.quantity,inverterBrand:kit.inverter.brand,inverterModel:kit.inverter.model,installedPriceBRL:kit.installedPriceMinor===null?'':kit.installedPriceMinor/100,discountBRL:kit.discountMinor/100,active:kit.active,available:kit.available,commercialApproved:kit.commercialApproved,validFrom:kit.validFrom||'',validUntil:kit.validUntil||'',financeMonths:kit.finance?.months||'',installmentBRL:kit.finance?kit.finance.installmentMinor/100:'',downPaymentBRL:kit.finance?kit.finance.downPaymentMinor/100:'',graceDays:kit.finance?.graceDays||'',financeDescription:kit.finance?.description||''};}
function editKit(kit){
 editing=kit?.id||null;$('kit-form').reset();$('kit-errors').textContent='';
 const values=kit?flat(kit):{system:'on-grid',regions:'TO',segments:'residencial',available:true,moduleQuantity:'',inverterQuantity:1,discountBRL:0};
 for(const [name,,type] of fields){const input=$('kit-form').elements.namedItem(name);const value=values[name];if(type==='checkbox')input.checked=value===true;else if(type==='segments')Array.from(input.options).forEach(o=>o.selected=String(value||'').split('|').includes(o.value));else input.value=value??'';}
 $('kit-form').elements.namedItem('id').readOnly=!!editing;$('kit-editor').hidden=false;$('kit-form').elements.namedItem('name').focus();
}
function validateCurrent(){takeTariff();const errors=validateCatalog(catalog);if(errors.length)throw new Error(errors.slice(0,8).join(' '));}
function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function jsonApi(path,payload){return api(path,{token,method:'POST',body:JSON.stringify(payload),headers:{'Content-Type':'application/json'}});}
function workspace(local){
 $('admin-access').hidden=true;$('admin-workspace').hidden=false;
 document.querySelector('[data-view="catalog"]').hidden=!local&&role!=='admin';
 $('admin-submissions-tab').hidden=local;
 $('catalog-view').hidden=!local&&role!=='admin';$('submissions-view').hidden=local||role==='admin';
 $('catalog-save').disabled=local||role!=='admin';$('catalog-publish').disabled=local||role!=='admin'||dirty||!revision;
 Array.from($('submission-kind').options).forEach(o=>o.disabled=(role==='hr'&&o.value!=='talent')||(role==='commercial'&&o.value==='talent'));
 $('submission-kind').value=role==='hr'?'talent':'quote';loadTariff();render();
}
$('admin-connection').textContent=ready?'Entre com uma conta autorizada da NORTINS.':'A conexão com o Supabase ainda não foi ativada. É possível preparar o catálogo localmente.';
$('admin-login').querySelector('button').disabled=!ready;
$('admin-local').addEventListener('click',()=>{role='local';workspace(true);status('Modo local: prepare e exporte o catálogo para revisão. Nenhum preço é publicado automaticamente.');});
$('admin-login').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.submitter;button.disabled=true;status('Conferindo acesso…');
 try{
  const fd=new FormData(event.currentTarget);const response=await fetch(config.supabaseUrl.replace(/\/$/,'')+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.publicKey,'Content-Type':'application/json'},body:JSON.stringify({email:fd.get('email'),password:fd.get('password')})});
  if(!response.ok)throw new Error('Não foi possível entrar. Confira seus dados e o acesso autorizado.');const session=await response.json();token=session.access_token;
  const me=await api('/admin/me',{token});role=me.role;if(role==='admin'){const result=await api('/admin/catalog',{token});if(result.draft){catalog=result.draft.payload;revision=result.draft.revision;dirty=false;}}
  $('admin-login').reset();workspace(false);status('Acesso autorizado. Alterações só entram no site após publicar.');
 }catch(error){token='';status(error.message)}finally{button.disabled=!ready;}
});
$('admin-logout').addEventListener('click',async()=>{const old=token;token='';role='';revision=0;dirty=false;$('submission-list').replaceChildren();$('admin-workspace').hidden=true;$('admin-access').hidden=false;if(old)fetch(config.supabaseUrl+'/auth/v1/logout',{method:'POST',headers:{apikey:config.publicKey,Authorization:'Bearer '+old}}).catch(()=>{});catalog=await fetch('catalogo.json',{cache:'no-store'}).then(r=>r.json());status('Sessão encerrada.');});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{const showCatalog=button.dataset.view==='catalog';$('catalog-view').hidden=!showCatalog;$('submissions-view').hidden=showCatalog;}));
['tariff-value','tariff-source','tariff-verified','tariff-from','tariff-until'].forEach(id=>$(id).addEventListener('change',noteDirty));
$('kit-new').addEventListener('click',()=>editKit(null));$('kit-cancel').addEventListener('click',()=>{$('kit-editor').hidden=true;});
$('kit-form').addEventListener('submit',event=>{
 event.preventDefault();const fd=new FormData(event.currentTarget);const values=Object.fromEntries(fd);values.segments=Array.from(event.currentTarget.elements.namedItem('segments').selectedOptions).map(o=>o.value).join('|');for(const [name,,type]of fields)if(type==='checkbox')values[name]=event.currentTarget.elements.namedItem(name).checked?'true':'false';
 const kit=kitFromFlat(values);const errors=validateKit(kit);if(!editing&&catalog.kits.some(k=>k.id===kit.id))errors.push('Já existe um kit com esse código.');if(errors.length){$('kit-errors').textContent=errors.join(' ');return;}
 const i=catalog.kits.findIndex(k=>k.id===editing);if(i>=0)catalog.kits[i]=kit;else catalog.kits.push(kit);$('kit-editor').hidden=true;noteDirty();render();status('Kit guardado no rascunho local.');
});
$('catalog-template').addEventListener('click',()=>download('modelo-kits-nortins.csv','\uFEFF'+CSV_FIELDS.join(';')+'\r\n','text/csv;charset=utf-8'));
$('catalog-export').addEventListener('click',()=>{try{validateCurrent();download('catalogo-rascunho-nortins.json',JSON.stringify({...catalog,version:'rascunho-'+new Date().toISOString(),publishedAt:null},null,2),'application/json');status('Arquivo exportado. Revise os dados antes de publicar.');}catch(error){status(error.message)}});
$('catalog-import').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error('A tabela deve ter até 2 MB.');const text=await file.text();const imported=file.name.toLowerCase().endsWith('.csv')?{...catalog,kits:parseCsv(text).map(kitFromFlat)}:JSON.parse(text);const errors=validateCatalog(imported);if(errors.length)throw new Error(errors.slice(0,8).join(' '));catalog=imported;loadTariff();noteDirty();render();status(catalog.kits.length+' kits importados no rascunho. Nada foi publicado.');}catch(error){status(error.message)}finally{event.target.value='';}});
$('catalog-save').addEventListener('click',async()=>{try{validateCurrent();const result=await jsonApi('/admin/catalog/save',{catalog,revision});revision=result.revision;dirty=false;$('catalog-publish').disabled=false;$('catalog-mode').textContent='Rascunho salvo na nuvem. Ainda não publicado.';status('Rascunho salvo. Confira antes de publicar.');}catch(error){status(error.message)}});
$('catalog-publish').addEventListener('click',async()=>{try{if(dirty)throw new Error('Salve o rascunho antes de publicar.');const result=await jsonApi('/admin/catalog/publish',{revision});status('Catálogo publicado. Versão '+result.version+'. Simulações anteriores mantêm suas condições registradas.');}catch(error){status(error.message)}});
$('submission-load').addEventListener('click',async()=>{try{const result=await api('/admin/submissions?kind='+$('submission-kind').value,{token});$('submission-list').replaceChildren();if(!result.items.length){$('submission-list').textContent='Nenhum cadastro recebido nesta categoria.';return;}for(const item of result.items){const article=document.createElement('article');article.className='admin-submission';const title=document.createElement('h3');title.textContent=item.data.nome||'Cadastro';article.appendChild(title);const dl=document.createElement('dl');for(const [key,value]of Object.entries({referencia:item.id,recebidoEm:new Date(item.created_at).toLocaleString('pt-BR'),...item.data})){const dt=document.createElement('dt');dt.textContent=key;const dd=document.createElement('dd');dd.textContent=typeof value==='object'?JSON.stringify(value,null,2):String(value);dl.append(dt,dd);}article.appendChild(dl);if(item.kind==='talent'){const button=document.createElement('button');button.type='button';button.className='botao botao--secundario';button.textContent='Abrir currículo, se anexado';button.addEventListener('click',async()=>{try{const file=await jsonApi('/admin/resume',{id:item.id});const parsed=new URL(file.url);if(parsed.origin!==new URL(config.supabaseUrl).origin)throw new Error('Endereço de arquivo inválido.');window.open(file.url,'_blank','noopener,noreferrer');}catch(error){status(error.message)}});article.appendChild(button);}$('submission-list').appendChild(article);}status('Cadastros atualizados.');}catch(error){status(error.message)}});
