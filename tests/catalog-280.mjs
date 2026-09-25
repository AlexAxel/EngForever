import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const base="http://127.0.0.1:8000/";
const storageKey="eng-forever-v1";
const snapshot=()=>JSON.parse(localStorage.getItem("eng-forever-v1"));
const errors=[];
try{
  const fresh=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
  const p=await fresh.newPage();
  p.on("pageerror",e=>errors.push(String(e)));
  await p.goto(base);
  await p.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 280"));
  let saved=await p.evaluate(snapshot);
  const ids=Array.from({length:280},(_,i)=>i+1);
  assert.deepEqual(saved.catalogIds,ids);
  assert.equal(Object.keys(saved.cards).length,280);
  assert.equal(saved.cards[280].enabled,true);
  await p.locator("#settings-open").click();
  assert.equal(await p.locator("#phrase-list .phrase-option").count(),280);
  const catalog=await p.evaluate(async()=>await (await fetch("./data/phrases.json")).json());
  const sourceChecks={
    201:["Эта встреча началась десять минут назад.","This meeting began ten minutes ago."],
    220:["Я не поверил ему сначала. Я не хотел опаздывать.","I didn't believe him at first. I didn't want to be late."],
    240:["Сколько времени ты потратил на это?","How much time did you spend on it?"],
    241:["Как ты отпраздновал свой день рождения?","How did you celebrate your birthday?"],
    260:["Я не был за границей в прошлом году.","I wasn't abroad last year."],
    280:["Они были на пляже? Как ты скачал это?","Were they at the beach? How did you download it?"]
  };
  for(const [id,text] of Object.entries(sourceChecks)){
    const phrase=catalog.find(c=>c.id===Number(id));
    assert.deepEqual([phrase.ru,phrase.eng],text,"Source mismatch #"+id);
  }
  await fresh.close();

  // Existing 200-card training must remain exactly 200 cards after remote 201–280 arrive.
  const continuing=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
  const page=await continuing.newPage();
  page.on("pageerror",e=>errors.push(String(e)));
  await page.addInitScript(key=>{
    if(sessionStorage.getItem("grow-280-seeded"))return;
    const ids=Array.from({length:200},(_,i)=>i+1);
    const cards={};
    for(const id of ids)cards[id]={enabled:true,manuallyDisabled:false,learned:false,attempts:0,correct:0,hardness:0,history:[]};
    cards[1]={enabled:true,manuallyDisabled:false,learned:false,attempts:4,correct:2,hardness:63,history:[{ok:false},{ok:true,bonus:true}]};
    localStorage.setItem(key,JSON.stringify({
      version:1,language:"ru",mode:"auto",cards,catalogIds:ids,sessionIds:ids,
      round:1,started:true,roundIds:ids,roundSeen:[1,2,3,4,5,6],
      roundErrors:[1],bonusDue:[{id:1,due:12}],currentBonus:false,
      queue:ids.slice(7),current:7
    }));
    sessionStorage.setItem("grow-280-seeded","1");
  },storageKey);
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 200"));
  saved=await page.evaluate(snapshot);
  assert.equal(saved.started,true);
  assert.equal(saved.current,7);
  assert.equal(saved.roundIds.length,200);
  assert.deepEqual(saved.roundSeen,[1,2,3,4,5,6]);
  assert.deepEqual(saved.roundErrors,[1]);
  assert.deepEqual(saved.bonusDue,[{id:1,due:12}]);
  assert.deepEqual(saved.catalogIds,ids);
  for(let id=201;id<=280;id++){
    assert.equal(saved.cards[id].enabled,false,"New #"+id+" must be disabled in existing session");
    assert.equal(saved.cards[id].manuallyDisabled,true);
    assert.ok(!saved.roundIds.includes(id));
    assert.ok(!saved.queue.includes(id));
  }
  assert.equal(saved.cards[1].hardness,63);
  assert.equal(saved.cards[1].history.length,2);
  await page.locator("#settings-open").click();
  assert.equal(await page.locator("#phrase-list .phrase-option").count(),280);
  for(let id=201;id<=280;id++)assert.equal(await page.locator("#phrase-list .phrase-option").nth(id-1).locator("input").isChecked(),false);
  await page.locator("#settings-done").click();
  await page.reload();
  saved=await page.evaluate(snapshot);
  assert.equal(saved.current,7);
  assert.equal(saved.cards[280].enabled,false);
  assert.equal(saved.cards[1].hardness,63);
  await page.locator("#settings-open").click();
  await page.locator("#phrase-list .phrase-option").nth(200).locator("input").check();
  saved=await page.evaluate(snapshot);
  assert.equal(saved.started,false);
  assert.equal(saved.round,1);
  assert.equal(saved.current,null);
  assert.deepEqual(saved.queue,[]);
  assert.equal(saved.cards[201].enabled,true);
  assert.equal(saved.cards[202].enabled,false);
  assert.equal(saved.cards[1].hardness,63);
  assert.equal(saved.cards[1].history.length,2);
  await page.locator("#select-all").click();
  saved=await page.evaluate(snapshot);
  assert.equal(Object.values(saved.cards).filter(c=>c.enabled).length,280);
  assert.equal(saved.cards[1].hardness,63);
  await page.locator("#settings-done").click();
  assert.equal(await page.locator("#start").isVisible(),true);
  await continuing.close();
  assert.deepEqual(errors,[]);
  console.log("PASS: notebook 1–280; active 200-card session and stats survive 201–280; manual opt-in starts fresh session without stat loss");
}finally{await browser.close();}
