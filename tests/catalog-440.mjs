import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const base="http://127.0.0.1:8000/";
const key="eng-forever-v1";
const snap=()=>JSON.parse(localStorage.getItem("eng-forever-v1"));
try{
  const fresh=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
  const p=await fresh.newPage();
  await p.goto(base);
  await p.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 440"));
  const catalog=await p.evaluate(async()=>await (await fetch("./data/phrases.json")).json());
  assert.equal(catalog.length,440);
  assert.deepEqual(
    [catalog[360].id,catalog[360].ru,catalog[360].eng,catalog[360].level],
    [361,"Кто знает это? Что вдохновляет тебя?","Who knows it? What inspires you?","A1"]
  );
  assert.deepEqual(
    [catalog[397].id,catalog[397].ru,catalog[397].eng,catalog[397].level],
    [398,"Это создавало новые проблемы. (трудности)","It created new problems. (difficulties)","A1"]
  );
  assert.deepEqual(
    [catalog[400].id,catalog[400].ru,catalog[400].eng,catalog[400].level],
    [401,"Я всё вспомнил. Я подождал его одну минуту. (немного)","I remembered everything. I waited for him a bit. (a little)","A1"]
  );
  assert.deepEqual(
    [catalog[439].id,catalog[439].ru,catalog[439].eng,catalog[439].level],
    [440,"Я говорил по-английски, когда у меня была возможность.","I spoke English when I had an opportunity.","A1"]
  );
  assert.equal(catalog.find(x=>x.id===397).ru,"Я перестал тратить своё время в пустую.");
  assert.ok(catalog.slice(360).every(x=>x.level==="A1"));
  await fresh.close();

  // Existing 360-card training must not silently absorb newly appended 361–440.
  const ctx=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  await page.addInitScript(storageKey=>{
    if(sessionStorage.getItem("grow-440-seeded"))return;
    const ids=Array.from({length:360},(_,i)=>i+1),cards={};
    for(const id of ids)cards[id]={enabled:true,manuallyDisabled:false,learned:false,attempts:0,correct:0,hardness:0,history:[]};
    cards[17]={enabled:true,manuallyDisabled:false,learned:false,attempts:5,correct:2,hardness:68,history:[{ok:false},{ok:true}]};
    localStorage.setItem(storageKey,JSON.stringify({
      version:1,language:"ru",mode:"auto",cards,catalogIds:ids,sessionIds:ids,
      round:1,started:true,roundIds:ids,roundSeen:Array.from({length:16},(_,i)=>i+1),
      roundErrors:[17],bonusDue:[],currentBonus:false,queue:ids.slice(17),current:17
    }));
    sessionStorage.setItem("grow-440-seeded","1");
  },key);
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 360"));
  let state=await page.evaluate(snap);
  assert.equal(state.started,true);
  assert.equal(state.current,17);
  assert.equal(state.roundIds.length,360);
  assert.equal(state.cards[17].hardness,68);
  assert.equal(state.cards[17].history.length,2);
  for(let id=361;id<=440;id++){
    assert.equal(state.cards[id].enabled,false,"New #"+id+" must stay disabled during existing 360-card training");
    assert.equal(state.cards[id].manuallyDisabled,true);
    assert.ok(!state.roundIds.includes(id));
    assert.ok(!state.queue.includes(id));
  }
  await page.locator("#settings-open").click();
  assert.equal(await page.locator("#phrase-list .phrase-option").count(),440);
  assert.equal(await page.locator("#level-count-A0").textContent(),"280");
  assert.equal(await page.locator("#level-count-A1").textContent(),"160");
  for(let id=361;id<=440;id++)assert.equal(await page.locator('#phrase-list .phrase-option[data-id="'+id+'"] input').isChecked(),false);
  await page.locator("#settings-done").click();
  await page.reload();
  state=await page.evaluate(snap);
  assert.equal(state.current,17);
  assert.equal(state.cards[440].enabled,false);
  assert.equal(state.cards[17].hardness,68);
  assert.equal(state.cards[17].history.length,2);
  await ctx.close();
  console.log("PASS: A1 notebook 361–440; active 360-card session and historical difficulty survive catalogue growth");
}finally{
  await browser.close();
}
