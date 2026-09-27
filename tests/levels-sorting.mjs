import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const base="http://127.0.0.1:8000/";
const key="eng-forever-v1";
const snap=()=>JSON.parse(localStorage.getItem("eng-forever-v1"));
try{
  // Production catalogue: first 280 are A0 bronze, 281–360 are A1 silver.
  const fresh=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
  const freshPage=await fresh.newPage();
  await freshPage.goto(base);
  await freshPage.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 360"));
  const catalog=await freshPage.evaluate(async()=>await (await fetch("./data/phrases.json")).json());
  assert.equal(catalog.length,360);
  assert.equal(catalog.find(p=>p.id===36).ru,"Я вижу, ты не хочешь это.");
  assert.ok(catalog.slice(0,280).every(p=>p.level==="A0"),"IDs 1–280 must be A0");
  assert.ok(catalog.slice(280).every(p=>p.level==="A1"),"IDs 281–360 must be A1");
  await freshPage.locator("#settings-open").click();
  assert.equal(await freshPage.locator("#level-count-A0").textContent(),"280");
  assert.equal(await freshPage.locator("#level-count-A1").textContent(),"80");
  for(const level of ["A2","B1","B2","C1"]){
    assert.equal(await freshPage.locator("#level-count-"+level).textContent(),"0");
    assert.equal(await freshPage.locator('[data-select-level="'+level+'"]').isDisabled(),true);
  }
  assert.equal(await freshPage.locator('[data-select-level="A0"]').getAttribute("aria-pressed"),"true");
  assert.equal(await freshPage.locator('[data-select-level="A1"]').getAttribute("aria-pressed"),"true");

  // Toggle only A1 off; A0 stays selected.
  await freshPage.locator('[data-select-level="A1"]').click();
  let state=await freshPage.evaluate(snap);
  assert.equal(Object.values(state.cards).filter(c=>c.enabled).length,280);
  for(let id=1;id<=280;id++)assert.equal(state.cards[id].enabled,true);
  for(let id=281;id<=360;id++)assert.equal(state.cards[id].enabled,false);
  assert.equal(await freshPage.locator('[data-select-level="A0"]').getAttribute("aria-pressed"),"true");
  assert.equal(await freshPage.locator('[data-select-level="A1"]').getAttribute("aria-pressed"),"false");
  await freshPage.locator("#settings-done").click();
  await freshPage.locator("#start").click();
  await freshPage.locator("#card:not(.hidden)").waitFor();
  assert.equal(await freshPage.locator("#card-level").textContent(),"A0");
  assert.equal(await freshPage.locator("#card").evaluate(el=>el.classList.contains("level-A0")),true);
  assert.notEqual(await freshPage.locator("#card").evaluate(el=>getComputedStyle(el).backgroundImage),"none","A0 card should have bronze treatment");
  await fresh.close();

  // Synthetic catalogue proves additive per-level toggles and preserves sort semantics.
  const ctx=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  await page.route("**/data/phrases.json*",async route=>{
    const response=await route.fetch();
    const rows=(await response.json()).slice(0,6);
    const levels=["A0","A1","A2","A0","C1","A1"];
    await route.fulfill({response,contentType:"application/json",body:JSON.stringify(rows.map((p,i)=>({...p,level:levels[i]})))});
  });
  await page.addInitScript(storageKey=>{
    const card=(enabled,attempts,correct)=>({enabled,manuallyDisabled:!enabled,learned:false,attempts,correct,hardness:attempts?40-correct:0,history:[]});
    localStorage.setItem(storageKey,JSON.stringify({
      version:1,language:"ru",mode:"auto",
      cards:{
        1:card(false,10,8),
        2:card(true,10,2),
        3:card(false,10,0),
        4:card(false,4,1),
        5:card(false,0,0),
        6:card(true,10,6)
      },
      round:1,started:false,queue:[],current:null,catalogIds:[1,2,3,4,5,6],
      sessionIds:[],roundIds:[],roundSeen:[],roundErrors:[],bonusDue:[],currentBonus:false
    }));
  },key);
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 2"));
  await page.locator("#settings-open").click();
  const order=()=>page.locator("#phrase-list .phrase-option").evaluateAll(rows=>rows.map(r=>Number(r.dataset.id)));
  assert.deepEqual(await order(),[2,6,3,4,1,5],"Selected first; recognition ascending inside selected/unselected; untested last");
  assert.equal(await page.locator("#level-count-A0").textContent(),"2");
  assert.equal(await page.locator("#level-count-A1").textContent(),"2");
  assert.equal(await page.locator("#level-count-A2").textContent(),"1");
  assert.equal(await page.locator("#level-count-C1").textContent(),"1");

  // Add A0 while A1 remains selected.
  await page.locator('[data-select-level="A0"]').click();
  state=await page.evaluate(snap);
  assert.deepEqual(Object.entries(state.cards).filter(([,c])=>c.enabled).map(([id])=>Number(id)).sort((a,b)=>a-b),[1,2,4,6],"A0 adds to existing A1 selection");
  assert.equal(await page.locator('[data-select-level="A0"]').getAttribute("aria-pressed"),"true");
  assert.equal(await page.locator('[data-select-level="A1"]').getAttribute("aria-pressed"),"true");
  assert.deepEqual(await order(),[2,4,6,1,3,5],"Sorting still ignores CEFR and uses selection + recognition");

  // Toggle A1 off independently; A0 remains enabled.
  await page.locator('[data-select-level="A1"]').click();
  state=await page.evaluate(snap);
  assert.deepEqual(Object.entries(state.cards).filter(([,c])=>c.enabled).map(([id])=>Number(id)).sort((a,b)=>a-b),[1,4],"Second click removes only A1");
  assert.equal(await page.locator('[data-select-level="A0"]').getAttribute("aria-pressed"),"true");
  assert.equal(await page.locator('[data-select-level="A1"]').getAttribute("aria-pressed"),"false");
  assert.equal(state.cards[1].attempts,10,"Level toggles preserve statistics");
  assert.equal(state.cards[2].attempts,10);

  // Add A1 back; combined A0 + A1 is equivalent to selecting those groups together.
  await page.locator('[data-select-level="A1"]').click();
  state=await page.evaluate(snap);
  assert.deepEqual(Object.entries(state.cards).filter(([,c])=>c.enabled).map(([id])=>Number(id)).sort((a,b)=>a-b),[1,2,4,6]);
  await page.locator("#settings-done").click();
  await ctx.close();
  console.log("PASS: phrase 36 corrected; A0/A1 ranges; bronze/silver subtypes; additive independent level toggles; existing recognition sorting and stats preserved");
}finally{
  await browser.close();
}
