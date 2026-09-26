import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const base="http://127.0.0.1:8000/";
const key="eng-forever-v1";
const snap=()=>JSON.parse(localStorage.getItem("eng-forever-v1"));
try{
  // Production catalogue: every current phrase is explicitly A1.
  const fresh=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
  const freshPage=await fresh.newPage();
  await freshPage.goto(base);
  await freshPage.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 280"));
  const catalog=await freshPage.evaluate(async()=>await (await fetch("./data/phrases.json")).json());
  assert.equal(catalog.length,280);
  assert.ok(catalog.every(p=>p.level==="A1"),"All current notebook phrases must be A1");
  await freshPage.locator("#settings-open").click();
  assert.equal(await freshPage.locator("#level-count-A1").textContent(),"280");
  for(const level of ["A2","B1","B2","C1"]){
    assert.equal(await freshPage.locator("#level-count-"+level).textContent(),"0");
    assert.equal(await freshPage.locator('[data-select-level="'+level+'"]').isDisabled(),true);
  }
  await freshPage.locator("#settings-done").click();
  await freshPage.locator("#start").click();
  await freshPage.locator("#card:not(.hidden)").waitFor();
  assert.equal(await freshPage.locator("#card-level").textContent(),"A1");
  assert.equal(await freshPage.locator("#card").evaluate(el=>el.classList.contains("level-A1")),true);
  assert.notEqual(await freshPage.locator("#card").evaluate(el=>getComputedStyle(el).backgroundImage),"none","A1 card should have silver treatment");
  await fresh.close();

  // Synthetic future catalogue proves that level bulk selection is real business logic,
  // not a cosmetic A1-only button set.
  const ctx=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  await page.route("**/data/phrases.json*",async route=>{
    const response=await route.fetch();
    const rows=(await response.json()).slice(0,5);
    const levels=["A1","A2","B1","A1","C1"];
    await route.fulfill({response,contentType:"application/json",body:JSON.stringify(rows.map((p,i)=>({...p,level:levels[i]})))});
  });
  await page.addInitScript(storageKey=>{
    const card=(enabled,attempts,correct)=>({enabled,manuallyDisabled:!enabled,learned:false,attempts,correct,hardness:attempts?40-correct:0,history:[]});
    localStorage.setItem(storageKey,JSON.stringify({
      version:1,language:"ru",mode:"auto",
      cards:{
        1:card(true,10,8),
        2:card(true,10,2),
        3:card(false,10,0),
        4:card(true,4,1),
        5:card(false,0,0)
      },
      round:1,started:false,queue:[],current:null,catalogIds:[1,2,3,4,5],
      sessionIds:[],roundIds:[],roundSeen:[],roundErrors:[],bonusDue:[],currentBonus:false
    }));
  },key);
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 3"));
  await page.locator("#settings-open").click();
  const order=()=>page.locator("#phrase-list .phrase-option").evaluateAll(rows=>rows.map(r=>Number(r.dataset.id)));
  assert.deepEqual(await order(),[2,4,1,3,5],"Selected first; within selected/unselected groups recognition asc; untested last");
  assert.equal(await page.locator('[data-id="2"] .recognition').textContent(),"20%");
  assert.equal(await page.locator('[data-id="3"] .recognition').textContent(),"0%");
  assert.equal(await page.locator('[data-id="5"] .recognition').textContent(),"—");
  assert.equal(await page.locator("#level-count-A1").textContent(),"2");
  assert.equal(await page.locator("#level-count-A2").textContent(),"1");
  assert.equal(await page.locator("#level-count-B1").textContent(),"1");
  assert.equal(await page.locator("#level-count-B2").textContent(),"0");
  assert.equal(await page.locator("#level-count-C1").textContent(),"1");

  await page.locator('[data-id="3"] input').check();
  assert.deepEqual(await order(),[3,2,4,1,5],"Newly selected low-recognition phrase moves to top");
  assert.ok(await page.locator(".phrase-option").evaluateAll(rows=>rows.some(r=>r.getAnimations().length>0)),"Reorder should animate");

  await page.locator('[data-select-level="A1"]').click();
  let state=await page.evaluate(snap);
  assert.deepEqual(Object.entries(state.cards).filter(([,c])=>c.enabled).map(([id])=>Number(id)).sort((a,b)=>a-b),[1,4],"A1 selects only A1 phrases");
  assert.deepEqual(await order(),[4,1,3,2,5],"A1 selected group also sorts by recognition");
  assert.equal(state.cards[1].attempts,10,"Level selection preserves statistics");
  assert.equal(state.cards[3].attempts,10);

  await page.locator('[data-select-level="A2"]').click();
  state=await page.evaluate(snap);
  assert.deepEqual(Object.entries(state.cards).filter(([,c])=>c.enabled).map(([id])=>Number(id)),["2"].map(Number),"A2 selects only A2");
  await page.locator("#settings-done").click();
  await page.locator("#start").click();
  await page.locator("#card:not(.hidden)").waitFor();
  assert.equal(await page.locator("#card-id").textContent(),"№ 2");
  assert.equal(await page.locator("#card-level").textContent(),"A2","Card itself displays its CEFR subtype");
  await ctx.close();
  console.log("PASS: CEFR levels, A1 card styling, level-only bulk selection, recognition ordering, animated reorder and stat preservation");
}finally{
  await browser.close();
}
