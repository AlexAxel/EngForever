import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const origin="http://127.0.0.1:8000/";
const storageKey="eng-forever-v1";
const newCard={id:81,ru:"Новая фраза № 81.",eng:"New phrase number 81."};
const snapshot=()=>JSON.parse(localStorage.getItem("eng-forever-v1"));
const failures=[];
try{
  const context=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  page.on("pageerror",error=>failures.push(String(error)));
  // Model the real 80-card catalogue before a later JSON release adds #81.
  await page.route("**/data/phrases.json*",async route=>{
    const response=await route.fetch();
    await route.fulfill({response,contentType:"application/json",body:JSON.stringify((await response.json()).slice(0,80))});
  });
  await page.goto(origin);
  await page.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 80"));
  await page.locator("#start").click();
  await page.locator("#card:not(.hidden)").waitFor();
  let state=await page.evaluate(snapshot);
  assert.equal(state.started,true);
  assert.equal(state.catalogIds.length,80,"Initial catalogue snapshot must be saved");
  const originalCard=Number((await page.locator("#card-id").textContent()).replace("№ ",""));
  // Introduce a genuine prior mistake and verify that its history persists.
  await page.locator("#sheet-handle").click();
  await page.locator("#wrong").click();
  await page.waitForFunction(old=>document.querySelector("#card-id").textContent!==old,"№ "+originalCard);
  state=await page.evaluate(snapshot);
  const before={attempts:state.cards[originalCard].attempts,correct:state.cards[originalCard].correct,hardness:state.cards[originalCard].hardness,history:state.cards[originalCard].history};
  assert.equal(before.attempts,1);
  assert.ok(before.hardness>=15,"A mistake marks the old phrase difficult");
  const priorCurrent=state.current,priorQueue=state.queue.slice(),priorRound=state.round,priorSession=state.sessionIds.slice();
  // Simulate the next GitHub JSON publication without touching old progress.
  await page.route("**/data/phrases.json*",async route=>{
    const response=await route.fetch();
    const cards=await response.json();
    await route.fulfill({response,contentType:"application/json",body:JSON.stringify([...cards.slice(0,80),newCard])});
  });
  await page.reload();
  await page.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 80"));
  state=await page.evaluate(snapshot);
  assert.equal(state.catalogIds.length,81,"New ID is registered in the catalogue");
  assert.equal(state.started,true,"Adding JSON must not end an unfinished session");
  assert.equal(state.current,priorCurrent,"Current card must be preserved");
  assert.deepEqual(state.queue,priorQueue,"Current shuffled queue must be preserved");
  assert.equal(state.round,priorRound,"Round must not reset");
  assert.deepEqual(state.sessionIds,priorSession,"Current session membership must not change");
  assert.equal(state.cards[81].enabled,false,"New ID must be unchecked");
  assert.equal(state.cards[81].manuallyDisabled,true,"New ID must stay excluded from automatic difficult-card rounds");
  assert.ok(!state.queue.includes(81),"New ID must not enter the unfinished queue");
  assert.deepEqual({attempts:state.cards[originalCard].attempts,correct:state.cards[originalCard].correct,hardness:state.cards[originalCard].hardness,history:state.cards[originalCard].history},before,"Adding JSON must not change historical statistics");
  await page.locator("#settings-open").click();
  assert.equal(await page.locator("#phrase-list .phrase-option").count(),81,"New card visible in settings");
  const checkbox=page.locator("#phrase-list .phrase-option").last().locator("input");
  assert.equal(await checkbox.isChecked(),false,"New card must be unchecked in settings");
  await page.locator("#settings-done").click();
  await page.reload();
  state=await page.evaluate(snapshot);
  assert.equal(state.cards[81].enabled,false,"New card must remain unchecked after a second reload");
  assert.equal(state.current,priorCurrent);
  await page.locator("#settings-open").click();
  await page.locator("#phrase-list .phrase-option").last().locator("input").check();
  state=await page.evaluate(snapshot);
  assert.equal(state.started,false,"Manually choosing a new card starts a new training");
  assert.equal(state.round,1);
  assert.equal(state.current,null);
  assert.deepEqual(state.queue,[]);
  assert.equal(state.cards[81].enabled,true);
  assert.deepEqual({attempts:state.cards[originalCard].attempts,correct:state.cards[originalCard].correct,hardness:state.cards[originalCard].hardness,history:state.cards[originalCard].history},before,"Manual restart keeps historical difficulty and attempts");
  await page.locator("#settings-done").click();
  assert.equal(await page.locator("#start").isVisible(),true);
  await page.locator("#start").click();
  state=await page.evaluate(snapshot);
  assert.equal(state.started,true);
  assert.equal(state.round,1);
  assert.ok([state.current,...state.queue].includes(81),"New ID enters only after explicitly starting the new session");
  await context.close();

  // A fresh installation should select all 81 cards, unlike an unfinished old session.
  const fresh=await browser.newContext();
  const freshPage=await fresh.newPage();
  await freshPage.route("**/data/phrases.json*",async route=>{
    const response=await route.fetch();
    await route.fulfill({response,contentType:"application/json",body:JSON.stringify([...(await response.json()).slice(0,80),newCard])});
  });
  await freshPage.goto(origin);
  await freshPage.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 81"));
  assert.equal((await freshPage.evaluate(snapshot)).cards[81].enabled,true,"Fresh users receive all current cards");
  await fresh.close();

  // Legacy save from the old app (without catalogIds) must still detect a new ID.
  const legacy=await browser.newContext();
  const legacyPage=await legacy.newPage();
  await legacyPage.addInitScript(key=>{
    if(!sessionStorage.getItem("legacy-seeded")){
      const cards={};for(let id=1;id<=80;id++)cards[id]={enabled:true,manuallyDisabled:false,learned:false,attempts:0,correct:0,hardness:0,history:[]};
      cards[1]={enabled:false,manuallyDisabled:false,learned:true,attempts:2,correct:1,hardness:52,history:[{ok:false},{ok:true}]};
      localStorage.setItem(key,JSON.stringify({version:1,language:"ru",mode:"auto",cards,round:2,started:true,queue:[2,3],current:4}));
      sessionStorage.setItem("legacy-seeded","1");
    }
  },storageKey);
  await legacyPage.route("**/data/phrases.json*",async route=>{
    const response=await route.fetch();
    await route.fulfill({response,contentType:"application/json",body:JSON.stringify([...(await response.json()).slice(0,80),newCard])});
  });
  await legacyPage.goto(origin);
  await legacyPage.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 80"));
  state=await legacyPage.evaluate(snapshot);
  assert.equal(state.cards[81].enabled,false,"Legacy sessions must also exclude new catalogue items");
  assert.equal(state.round,2);
  assert.equal(state.current,4);
  assert.deepEqual(state.queue,[2,3]);
  assert.equal(state.cards[1].hardness,52);
  assert.equal(state.cards[1].history.length,2);
  await legacy.close();
  assert.deepEqual(failures,[]);
  console.log("PASS: new JSON is unselected during unfinished training, queue/round/statistics preserved, manual opt-in resets session, fresh and legacy states migrate");
}finally{
  await browser.close();
}
