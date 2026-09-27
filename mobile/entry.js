import {Capacitor} from "@capacitor/core";
import {CapacitorUpdater} from "@capgo/capacitor-updater";

const MANIFEST_URL="https://raw.githubusercontent.com/AlexAxel/EngForever/mobile-updates/mobile/manifest.json";
const REQUIRED_KEY="eng-mobile-required-version";
const NOTICE_KEY="eng-mobile-update-notice";
const CHECK_TIMEOUT=6500;

let resolveMobileReady;
window.__ENG_MOBILE_READY__=new Promise(resolve=>{resolveMobileReady=resolve;});

let localBuild=null;
let startupWarning="";
let overlay=null;
let titleEl=null;
let copyEl=null;
let progressEl=null;
let actionEl=null;

const versionParts=value=>String(value||"0").split(/[.+-]/).slice(0,3).map(v=>Number.parseInt(v,10)||0);
function compareVersions(a,b){
  const aa=versionParts(a),bb=versionParts(b);
  for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]-bb[i];}
  return 0;
}

function ensureOverlay(){
  if(overlay)return;
  const style=document.createElement("style");
  style.textContent=`
    .mobile-update-gate{position:fixed;z-index:2147483647;inset:0;display:grid;place-items:center;padding:24px;background:#121e20;color:#eef5f0;font-family:ui-rounded,"Avenir Next","Segoe UI",system-ui,sans-serif;color-scheme:dark}
    .mobile-update-card{width:min(100%,390px);padding:28px 24px;border:1px solid #365053;border-radius:28px;background:#1b2b2d;box-shadow:0 25px 70px rgba(0,0,0,.24);text-align:center}
    .mobile-update-mark{width:58px;height:58px;margin:0 auto 17px;display:grid;place-items:center;border-radius:19px;background:#294b45;color:#80cfb7;font-size:25px;font-weight:900}
    .mobile-update-card h2{margin:0;font-size:22px;line-height:1.2;letter-spacing:-.5px}
    .mobile-update-card p{margin:10px 0 0;color:#b0c0b9;font-size:13px;line-height:1.5}
    .mobile-update-track{height:6px;margin-top:20px;overflow:hidden;border-radius:99px;background:#365053}
    .mobile-update-progress{height:100%;width:12%;border-radius:99px;background:#80cfb7;transition:width .18s ease}
    .mobile-update-action{display:none;width:100%;min-height:48px;margin-top:18px;border:0;border-radius:15px;background:#eef5f0;color:#162c30;font:800 14px/1 system-ui,sans-serif}
    .mobile-update-action.show{display:block}
    .mobile-version-toast{position:fixed;z-index:2147483646;top:calc(14px + env(safe-area-inset-top));left:50%;width:min(calc(100% - 28px),430px);transform:translate(-50%,-18px);opacity:0;pointer-events:none;padding:12px 15px;border-radius:16px;background:#eef5f0;color:#162c30;box-shadow:0 16px 42px rgba(0,0,0,.24);font:650 12px/1.45 system-ui,sans-serif;transition:opacity .22s,transform .22s}
    .mobile-version-toast.show{opacity:1;transform:translate(-50%,0)}
    .mobile-version-toast strong{display:block;font-size:13px;margin-bottom:2px}
  `;
  document.head.append(style);
  overlay=document.createElement("div");
  overlay.className="mobile-update-gate";
  overlay.innerHTML=`<div class="mobile-update-card"><div class="mobile-update-mark">↻</div><h2></h2><p></p><div class="mobile-update-track"><div class="mobile-update-progress"></div></div><button class="mobile-update-action" type="button"></button></div>`;
  document.body.append(overlay);
  titleEl=overlay.querySelector("h2");
  copyEl=overlay.querySelector("p");
  progressEl=overlay.querySelector(".mobile-update-progress");
  actionEl=overlay.querySelector(".mobile-update-action");
}
function updateOverlay(title,copy,percent=12){
  ensureOverlay();
  titleEl.textContent=title;
  copyEl.textContent=copy;
  progressEl.style.width=Math.max(4,Math.min(100,percent))+"%";
  actionEl.classList.remove("show");
  actionEl.onclick=null;
}
function blockWithAction(title,copy,label,handler){
  updateOverlay(title,copy,100);
  actionEl.textContent=label;
  actionEl.onclick=handler;
  actionEl.classList.add("show");
}
function removeOverlay(){overlay?.remove();overlay=null;}
function showToast(version,notes=""){
  const toast=document.createElement("div");
  toast.className="mobile-version-toast";
  const strong=document.createElement("strong");
  strong.textContent="Eng Forever обновлён до "+version;
  toast.append(strong);
  if(notes){
    const span=document.createElement("span");
    span.textContent=notes;
    toast.append(span);
  }
  document.body.append(toast);
  requestAnimationFrame(()=>toast.classList.add("show"));
  setTimeout(()=>{toast.classList.remove("show");setTimeout(()=>toast.remove(),250);},5200);
}
async function fetchJson(url,timeout=CHECK_TIMEOUT){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetch(url,{cache:"no-store",signal:controller.signal});
    if(!response.ok)throw new Error("HTTP "+response.status);
    return await response.json();
  }finally{clearTimeout(timer);}
}
async function readLocalBuild(){
  return fetchJson("./mobile-build.json",2500);
}
function allowApp(){
  removeOverlay();
  resolveMobileReady();
}
async function applyWebUpdate(manifest){
  localStorage.setItem(REQUIRED_KEY,manifest.version);
  updateOverlay("Обновляем Eng Forever","Новая версия найдена. Сначала завершим обновление, затем откроем тренировку.",8);
  let listener;
  try{
    listener=await CapacitorUpdater.addListener("download",info=>{
      if(Number.isFinite(info?.percent)){
        updateOverlay("Обновляем Eng Forever",`Загрузка новой версии · ${Math.round(info.percent)}%`,info.percent);
      }
    });
    const bundle=await CapacitorUpdater.download({
      version:manifest.version,
      url:manifest.bundleUrl,
      checksum:manifest.checksum||undefined
    });
    await listener?.remove?.();
    updateOverlay("Обновление загружено","Применяем новую версию приложения…",100);
    localStorage.setItem(NOTICE_KEY,JSON.stringify({version:manifest.version,notes:manifest.notes||""}));
    await CapacitorUpdater.set({id:bundle.id});
  }catch(error){
    console.error("Mobile OTA update failed",error);
    try{await listener?.remove?.();}catch{}
    blockWithAction(
      "Не удалось завершить обновление",
      "Эта версия уже отмечена как обязательная. Проверь интернет и повтори попытку.",
      "Повторить",
      ()=>location.reload()
    );
  }
}
async function startNativeGate(){
  ensureOverlay();
  updateOverlay("Проверяем обновления","Подготавливаем актуальную мобильную версию…",12);
  try{localBuild=await readLocalBuild();const builtin=await CapacitorUpdater.getBuiltinVersion();if(typeof builtin==="string"&&builtin)localBuild.nativeVersion=builtin;}
  catch(error){
    console.error("Missing mobile-build.json",error);
    blockWithAction("Ошибка мобильной сборки","Не удалось определить версию приложения.","Перезапустить",()=>location.reload());
    return;
  }

  const required=localStorage.getItem(REQUIRED_KEY);
  if(!navigator.onLine){
    if(required&&compareVersions(required,localBuild.webVersion)>0){
      blockWithAction("Нужно подключение к интернету",`Для запуска требуется обновление до ${required}.`,"Повторить",()=>location.reload());
      return;
    }
    startupWarning="Не удалось проверить обновления: устройство офлайн.";
    allowApp();
    return;
  }

  let manifest;
  try{
    manifest=await fetchJson(MANIFEST_URL+"?t="+Date.now());
  }catch(error){
    console.warn("Update manifest unavailable",error);
    if(required&&compareVersions(required,localBuild.webVersion)>0){
      blockWithAction("Не удалось проверить обязательное обновление","Проверь подключение к интернету и повтори попытку.","Повторить",()=>location.reload());
      return;
    }
    startupWarning="Не удалось проверить обновления. Запущена последняя установленная версия.";
    allowApp();
    return;
  }

  if(manifest.minNativeVersion&&compareVersions(manifest.minNativeVersion,localBuild.nativeVersion)>0){
    const target=manifest.minNativeVersion;
    blockWithAction(
      "Нужна новая версия приложения",
      `Веб-обновление требует Eng Forever ${target} или новее.`,
      manifest.nativeDownloadUrl?"Скачать APK":"Повторить",
      ()=>manifest.nativeDownloadUrl?location.assign(manifest.nativeDownloadUrl):location.reload()
    );
    return;
  }

  if(manifest.version&&manifest.bundleUrl&&compareVersions(manifest.version,localBuild.webVersion)>0){
    await applyWebUpdate(manifest);
    return;
  }

  localStorage.removeItem(REQUIRED_KEY);
  allowApp();
}

window.addEventListener("eng-app-ready",async()=>{
  if(!Capacitor.isNativePlatform())return;
  try{await CapacitorUpdater.notifyAppReady();}catch(error){console.error("notifyAppReady failed",error);}
  try{
    if(!localBuild)localBuild=await readLocalBuild();
    const raw=localStorage.getItem(NOTICE_KEY);
    if(raw){
      const notice=JSON.parse(raw);
      if(notice?.version===localBuild.webVersion){
        localStorage.removeItem(NOTICE_KEY);
        localStorage.removeItem(REQUIRED_KEY);
        showToast(notice.version,notice.notes);
      }
    }else if(startupWarning){
      showToast("текущей версии",startupWarning);
    }
  }catch(error){console.warn("Update notice failed",error);}
},{once:true});

if(Capacitor.isNativePlatform())void startNativeGate();
else resolveMobileReady();
