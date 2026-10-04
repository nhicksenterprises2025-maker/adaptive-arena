import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const output = path.resolve('portable/Adaptive-Arena');
const url = pathToFileURL(path.join(output, 'PLAY_ADAPTIVE_ARENA.html')).href;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const report = { testedAt: new Date().toISOString(), browser: browser.version(), launchProtocol: 'file:', checks: [], errors: [], networkRequests: [] };
let failed = false;
try {
  for (const [width, height] of [[1366,768], [1600,900], [1920,1080]]) {
    const context = await browser.newContext({ viewport: { width, height }, offline: true });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('request', r => { if (/^https?:/.test(r.url())) report.networkRequests.push(r.url()); });
    await page.goto(url);
    await page.locator('.hero-play').waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (overflow) throw new Error(`Horizontal overflow at ${width}x${height}`);
    await page.locator('[data-action="section"][data-section="play"]').first().click();
    await page.locator('[data-action="start-match"][data-mode="quickplay"]').click();
    await page.locator('#arena-canvas').waitFor();
    await page.waitForTimeout(3900);
    const signature = () => page.evaluate(() => {
      const canvas = document.querySelector('#arena-canvas');
      if (!canvas || canvas.width < 10 || canvas.height < 10) throw new Error('Canvas missing/empty');
      const pixels = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let n = 2166136261;
      for (let i=0; i<pixels.length; i+=20) n = Math.imul(n ^ pixels[i], 16777619);
      return n;
    });
    const before = await signature();
    const rect = await page.locator('#arena-canvas').boundingBox();
    await page.mouse.move(rect.x + rect.width * .65, rect.y + rect.height * .5);
    await page.keyboard.down('d');
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.keyboard.up('d');
    await page.mouse.up();
    await page.keyboard.press('Space');
    await page.keyboard.press('c');
    await page.keyboard.press('f');
    await page.waitForTimeout(1000);
    const after = await signature();
    if (before === after) throw new Error(`Combat scene did not advance at ${width}x${height}`);
    if (!(await page.locator('#match-hud').innerText()).includes('PLAYER HP')) throw new Error('HUD missing');
    await page.screenshot({ path: path.join(output, `QA-combat-${width}.png`) });
    report.checks.push({ name: `Offline file launch, menu navigation, Quickplay, live canvas, input, HUD at ${width}x${height}`, passed: true });
    await context.close();
  }
  for (const mode of ['accountRanked', 'seasonalRanked']) {
    const context = await browser.newContext({ viewport: { width:1366,height:768 }, offline: true });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(url);
    await page.locator('[data-action="section"][data-section="play"]').first().click();
    const tab = page.locator(`[data-action="play-tab"][data-tab="${mode}"]`);
    if (await tab.count()) await tab.click();
    await page.locator(`[data-action="start-match"][data-mode="${mode}"]`).click();
    await page.locator('#arena-canvas').waitFor();
    await page.waitForTimeout(4000);
    if (!(await page.locator('#match-hud').innerText()).includes('PLAYER HP')) throw new Error(`HUD missing in ${mode}`);
    report.checks.push({ name:`${mode} starts from offline portable build`, passed:true });
    await context.close();
  }
  if (report.errors.length) throw new Error(report.errors.join('\n'));
  if (report.networkRequests.length) throw new Error('Standalone game attempted remote requests');
} catch (error) {
  failed = true;
  report.errors.push(String(error));
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, 'QA_REPORT.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report,null,2));
}
if (failed) process.exit(1);
