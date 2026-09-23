import assert from "node:assert/strict";
import fs from "node:fs";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const failures=[];
fs.mkdirSync("test-output",{recursive:true});
try{
  for(const [width,height,scheme] of [[320,640,"light"],[390,760,"light"],[768,900,"light"],[390,760,"dark"]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:true,colorScheme:scheme});
    const page=await context.newPage();
    page.on("pageerror",err=>failures.push(String(err)));
    await page.goto("http://127.0.0.1:8000/");
    await page.waitForFunction(()=>document.querySelector("#progress-label").textContent.includes("/ 200"));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"No horizontal overflow before training at "+width);
    await page.screenshot({path:"test-output/design-"+width+"-"+scheme+"-start.png",fullPage:true});
    await page.locator("#start").click();
    await page.locator("#card:not(.hidden)").waitFor();
    const previous=(await page.locator("#card-id").textContent()).trim();
    const sheet=await page.locator("#sheet-handle").boundingBox();
    const prompt=await page.locator("#question-text").boundingBox();
    assert.ok(sheet.y<prompt.y,"Translation drawer must be above prompt");
    assert.equal(await page.locator(".answer-content").evaluate(el=>getComputedStyle(el).display),"none","Translation hidden at rest");
    // Real vertical drag (not click): the drawer must grow with finger movement.
    const hx=sheet.x+sheet.width/2,hy=sheet.y+sheet.height/2;
    await page.mouse.move(hx,hy);
    await page.mouse.down();
    await page.mouse.move(hx,hy+65,{steps:8});
    assert.ok(await page.locator("#answer-sheet").evaluate(el=>parseFloat(el.style.getPropertyValue("--pull")))>40,"Drawer must track downward drag");
    assert.equal(await page.locator("#answer-sheet").evaluate(el=>el.classList.contains("drag-preview")),true);
    await page.mouse.up();
    assert.equal(await page.locator("#answer-sheet").getAttribute("aria-expanded"),"true");
    assert.equal(await page.locator("#right").isEnabled(),true);
    await page.screenshot({path:"test-output/design-"+width+"-"+scheme+"-revealed.png",fullPage:true});
    const card=await page.locator("#card").boundingBox();
    const sx=card.x+card.width*.77,sy=card.y+card.height*.76;
    await page.mouse.move(sx,sy);await page.mouse.down();
    await page.mouse.move(card.x+card.width*.21,sy,{steps:10});
    assert.equal(await page.locator("#card").evaluate(el=>el.classList.contains("swipe-left")),true,"Left-swipe overlay must appear");
    await page.mouse.up();
    await page.waitForFunction(old=>{
      const s=JSON.parse(localStorage.getItem("eng-forever-v1"));
      return s.roundSeen.length===1&&s.current!==null&&"№ "+s.current!==old&&!document.querySelector("#card").classList.contains("fly");
    },previous);
    const state=await page.evaluate(()=>JSON.parse(localStorage.getItem("eng-forever-v1")));
    assert.equal(state.roundSeen.length,1);
    assert.equal(state.cards[Number(previous.slice(2))].attempts,1);
    assert.equal(state.cards[Number(previous.slice(2))].correct,0,"Swipe left records error");
    await page.locator("#sheet-handle").click();
    assert.equal(await page.locator("#right").isEnabled(),true,"Tap remains accessible as fallback");
    await page.locator("#right").click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("eng-forever-v1")).roundSeen.length===2);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"No horizontal overflow in training at "+width);
    await page.locator("#settings-open").click();
    assert.equal(await page.locator("#settings-dialog").evaluate(el=>el.open),true);
    assert.equal(await page.locator("#phrase-list .phrase-option").count(),200);
    await page.locator("#phrase-list .phrase-option").last().scrollIntoViewIfNeeded();
    assert.equal(await page.locator("#phrase-list .phrase-option").last().isVisible(),true);
    await page.screenshot({path:"test-output/design-"+width+"-"+scheme+"-settings.png"});
    await page.locator("#settings-done").click();
    await page.reload();
    await page.locator("#card:not(.hidden)").waitFor();
    assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem("eng-forever-v1")))).roundSeen.length,2,"Visual redesign does not reset saved session");
    await context.close();
    console.log("PASS design "+width+"x"+height+" "+scheme+": layout, drawer drag, left swipe, tap fallback, settings, persistence");
  }
  assert.deepEqual(failures,[],"No JS runtime errors");
}finally{await browser.close();}
