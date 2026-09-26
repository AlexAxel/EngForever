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
  await p.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 360"));
  const catalog=await p.evaluate(async()=>await (await fetch("./data/phrases.json")).json());
  assert.equal(catalog.length,360);
  assert.deepEqual([catalog[280].id,catalog[280].ru,catalog[280].eng,catalog[280].level],[281,"Я хочу сказать, что это действительно имеет значение.","I want to say that it really matters.","A1"]);
  assert.deepEqual([catalog[350].id,catalog[350].ru,catalog[350].eng,catalog[350].level],[351,"Почему этот билет стоит так дорого? (дёшево)","Why does this ticket cost so much? (cost so little)","A1"]);
  assert.deepEqual([catalog[359].id,catalog[359].ru,catalog[359].eng,catalog[359].level],[360,"Ты думаешь, это хорошая цена? Что помогает тебе?","Do you think it's a good price? What helps you?","A1"]);
  assert.ok(catalog.slice(280).every(x=>x.level==="A1"));
  await fresh.close();

  const ctx=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  await page.addInitScript(storageKey=>{
    if(sessionStorage.getItem("grow-360-seeded"))return;
    const ids=Array.from({length:280},(_,i)=>i+1),cards={};
    for(const id of ids)cards[id]={enabled:true,manuallyDisabled:false,learned:false,attempts:0,correct:0,hardness:0,history:[]};
    cards[11]={enabled:true,manuallyDisabled:false,learned:false,attempts:7,correct:2,hardness:71,history:[{ok:false},{ok:true}]};
    localStorage.setItem(storageKey,JSON.stringify({
      version:1,language:"ru",mode:"auto",cards,catalogIds:ids,sessionIds:ids,
      round:1,started:true,roundIds:ids,roundSeen:[1,2,3,4,5,6,7,8,9,10],
      roundErrors:[11],bonusDue:[],currentBonus:false,queue:ids.slice(11),current:11
    }));
    sessionStorage.setItem("grow-360-seeded","1");
  },key);
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 280"));
  let state=await page.evaluate(snap);
  assert.equal(state.current,11);
  assert.equal(state.roundIds.length,280);
  assert.equal(state.cards[11].hardness,71);
  assert.equal(state.cards[11].attempts,7);
  assert.equal(state.cards[11].history.length,2);
  for(let id=281;id<=360;id++){
    assert.equal(state.cards[id].enabled,false,"New #"+id+" must stay outside active 280-card session");
    assert.equal(state.cards[id].manuallyDisabled,true);
    assert.ok(!state.roundIds.includes(id));
    assert.ok(!state.queue.includes(id));
  }
  await page.locator("#settings-open").click();
  assert.equal(await page.locator("#phrase-list .phrase-option").count(),360);
  assert.equal(await page.locator("#level-count-A1").textContent(),"360");
  for(let id=281;id<=360;id++)assert.equal(await page.locator('#phrase-list .phrase-option[data-id="'+id+'"] input').isChecked(),false);
  await page.locator("#settings-done").click();
  await page.reload();
  state=await page.evaluate(snap);
  assert.equal(state.current,11);
  assert.equal(state.cards[360].enabled,false);
  assert.equal(state.cards[11].hardness,71);
  assert.equal(state.cards[11].history.length,2);
  await ctx.close();
  console.log("PASS: A1 notebook 281–360, bracket text preserved, active 280-card session and historical difficulty survive catalogue growth");
}finally{await browser.close();}
