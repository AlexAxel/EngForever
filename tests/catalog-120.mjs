import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const base="http://127.0.0.1:8000/";
const key="eng-forever-v1";
const state=()=>JSON.parse(localStorage.getItem("eng-forever-v1"));
const errors=[];
try{
  // On a new device, all 120 original notebook IDs appear in the catalogue.
  const fresh=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
  const freshPage=await fresh.newPage();
  freshPage.on("pageerror",e=>errors.push(String(e)));
  await freshPage.goto(base);
  await freshPage.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 120"));
  const initial=await freshPage.evaluate(state);
  assert.equal(initial.catalogIds.length,120,"Catalogue contains 120 phrases");
  assert.deepEqual(initial.catalogIds,Array.from({length:120},(_,i)=>i+1),"All IDs remain numbered 1–120");
  assert.equal(Object.keys(initial.cards).length,120);
  assert.ok(initial.cards[120].enabled,"New installation can train with the current full catalogue");
  await freshPage.locator("#settings-open").click();
  assert.equal(await freshPage.locator("#phrase-list .phrase-option").count(),120);
  assert.deepEqual(await freshPage.locator("#phrase-list .phrase-option").evaluateAll(items=>items.map(el=>parseInt(el.textContent.slice(1),10))),Array.from({length:120},(_,i)=>i+1));
  await fresh.close();

  // Model a real 80-card session that is mid-round when the new JSON arrives.
  const continuing=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
  const page=await continuing.newPage();
  page.on("pageerror",e=>errors.push(String(e)));
  await page.addInitScript(storageKey=>{
    if(sessionStorage.getItem("120-growth-seeded"))return;
    const cards={};
    for(let id=1;id<=80;id++){
      cards[id]={enabled:true,manuallyDisabled:false,learned:false,attempts:0,correct:0,hardness:0,history:[]};
    }
    cards[1]={enabled:true,manuallyDisabled:false,learned:false,attempts:2,correct:1,hardness:52,history:[{ok:false},{ok:true,bonus:true}]};
    const ids=Array.from({length:80},(_,i)=>i+1);
    localStorage.setItem(storageKey,JSON.stringify({
      version:1,language:"ru",mode:"auto",cards,catalogIds:ids,sessionIds:ids,
      round:1,started:true,roundIds:ids,roundSeen:[1,2,3,4],
      roundErrors:[1],bonusDue:[{id:1,due:10}],currentBonus:false,
      queue:ids.slice(5),current:5
    }));
    sessionStorage.setItem("120-growth-seeded","1");
  },key);
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 80"));
  let saved=await page.evaluate(state);
  assert.equal(saved.started,true);
  assert.equal(saved.round,1);
  assert.equal(saved.current,5,"Current old card remains in progress");
  assert.deepEqual(saved.queue,Array.from({length:75},(_,i)=>i+6),"Old queue must not be displaced by new IDs");
  assert.deepEqual(saved.roundSeen,[1,2,3,4]);
  assert.deepEqual(saved.roundErrors,[1]);
  assert.deepEqual(saved.bonusDue,[{id:1,due:10}],"A scheduled off-counter review survives the new JSON");
  assert.equal(saved.roundIds.length,80);
  assert.equal(saved.sessionIds.length,80);
  assert.deepEqual(saved.catalogIds,Array.from({length:120},(_,i)=>i+1));
  for(let id=81;id<=120;id++){
    assert.equal(saved.cards[id].enabled,false,"New phrase #"+id+" must stay unchecked");
    assert.equal(saved.cards[id].manuallyDisabled,true);
    assert.ok(!saved.queue.includes(id));
    assert.ok(!saved.roundIds.includes(id));
  }
  assert.equal(saved.cards[1].hardness,52,"Historical difficulty is unchanged");
  assert.equal(saved.cards[1].history.length,2,"History is unchanged");
  await page.locator("#settings-open").click();
  assert.equal(await page.locator("#phrase-list .phrase-option").count(),120);
  assert.equal(await page.locator("#phrase-list .phrase-option").nth(79).locator("input").isChecked(),true);
  for(let id=81;id<=120;id++)assert.equal(await page.locator("#phrase-list .phrase-option").nth(id-1).locator("input").isChecked(),false);
  await page.locator("#settings-done").click();
  await page.reload();
  await page.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 80"));
  saved=await page.evaluate(state);
  assert.equal(saved.current,5);
  assert.deepEqual(saved.roundSeen,[1,2,3,4]);
  assert.equal(saved.cards[120].enabled,false,"New phrases must remain excluded on subsequent reloads");
  await page.locator("#settings-open").click();
  await page.locator("#phrase-list .phrase-option").nth(80).locator("input").check();
  saved=await page.evaluate(state);
  assert.equal(saved.started,false,"Manually selecting a new phrase resets the training");
  assert.equal(saved.round,1);
  assert.deepEqual(saved.queue,[]);
  assert.equal(saved.cards[81].enabled,true);
  assert.equal(saved.cards[82].enabled,false);
  assert.equal(saved.cards[1].hardness,52);
  assert.equal(saved.cards[1].history.length,2);
  await page.locator("#settings-done").click();
  assert.equal(await page.locator("#start").isVisible(),true);
  await continuing.close();
  assert.deepEqual(errors,[],"No browser runtime exceptions");
  console.log("PASS: all 120 numbered phrases; fresh start includes them; in-progress 80-card round and its bonus, difficulty and history remain intact; new 81–120 excluded until manually selected");
}finally{
  await browser.close();
}
