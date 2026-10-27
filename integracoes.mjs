/* Cliente público. Somente URL, chave publicável e sitekey podem estar em config.js. */
const widgets=new WeakMap();
const attempts=new WeakMap();
let captchaReady;
const settings=()=>window.SITE?.integracoes||{};
export function isConfigured(){return /^https:\/\//.test(settings().apiBase||'') && !!settings().publicKey && !!settings().turnstileSiteKey;}
export async function api(path,{token,method='GET',body,headers={}}={}) {
 const config=settings();
 if(!config.apiBase||!config.publicKey)throw new Error('O recebimento on-line está sendo preparado. Fale com a NORTINS pelo WhatsApp.');
 if(config.publicKey.startsWith('sb_secret_'))throw new Error('Configuração pública inválida.');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch(config.apiBase.replace(/\/$/,'')+path,{method,signal:controller.signal,headers:{apikey:config.publicKey,...(token?{Authorization:'Bearer '+token}:{}),...headers},...(body===undefined?{}:{body})});
  const content=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(content?.message||'Não foi possível enviar agora. Tente novamente.');
  if(!content)throw new Error('O serviço retornou uma resposta inválida. Tente novamente.');
  return content;
 }catch(error){if(error.name==='AbortError')throw new Error('O envio demorou mais que o esperado. Tente novamente; evitaremos duplicar seu cadastro.');throw error;}
 finally{clearTimeout(timer);}
}
async function captchaScript(){
 if(window.turnstile)return;
 if(!captchaReady)captchaReady=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=resolve;script.onerror=()=>{captchaReady=null;script.remove();reject(new Error('Não foi possível carregar a verificação de segurança.'))};document.head.appendChild(script);
 });
 await captchaReady;
}
export async function prepare(form){
 if(!isConfigured()||widgets.has(form))return;
 await captchaScript();
 if(widgets.has(form))return;
 let slot=form.querySelector('[data-antispam]');
 if(!slot){slot=document.createElement('div');slot.dataset.antispam='';slot.className='form-antispam';form.querySelector('.form-step[data-step="3"] .form-acoes')?.before(slot);if(!slot.isConnected)form.querySelector('button[type="submit"]').before(slot);}
 const state={token:'',id:null};widgets.set(form,state);
 state.id=window.turnstile.render(slot,{sitekey:settings().turnstileSiteKey,theme:'dark',action:'nortins_form',callback:token=>{state.token=token},'expired-callback':()=>{state.token=''},'error-callback':()=>{state.token=''}});
}
export async function submit(kind,form,file=null){
 if(!isConfigured())throw new Error('O recebimento on-line está sendo preparado. Fale com a NORTINS pelo WhatsApp.');
 await prepare(form);
 const data=new FormData(form);
 if(file)data.set('curriculo',file);
 else data.delete('curriculo');
 if(kind==='simulate'){
  const city=String(data.get('cidade')||'');const uf=city.match(/(?:-|\/|,|\s)\s*([A-Z]{2})\s*$/i);
  data.set('uf',uf?uf[1].toUpperCase():'TO');
 }
 const identity=[];
 for(const [key,value] of data){if(key==='cf-turnstile-response')continue;identity.push([key,typeof value==='string'?value:value.name+':'+value.size+':'+value.lastModified]);}
 let signature=JSON.stringify(identity);
 if(file)signature+=':'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).join(',');
 let attempt=attempts.get(form);
 if(!attempt||attempt.signature!==signature){attempt={signature,id:crypto.randomUUID()};attempts.set(form,attempt);}
 const widget=widgets.get(form);
 if(!widget?.token)throw new Error('Conclua a verificação de segurança antes de enviar.');
 data.set('cf-turnstile-response',widget.token);
 try{
  const result=await api('/'+kind,{method:'POST',body:data,headers:{'X-Idempotency-Key':attempt.id}});
  if(result.received!==true)throw new Error('O serviço não confirmou o recebimento. Tente novamente.');
  attempts.delete(form);return result;
 }finally{if(widget){widget.token='';window.turnstile.reset(widget.id);}}
}
