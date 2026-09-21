import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
const errors=[];
page.on("pageerror",e=>errors.push(String(e)));
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("eng-forever-v1")));
const waitForCard=()=>page.locator("#card:not(.hidden)").waitFor();
try{
  await page.goto("http://127.0.0.1:8000/");
  await page.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 80"));
  await page.locator("#start").click();
  await waitForCard();
  assert.equal(await page.locator("#round-label").textContent(),"Круг 1");
  assert.equal(await page.locator("#progress-label").textContent(),"0 / 80 пройдено");

  const all=[],mistakes=new Set();
  for(let i=0;i<80;i++){
    await waitForCard();
    assert.equal(await page.locator("#round-label").textContent(),"Круг 1","Must not advance before 80 distinct phrases");
    const id=Number((await page.locator("#card-id").textContent()).replace("№ ",""));
    assert.ok(id>=1&&id<=80);
    assert.ok(!all.includes(id),"First round repeated ID "+id+" at step "+(i+1));
    all.push(id);
    await page.locator("#sheet-handle").click();
    if(i<10){mistakes.add(id);await page.locator("#wrong").click();}
    else await page.locator("#right").click();
    const snap=await state();
    assert.equal(snap.roundSeen.length,i+1,"Every distinct answer advances the counter exactly once");
    assert.equal(new Set(snap.roundSeen).size,i+1,"A repeat must never consume an initial round step");
    if(i<79){
      await page.waitForFunction(old=>document.querySelector("#card-id").textContent!==old,"№ "+id);
      assert.equal(await page.locator("#progress-label").textContent(),(i+1)+" / 80 пройдено");
    }else{
      assert.equal(await page.locator("#progress-label").textContent(),"80 / 80 пройдено");
    }
  }
  assert.deepEqual([...all].sort((a,b)=>a-b),Array.from({length:80},(_,i)=>i+1),"All 80 original phrases must be tested");
  await page.waitForFunction(()=>document.querySelector("#round-label").textContent==="Круг 2");
  assert.equal(await page.locator("#progress-label").textContent(),"0 / 10 пройдено","Second round begins at zero with only ten mistakes");
  const second=await state();
  assert.equal(second.round,2);
  assert.equal(second.roundIds.length,10);
  assert.deepEqual([...second.roundIds].sort((a,b)=>a-b),[...mistakes].sort((a,b)=>a-b));
  assert.equal(second.roundSeen.length,0);
  assert.ok(second.roundIds.includes(second.current),"First review card belongs to review round");
  const reviewId=second.current;
  await page.locator("#sheet-handle").click();
  await page.locator("#right").click();
  assert.equal(await page.locator("#progress-label").textContent(),"1 / 10 пройдено");
  await page.waitForFunction(old=>document.querySelector("#card-id").textContent!==old,"№ "+reviewId);
  const after=await state();
  assert.equal(after.round,2);
  assert.equal(after.roundSeen.length,1);
  assert.equal(after.cards[reviewId].attempts,2);
  assert.equal(after.cards[reviewId].history.length,2);
  assert.ok(after.cards[reviewId].hardness>0,"One successful review must not erase an earlier error");
  await page.reload();
  await waitForCard();
  const restored=await state();
  assert.equal(restored.round,2);
  assert.equal(restored.roundSeen.length,1);
  assert.equal(restored.roundIds.length,10);
  assert.equal(await page.locator("#progress-label").textContent(),"1 / 10 пройдено");
  assert.deepEqual(errors,[],"No uncaught errors");
  console.log("PASS: 80/80 unique first-round IDs, ten mistakes, 0/10 review round, history retained and reload resumes");
}finally{await browser.close();}
