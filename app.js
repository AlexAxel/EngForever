const $=id=>document.getElementById(id);
const KEY="eng-forever-v1";
// Keep the v1 storage key: existing browser progress survives the UI redesign.
const TYPES=[{id:"translate",label:"Перевод"}];
let phrases=[],state,queue=[],current=null,revealed=false,started=false,round=1,busy=false,toastTimer;
const blank=()=>({version:1,language:"ru",mode:"auto",cards:{},round:1,started:false,queue:[],current:null});
const cardState=id=>{const key=String(id);return state.cards[key]??(state.cards[key]={enabled:true,manuallyDisabled:false,learned:false,attempts:0,correct:0,hardness:0,history:[]});};
const save=()=>{state.round=round;state.started=started;state.queue=queue;state.current=current?.id??null;try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){$("footer-status").textContent="Не удалось сохранить прогресс. Проверь настройки браузера.";}};
function load(){try{const raw=JSON.parse(localStorage.getItem(KEY)||"null");state=raw&&raw.version===1&&raw.cards&&typeof raw.cards==="object"?raw:blank();}catch{state=blank();}
state.language=state.language==="eng"?"eng":"ru";state.mode=state.mode==="manual"?"manual":"auto";
for(const p of phrases){const c=cardState(p.id);c.enabled=c.enabled!==false;c.manuallyDisabled=!!c.manuallyDisabled;c.learned=!!c.learned;c.attempts=Math.max(0,Number(c.attempts)||0);c.correct=Math.min(c.attempts,Math.max(0,Number(c.correct)||0));c.hardness=Math.min(100,Math.max(0,Number(c.hardness)||0));if(!Array.isArray(c.history))c.history=[];}
round=Math.max(1,Number(state.round)||1);started=!!state.started;queue=Array.isArray(state.queue)?state.queue.filter(id=>phrases.some(p=>p.id===id)&&cardState(id).enabled):[];current=phrases.find(p=>p.id===state.current&&cardState(p.id).enabled)||null;queue=queue.filter(id=>id!==current?.id);}
const shuffle=arr=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const allActive=()=>phrases.filter(p=>cardState(p.id).enabled);
function freshQueue(){queue=shuffle(allActive().filter(p=>p.id!==current?.id).map(p=>p.id));}
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
function showEmpty(title,copy,button){$("card").classList.add("hidden");$("empty").classList.remove("hidden");$("empty-title").textContent=title;$("empty-copy").textContent=copy;$("start").textContent=button;$("actions").classList.add("hidden");}
function showCard(){if(!current)return;revealed=false;busy=false;const card=$("card");card.className="card";card.style.transform="";card.style.opacity="";$("empty").classList.add("hidden");card.classList.remove("hidden");$("actions").classList.remove("hidden");$("card-id").textContent="№ "+current.id;$("card-type").textContent="ПЕРЕВОД";$("question-label").textContent=state.language==="ru"?"ПЕРЕВЕДИ НА АНГЛИЙСКИЙ":"ПЕРЕВЕДИ НА РУССКИЙ";$("question-text").textContent=current[state.language];$("answer-text").textContent=current[state.language==="ru"?"eng":"ru"];$("answer-label").textContent=state.language==="ru"?"АНГЛИЙСКИЙ":"РУССКИЙ";$("answer-sheet").classList.remove("open");$("answer-sheet").setAttribute("aria-expanded","false");$("sheet-hint").textContent="Потяни вниз или нажми, чтобы увидеть перевод";$("sheet-chevron").textContent="⌄";$("wrong").disabled=true;$("right").disabled=true;$("action-hint").textContent="Сначала открой правильный перевод";}
function updateStatus(){const active=allActive();const learned=phrases.filter(p=>cardState(p.id).learned).length;const hard=phrases.filter(p=>cardState(p.id).hardness>=15).length;$("round-label").textContent="Круг "+round;$("progress-label").textContent=learned+" / "+phrases.length+" изучено";$("progress-bar").style.width=(phrases.length?learned/phrases.length*100:0)+"%";$("active-count").textContent="Активных: "+active.length;$("difficult-count").textContent="Сложных: "+hard;}
function next(){if(busy)return;const valid=new Set(allActive().map(p=>p.id));queue=queue.filter(id=>valid.has(id)&&id!==current?.id);if(queue.length){const selectedId=queue.shift();current=phrases.find(p=>p.id===selectedId);showCard();updateStatus();save();return;}
current=null;const active=allActive();if(active.length){freshQueue();if(queue.length){const selectedId=queue.shift();current=phrases.find(p=>p.id===selectedId);showCard();updateStatus();save();return;}}
const difficult=phrases.filter(p=>{const c=cardState(p.id);return c.learned&&!c.manuallyDisabled&&c.hardness>=15;});if(difficult.length&&started){round++;for(const p of difficult){const c=cardState(p.id);c.enabled=true;c.learned=false;}queue=shuffle(difficult.map(p=>p.id));const selectedId=queue.shift();current=phrases.find(p=>p.id===selectedId);showCard();toast("Новый круг: "+difficult.length+" сложных фраз");updateStatus();save();return;}
updateStatus();save();if(!started)showEmpty("Готов к тренировке?","Открой карточку, вспомни перевод и проверь себя перед свайпом.","Начать тренировку →");else if(!active.length)showEmpty("Всё изучено!","Сложных фраз для повторения пока нет. В настройках можно снова включить нужные карточки.","Открыть настройки");else showEmpty("Пока нет карточек","Включи хотя бы одну фразу в настройках.","Открыть настройки");}
function start(){if(!allActive().length){$("settings-dialog").showModal();return;}started=true;round=Math.max(1,round);freshQueue();next();}
function reveal(){if(!current||revealed)return;revealed=true;$("card").classList.add("revealed");$("answer-sheet").classList.add("open");$("answer-sheet").setAttribute("aria-expanded","true");$("sheet-hint").textContent="Проверь себя";$("sheet-chevron").textContent="✓";$("wrong").disabled=false;$("right").disabled=false;$("action-hint").textContent="Свайп влево — ошибка, вправо — вспомнил";}
function answer(success){if(!current||!revealed||busy)return;busy=true;const p=current,c=cardState(p.id);c.attempts++;if(success)c.correct++;c.hardness=success?Math.max(0,c.hardness*.75-12):Math.min(100,c.hardness*.85+45);c.history=[...(c.history||[]),{ok:success,at:new Date().toISOString()}].slice(-50);c.learned=success;c.enabled=!success;c.manuallyDisabled=false;current=null;if(!success)queue.push(p.id);const card=$("card");card.classList.add("fly");card.style.transform="translateX("+(success?Math.max(innerWidth,420):-Math.max(innerWidth,420))+"px) rotate("+(success?15:-15)+"deg)";updateStatus();save();setTimeout(()=>{busy=false;next();},230);}
function handleLanguage(){state.language=document.querySelector('input[name="language"]:checked')?.value==="eng"?"eng":"ru";if(current)showCard();save();}
function syncSettings(){document.querySelectorAll('input[name="language"]').forEach(el=>el.checked=el.value===state.language);$("mode").value=state.mode;$("phrase-list").replaceChildren();for(const p of phrases){const label=document.createElement("label");label.className="phrase-option";const check=document.createElement("input");check.type="checkbox";check.checked=cardState(p.id).enabled;check.addEventListener("change",()=>togglePhrase(p.id,check.checked));const span=document.createElement("span");span.textContent="#"+p.id+" · "+p.ru;const sm=document.createElement("small");sm.textContent=p.eng;span.append(sm);label.append(check,span);$("phrase-list").append(label);}updateSelected();}
function updateSelected(){$("selected-count").textContent=allActive().length+"/"+phrases.length;}
function togglePhrase(id,on){const c=cardState(id);c.enabled=on;c.manuallyDisabled=!on;c.learned=on?false:c.learned;if(!on){queue=queue.filter(q=>q!==id);if(current?.id===id)current=null;}else if(started&&current?.id!==id&&!queue.includes(id))queue.push(id);updateSelected();updateStatus();if(started&&!current)next();else if(current)showCard();save();}
function toggleAll(on){for(const p of phrases){const c=cardState(p.id);c.enabled=on;c.manuallyDisabled=!on;if(on)c.learned=false;}queue=[];current=null;if(started&&on)freshQueue();syncSettings();updateStatus();if(started)next();else showEmpty("Готов к тренировке?","Включи карточки и начни тренировку.","Начать тренировку →");save();}
function openSettings(){syncSettings();$("settings-dialog").showModal();}
function showStats(){const attempt=phrases.reduce((sum,p)=>sum+cardState(p.id).attempts,0),correct=phrases.reduce((sum,p)=>sum+cardState(p.id).correct,0),hard=phrases.filter(p=>cardState(p.id).hardness>=15).length;$("stats-summary").replaceChildren();for(const [num,title] of [[String(attempt),"Ответов"],[attempt?Math.round(100*correct/attempt)+"%":"—","Узнаваемость"],[String(hard),"Сложных"]]){const el=document.createElement("div");el.className="stat";const n=document.createElement("strong");n.textContent=num;const t=document.createElement("span");t.textContent=title;el.append(n,t);$("stats-summary").append(el);}$("stats-list").replaceChildren();for(const p of phrases){const c=cardState(p.id),row=document.createElement("div");row.className="stat-row";const top=document.createElement("div");top.className="stat-row-top";const title=document.createElement("span");title.textContent="#"+p.id+" · "+p.ru;const count=document.createElement("span");count.textContent=c.attempts?Math.round(100*c.correct/c.attempts)+"%":"—";top.append(title,count);const sub=document.createElement("small");sub.textContent=c.attempts+" ответов · "+(c.attempts-c.correct)+" ошибок · сложность "+Math.round(c.hardness)+"/100"+(c.enabled?" · активна":"");const bar=document.createElement("div");bar.className="mini-track";const fill=document.createElement("div");fill.style.width=c.hardness+"%";bar.append(fill);row.append(top,sub,bar);$("stats-list").append(row);}$("stats-dialog").showModal();}
// Isolate the vertical reveal gesture on a dedicated handle. The rest of the
// revealed card only handles horizontal swipes; native vertical page scroll is preserved.
function installGestures(){
  const card=$("card"),handle=$("sheet-handle");
  let drag=null,curtain=null;
  card.addEventListener("pointerdown",e=>{
    if(e.target.closest("#sheet-handle")||!current||!revealed||busy||e.button!==0)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0};
    card.setPointerCapture(e.pointerId);
    card.classList.add("dragging");
  });
  card.addEventListener("pointermove",e=>{
    if(!drag||e.pointerId!==drag.id)return;
    drag.dx=e.clientX-drag.x;drag.dy=e.clientY-drag.y;
    if(Math.abs(drag.dx)>Math.abs(drag.dy)*1.15){
      card.style.transform="translate3d("+drag.dx+"px,0,0) rotate("+(drag.dx/28)+"deg)";
      card.classList.toggle("swipe-left",drag.dx< -35);
      card.classList.toggle("swipe-right",drag.dx>35);
    }
  });
  function finishSwipe(e){
    if(!drag||e.pointerId!==drag.id)return;
    const last=drag;drag=null;
    card.classList.remove("dragging","swipe-left","swipe-right");
    card.style.transform="";
    if(e.type!=="pointercancel"&&Math.abs(last.dx)>Math.max(55,card.clientWidth*.18)&&Math.abs(last.dx)>Math.abs(last.dy)*1.15){
      answer(last.dx>0);
    }
  }
  card.addEventListener("pointerup",finishSwipe);
  card.addEventListener("pointercancel",finishSwipe);
  card.addEventListener("lostpointercapture",e=>{
    if(drag&&drag.id===e.pointerId){drag=null;card.classList.remove("dragging","swipe-left","swipe-right");card.style.transform="";}
  });
  // Tapping the handle is an intentional accessibility fallback. A downward
  // drag is still the primary gesture; neither gesture can register an answer.
  handle.addEventListener("pointerdown",e=>{
    if(!current||revealed||busy||e.button!==0)return;
    e.stopPropagation();
    curtain={id:e.pointerId,y:e.clientY,x:e.clientX};
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener("pointerup",e=>{
    if(!curtain||curtain.id!==e.pointerId)return;
    const dy=e.clientY-curtain.y,dx=e.clientX-curtain.x;
    curtain=null;e.stopPropagation();
    if(dy>22||(Math.abs(dy)<12&&Math.abs(dx)<12))reveal();
  });
  handle.addEventListener("pointercancel",()=>{curtain=null;});
  handle.addEventListener("click",()=>reveal());
  handle.addEventListener("keydown",e=>{
    if(e.key==="Enter"||e.key===" "){e.preventDefault();reveal();}
  });
}
async function init(){try{const response=await fetch("./data/phrases.json",{cache:"no-cache"});if(!response.ok)throw Error("HTTP "+response.status);const data=await response.json();if(!Array.isArray(data)||!data.length)throw Error("Пустой список");const ids=new Set();for(const p of data){if(!Number.isSafeInteger(p.id)||ids.has(p.id)||typeof p.ru!=="string"||typeof p.eng!=="string"||!p.ru.trim()||!p.eng.trim())throw Error("Проверь id, ru и eng в JSON");ids.add(p.id);}phrases=data;load();updateStatus();if(started){if(current){showCard();save();}else next();}else showEmpty("Готов к тренировке?","40 пар фраз из твоей тетради. Выбери язык и начни.","Начать тренировку →");}catch(err){console.error(err);showEmpty("Не удалось загрузить фразы","Проверь data/phrases.json и открывай сайт через GitHub Pages, а не как локальный файл.","Повторить загрузку");$("start").onclick=()=>location.reload();return;}
$("start").addEventListener("click",()=>{if(started&&!allActive().length){openSettings();return;}start();});$("settings-open").addEventListener("click",openSettings);$("stats-open").addEventListener("click",showStats);$("settings-done").addEventListener("click",()=>$("settings-dialog").close());document.querySelectorAll("[data-close]").forEach(el=>el.addEventListener("click",() => $(el.dataset.close).close()));document.querySelectorAll('input[name="language"]').forEach(el=>el.addEventListener("change",handleLanguage));$("mode").addEventListener("change",e=>{state.mode=e.target.value;save();});$("select-all").addEventListener("click",()=>toggleAll(true));$("select-none").addEventListener("click",()=>toggleAll(false));$("wrong").addEventListener("click",()=>answer(false));$("right").addEventListener("click",()=>answer(true));$("reset-progress").addEventListener("click",()=>{if(!confirm("Удалить всю статистику, ответы и настройки на этом устройстве?"))return;state=blank();round=1;started=false;queue=[];current=null;for(const p of phrases)cardState(p.id);save();syncSettings();updateStatus();showEmpty("Готов к тренировке?","История и настройки очищены.","Начать тренировку →");$("settings-dialog").close();toast("Данные сброшены");});installGestures();}
init();