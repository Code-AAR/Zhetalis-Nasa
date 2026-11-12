// Run with Playwright's browser_run_code tool against the local server on port 8765.
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  await page.goto('http://127.0.0.1:8765/game/moon/tests/lunar-assets-harness.html');
  await page.waitForSelector('body[data-ready=true]');
  const requested = () => page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name).filter(n => /moon-lro|lro-orbiter|apollo-lunar-module|saturn-v-history|draco_decoder/.test(n)));
  check((await requested()).length === 0, 'Heavy assets loaded before use');
  await page.getByRole('button', {name:'Lunar survey & history'}).click();
  await page.waitForSelector('dialog canvas');
  check((await requested()).length === 0, 'Opening museum downloaded a model');
  const ready = () => page.waitForFunction(() => document.querySelector('[data-status]')?.textContent.startsWith('Drag to rotate'));
  for (const id of ['lro','apollo','saturn']) {
    await page.locator(`[data-exhibit=${id}]`).click(); await ready();
    if (id === 'lro') {
      await page.locator('[data-survey]').click();
      check((await page.locator('[data-status]').innerText()).includes('not live tracking'), 'Missing survey provenance');
      const a = await page.locator('dialog canvas').screenshot();
      await page.waitForTimeout(300);
      const b = await page.locator('dialog canvas').screenshot();
      check(!a.equals(b), 'Survey scene did not animate');
      await page.locator('[data-survey]').click(); await ready();
    }
  }
  await page.route('**/lro-orbiter.glb', r => r.fulfill({status:503,body:'unavailable'}));
  await page.locator('[data-exhibit=lro]').click();
  await page.waitForFunction(() => document.querySelector('[data-status]')?.textContent.startsWith('Model unavailable'));
  await page.unroute('**/lro-orbiter.glb');
  await page.locator('[data-exhibit=lro]').click(); await ready();
  await page.locator('[data-survey]').click();
  await page.keyboard.press('Escape'); await page.waitForSelector('dialog',{state:'detached'});
  check(await page.evaluate(() => document.activeElement.textContent === 'Lunar survey & history'), 'Focus not restored');
  return {lazy:true,models:3,surveyAnimation:true,retry:true,closeDuringSurvey:true};
}
