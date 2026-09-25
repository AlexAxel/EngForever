import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const base="http://127.0.0.1:8000/";
const storageKey="eng-forever-v1";
const snapshot=()=>JSON.parse(localStorage.getItem("eng-forever-v1"));
const errors=[];
const keep200=async route=>{
  const response=await route.fetch();
  await route.fulfill({response,contentType:"application/json",body:JSON.stringify((await response.json()).slice(0,200))});
};
try{
  const fresh=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
  const p=await fresh.newPage();
  p.on("pageerror",e=>errors.push(String(e)));
  await p.route("**/data/phrases.json*",keep200);
  await p.goto(base);
  await p.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 200"));
  let saved=await p.evaluate(snapshot);
  const ids=Array.from({length:200},(_,i)=>i+1);
  assert.deepEqual(saved.catalogIds,ids,"Notebook IDs must be sequential 1–200");
  assert.equal(Object.keys(saved.cards).length,200);
  assert.equal(saved.cards[200].enabled,true,"New installation includes all 200 phrases");
  await p.locator("#settings-open").click();
  assert.equal(await p.locator("#phrase-list .phrase-option").count(),200);
  assert.deepEqual(await p.locator("#phrase-list .phrase-option").evaluateAll(rows=>rows.map(row=>parseInt(row.textContent.slice(1),10))),ids);
  const catalog=await p.evaluate(async()=>await (await fetch("./data/phrases.json")).json());
  const sourceChecks={
    121:["Я думаю, это скоро будет дороже.","I think it'll be more expensive soon."],
    140:["Ты скажешь ей эту вещь?","Will you tell her this thing?"],
    160:["Я хотел общаться с людьми из других стран.","I wanted to communicate with people from other countries."],
    161:["Я посмотрел на неё, и она посмотрела на меня.","I looked at her and she looked at me."],
    180:["Это предложение казалось очень интересным.","This offer seemed very interesting."],
    200:["Я положил это на письменный стол.","I put it on the desk."]
  };
  for(const [id,text] of Object.entries(sourceChecks)){
    const phrase=catalog.find(c=>c.id===Number(id));
    assert.deepEqual([phrase.ru,phrase.eng],text,"Both translations of #"+id+" must match the source notebook");
  }
  await fresh.close();

  // Simulate an existing 120-phrase session and introduce #121–200 remotely.
  const continuing=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
  const page=await continuing.newPage();
  page.on("pageerror",e=>errors.push(String(e)));
  await page.route("**/data/phrases.json*",keep200);
  await page.addInitScript(key=>{
    if(sessionStorage.getItem("grow-200-seeded"))return;
    const ids=Array.from({length:120},(_,i)=>i+1);
    const cards={};
    for(const id of ids)cards[id]={enabled:true,manuallyDisabled:false,learned:false,attempts:0,correct:0,hardness:0,history:[]};
    cards[1]={enabled:true,manuallyDisabled:false,learned:false,attempts:3,correct:1,hardness:74,history:[{ok:false,at:"yesterday"},{ok:true,bonus:true}]};
    localStorage.setItem(key,JSON.stringify({
      version:1,language:"ru",mode:"auto",cards,catalogIds:ids,sessionIds:ids,
      round:1,started:true,roundIds:ids,roundSeen:[1,2,3,4],roundErrors:[1],
      bonusDue:[{id:1,due:10}],currentBonus:false,queue:ids.slice(5),current:5
    }));
    sessionStorage.setItem("grow-200-seeded","yes");
  },storageKey);
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 120"));
  saved=await page.evaluate(snapshot);
  assert.equal(saved.started,true);
  assert.equal(saved.round,1);
  assert.equal(saved.current,5);
  assert.equal(saved.roundIds.length,120);
  assert.deepEqual(saved.roundSeen,[1,2,3,4]);
  assert.deepEqual(saved.roundErrors,[1]);
  assert.deepEqual(saved.bonusDue,[{id:1,due:10}]);
  assert.deepEqual(saved.queue,Array.from({length:115},(_,i)=>i+6));
  assert.deepEqual(saved.catalogIds,ids);
  for(let id=121;id<=200;id++){
    assert.equal(saved.cards[id].enabled,false,"Added #"+id+" must not be in existing session");
    assert.equal(saved.cards[id].manuallyDisabled,true);
    assert.ok(!saved.roundIds.includes(id));
    assert.ok(!saved.queue.includes(id));
  }
  assert.equal(saved.cards[1].hardness,74);
  assert.equal(saved.cards[1].attempts,3);
  assert.equal(saved.cards[1].history.length,2);
  await page.locator("#settings-open").click();
  assert.equal(await page.locator("#phrase-list .phrase-option").count(),200);
  for(let id=121;id<=200;id++)assert.equal(await page.locator("#phrase-list .phrase-option").nth(id-1).locator("input").isChecked(),false);
  await page.locator("#settings-done").click();
  await page.reload();
  saved=await page.evaluate(snapshot);
  assert.equal(saved.current,5,"Existing round must survive reload");
  assert.equal(saved.cards[200].enabled,false,"New phrases remain excluded after reload");
  assert.equal(saved.cards[1].hardness,74,"Historical difficulty persists");
  await page.locator("#settings-open").click();
  await page.locator("#phrase-list .phrase-option").nth(120).locator("input").check();
  saved=await page.evaluate(snapshot);
  assert.equal(saved.started,false,"Manual selection alone should restart the session");
  assert.equal(saved.round,1);
  assert.equal(saved.current,null);
  assert.deepEqual(saved.queue,[]);
  assert.equal(saved.cards[121].enabled,true);
  assert.equal(saved.cards[122].enabled,false);
  assert.equal(saved.cards[1].hardness,74,"Restart must preserve previous difficulty");
  assert.equal(saved.cards[1].history.length,2,"Restart must preserve answer history");
  await page.locator("#select-all").click();
  saved=await page.evaluate(snapshot);
  assert.equal(saved.started,false);
  assert.equal(Object.values(saved.cards).filter(c=>c.enabled).length,200,"Bulk selection includes all 200");
  assert.equal(saved.cards[1].hardness,74);
  await page.locator("#settings-done").click();
  assert.equal(await page.locator("#start").isVisible(),true);
  await continuing.close();
  assert.deepEqual(errors,[],"No browser errors");
  console.log("PASS: notebook pairs 1–200, original 120-session and statistics survive new 80 IDs, manual opt-in or select-all starts a new round");
}finally{await browser.close();}
