// Visual regression smoke test for the real local application (synthetic seed only).
// Run with: npm install --no-save playwright@1.58.2 && npx playwright install chromium
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({headless:true});
  const output = path.resolve(process.cwd(), 'preview-screenshots');
  fs.mkdirSync(output,{recursive:true});
  const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle',timeout:30000});
    const modules=page.locator('.p01-module');
    await modules.first().waitFor({timeout:15000});
    const count=await modules.count();
    if(count!==6)throw new Error('Expected six project cards, got '+count);
    const locations=await modules.evaluateAll(elements=>elements.map(element=>{const r=element.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};}));
    if(!(locations[0].y===locations[1].y&&locations[1].y===locations[2].y&&locations[3].y===locations[4].y&&locations[4].y===locations[5].y&&locations[3].y>locations[0].y))throw new Error('Desktop cards are not in 3x2 rows: '+JSON.stringify(locations));
    await page.screenshot({path:path.join(output,'real-dashboard-desktop.png'),fullPage:true});
    await modules.first().click();
    await page.locator('.dashboard-hero').waitFor({state:'detached',timeout:5000});
    await page.getByRole('button',{name:/робочий стіл/i}).first().click();
    await modules.first().waitFor();
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(output,'real-dashboard-mobile.png'),fullPage:true});
    if(errors.length)throw new Error('Page errors: '+errors.join('; '));
    console.log('Dashboard E2E OK: 6 module cards; 3x2 desktop; working navigation; mobile screenshot; no JS errors.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
