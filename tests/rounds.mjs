import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:760},isMobile:true,hasTouch:true});
const errors=[];
page.on("pageerror",e=>errors.push(String(e)));
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("eng-forever-v1")));
try{
  // Keep this established 80-card interaction regression independent of future catalogue growth.
  await page.route("**/data/phrases.json*",async route=>{
    const response=await route.fetch();
    await route.fulfill({response,contentType:"application/json",body:JSON.stringify((await response.json()).slice(0,80))});
  });
  await page.goto("http://127.0.0.1:8000/");
  await page.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 80"));
  await page.locator("#start").click();
  await page.locator("#card:not(.hidden)").waitFor();
  assert.equal(await page.locator("#round-label").textContent(),"Круг 1");
  assert.equal(await page.locator("#progress-label").textContent(),"0 / 80 пройдено");

  const primaryIds=[],mistakes=new Set(),bonusIds=[];
  let repeatedFailures=0,bonusBeforeHalfway=false;
  for(let interactions=0;interactions<180;interactions++){
    const before=await state();
    if(before.round===2)break;
    assert.equal(before.round,1,"First round should last until all 80 unique IDs are shown");
    const id=before.current;
    assert.ok(Number.isSafeInteger(id),"A card must be selected for every step");
    assert.equal(Number((await page.locator("#card-id").textContent()).replace("№ ","")),id);
    const previous=before.roundSeen.length;
    const bonus=before.currentBonus===true;
    if(bonus){
      bonusIds.push(id);
      if(previous<40)bonusBeforeHalfway=true;
      assert.ok(mistakes.has(id),"Only a previously missed card may be a bonus");
      assert.ok(primaryIds.includes(id),"Bonus must follow that card's original presentation");
      assert.equal(await page.locator("#card").evaluate(el=>el.classList.contains("bonus-review")),true,"Bonus must be visually highlighted");
      assert.match(await page.locator("#card-type").textContent(),/ВНЕ СЧЁТА/);
      assert.match(await page.locator("#progress-label").textContent(),new RegExp("Перепроверка.*"+previous+" / 80"));
      if(bonusIds.length===1){
        const queued=before.queue.slice(),pending=before.bonusDue.slice(),roundErrors=before.roundErrors.slice();
        await page.reload();
        await page.locator("#card:not(.hidden)").waitFor();
        const restoredBonus=await state();
        assert.equal(restoredBonus.current,id,"Interrupted quick review must retain the same card");
        assert.equal(restoredBonus.currentBonus,true,"Reload must retain the off-counter mode");
        assert.equal(restoredBonus.roundSeen.length,previous,"Reload must not count a quick review");
        assert.deepEqual(restoredBonus.queue,queued,"Reload must not alter the numbered deck");
        assert.deepEqual(restoredBonus.bonusDue,pending);
        assert.deepEqual(restoredBonus.roundErrors,roundErrors);
        assert.equal(await page.locator("#card").evaluate(el=>el.classList.contains("bonus-review")),true);
      }
    }else{
      assert.ok(id>=1&&id<=80);
      assert.ok(!primaryIds.includes(id),"Primary card repeated: ID "+id);
      primaryIds.push(id);
      assert.equal(previous,primaryIds.length-1,"Only unique primary cards advance the counter");
      assert.equal(await page.locator("#progress-label").textContent(),previous+" / 80 пройдено");
      assert.equal(await page.locator("#card").evaluate(el=>el.classList.contains("bonus-review")),false);
    }
    const wrong=bonus?repeatedFailures++===0:primaryIds.length<=10;
    if(wrong)mistakes.add(id);
    await page.locator("#sheet-handle").click();
    await page.locator(wrong?"#wrong":"#right").click();
    const answered=await state();
    assert.equal(answered.roundSeen.length,previous+(bonus?0:1),"A bonus cannot consume a numbered step");
    assert.equal(new Set(answered.roundSeen).size,answered.roundSeen.length,"Numbered steps must represent distinct IDs");
    if(bonus)assert.equal(await page.locator("#progress-label").textContent(),previous+" / 80 пройдено");
    if(primaryIds.length===80&& !bonus)assert.equal(await page.locator("#progress-label").textContent(),"80 / 80 пройдено");
    await page.waitForFunction(old=>{
      const s=JSON.parse(localStorage.getItem("eng-forever-v1"));
      const card=document.querySelector("#card");
      return s.round!==old.round || (s.current!==null && s.current!==old.id && !card.classList.contains("fly"));
    },{round:before.round,id});
  }
  assert.deepEqual([...primaryIds].sort((a,b)=>a-b),Array.from({length:80},(_,i)=>i+1),"All original 80 IDs must appear exactly once in the numbered round");
  assert.ok(bonusIds.length>0,"Same-round error reviews must actually appear");
  assert.ok(bonusBeforeHalfway,"Early errors must be reviewed before reaching card 40 of 80");
  assert.ok(bonusIds.includes(primaryIds[0]),"An early mistake must be reviewed in the first round");
  assert.ok(bonusIds.filter(id=>id===bonusIds[0]).length>=2,"An unsuccessful bonus must recur again later in the same round");
  assert.equal(await page.locator("#round-label").textContent(),"Круг 2");
  assert.equal(await page.locator("#progress-label").textContent(),"0 / 10 пройдено","Second round must start at zero with ten missed IDs");
  const second=await state();
  assert.equal(second.round,2);
  assert.equal(second.roundIds.length,10);
  assert.deepEqual([...second.roundIds].sort((a,b)=>a-b),[...mistakes].sort((a,b)=>a-b));
  assert.equal(second.roundSeen.length,0);
  assert.ok(second.roundIds.includes(second.current),"The first review card belongs to the review round");
  const reviewId=second.current;
  await page.locator("#sheet-handle").click();
  await page.locator("#right").click();
  assert.equal(await page.locator("#progress-label").textContent(),"1 / 10 пройдено");
  await page.waitForFunction(old=>document.querySelector("#card-id").textContent!==old,"№ "+reviewId);
  const after=await state();
  assert.equal(after.round,2);
  assert.equal(after.roundSeen.length,1);
  assert.ok(after.cards[reviewId].attempts>=2);
  assert.ok(after.cards[reviewId].history.length>=2);
  assert.ok(after.cards[reviewId].hardness>0,"Correct recheck does not erase historical difficulty");
  await page.reload();
  await page.locator("#card:not(.hidden)").waitFor();
  const restored=await state();
  assert.equal(restored.round,2);
  assert.equal(restored.roundSeen.length,1);
  assert.equal(restored.roundIds.length,10);
  assert.equal(await page.locator("#progress-label").textContent(),"1 / 10 пройдено");
  assert.deepEqual(errors,[],"No uncaught errors");
  console.log("PASS: all 80 primary IDs counted once, extra visually marked first-round rechecks (including repeat failures), 0/10 second round, persisted stats");
}finally{await browser.close();}
