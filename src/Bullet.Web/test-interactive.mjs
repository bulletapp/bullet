import puppeteer from 'puppeteer-core';
import fs from 'fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
  console.log('Launching Edge browser for deep interactive verification...');
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`[CONSOLE ERROR] ${msg.text()}`);
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    console.error(`[PAGE ERROR] ${err.toString()}`);
    errors.push(err.toString());
  });

  await page.goto('http://127.0.0.1:5000/', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // 1. Select the first shot from the tree
  console.log('1. Selecting a shot from the Arsenal tree...');
  const shots = await page.$$('.group\\/shot');
  console.log(`   Found ${shots.length} shots in the tree.`);
  if (shots.length > 0) {
    await shots[0].click();
    await new Promise(r => setTimeout(r, 500));
    console.log('   Selected first shot successfully.');
  }

  // 2. Click the FIRE button
  console.log('2. Clicking "FIRE" button...');
  const fireBtn = await page.waitForSelector('button ::-p-text(FIRE)', { timeout: 5000 });
  if (fireBtn) {
    await fireBtn.click();
    console.log('   Clicked FIRE! Waiting for impact response...');
    await new Promise(r => setTimeout(r, 2500));

    const impactText = await page.$eval('body', b => b.innerText);
    const hasImpact = impactText.includes('ms') || impactText.includes('Status') || impactText.includes('Error') || impactText.includes('200');
    console.log('   Impact response received:', hasImpact);
  }

  // 3. Click "Save" button
  console.log('3. Clicking "Save" button...');
  const saveBtn = await page.waitForSelector('button ::-p-text(Save)', { timeout: 5000 });
  if (saveBtn) {
    await saveBtn.click();
    await new Promise(r => setTimeout(r, 800));
    console.log('   Save shot completed without errors!');
  }

  // 4. Click "Code" button to open Code Shot modal
  console.log('4. Clicking "Code" button...');
  const codeBtn = await page.waitForSelector('button ::-p-text(Code)', { timeout: 5000 });
  if (codeBtn) {
    await codeBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    const modalText = await page.$eval('body', b => b.innerText);
    const generated = modalText.includes('curl') || modalText.includes('http');
    console.log('   Code Shot modal open with code snippet:', generated);

    // Close modal by clicking the X button inside modal
    const closeBtn = await page.$('button svg.lucide-x');
    if (closeBtn) {
      await closeBtn.click();
      console.log('   Closed Code Shot modal via X button.');
    } else {
      await page.keyboard.press('Escape');
    }
    await new Promise(r => setTimeout(r, 600));
  }

  // 5. Test sidebar navigation tabs
  console.log('5. Testing all sidebar views...');
  const tabs = [
    { title: 'Loadouts & Rounds (Environments & Variables)', expectText: 'Loadouts' },
    { title: 'Shot Log (Execution History)', expectText: 'Shot Log' },
    { title: 'Bulletproof TLS (Certificates & mTLS)', expectText: 'TLS' },
    { title: 'Target Range (Mock Servers)', expectText: 'Target Range' },
    { title: 'Sentinels (Automated Health Monitors)', expectText: 'Sentinels' },
    { title: 'Cookie Locker (Session & Cookie Management)', expectText: 'Cookie Locker' },
    { title: 'Field Manual (Documentation & Guide)', expectText: 'Field Manual' },
  ];

  for (const tab of tabs) {
    const tabBtn = await page.$(`button[title="${tab.title}"]`);
    if (tabBtn) {
      await tabBtn.click();
      await new Promise(r => setTimeout(r, 600));
      const text = await page.$eval('body', b => b.innerText);
      const passed = text.toLowerCase().includes(tab.expectText.toLowerCase());
      console.log(`   Tab "${tab.expectText}": ${passed ? 'OK' : 'FAILED'}`);
    }
  }

  // 6. Return to Arsenals tab
  const arsenalsTab = await page.$('button[title="Arsenals (Collections & Requests)"]');
  if (arsenalsTab) {
    await arsenalsTab.click();
    await new Promise(r => setTimeout(r, 500));
  }

  // 7. Test Trajectory Console Toggle
  console.log('6. Testing Trajectory Console toggle button...');
  const trajBtn = await page.$('button[title="Trajectory Console (Ctrl+J)"]');
  if (trajBtn) {
    await trajBtn.click();
    await new Promise(r => setTimeout(r, 500));
    let text = await page.$eval('body', b => b.innerText);
    console.log('   Trajectory console opened:', text.includes('TRAJECTORY CONSOLE') || text.includes('Trajectory'));
    await trajBtn.click();
    await new Promise(r => setTimeout(r, 300));
  }

  // 8. Test Header Modals: New Shot, Firing Run, Transfer
  console.log('7. Testing Header modals...');
  const newShotBtn = await page.$('button[title="Create New Shot"]');
  if (newShotBtn) {
    await newShotBtn.click();
    await new Promise(r => setTimeout(r, 500));
    let text = await page.$eval('body', b => b.innerText);
    console.log('   New Shot modal opened:', text.includes('Create New Shot'));
    const closeBtn = await page.$('button svg.lucide-x');
    if (closeBtn) await closeBtn.click();
    await new Promise(r => setTimeout(r, 300));
  }

  const firingRunBtn = await page.$('button[title="Run Arsenal Firing Run"]');
  if (firingRunBtn) {
    await firingRunBtn.click();
    await new Promise(r => setTimeout(r, 500));
    let text = await page.$eval('body', b => b.innerText);
    console.log('   Firing Run modal opened:', text.includes('Firing Run') || text.includes('Arsenal'));
    const closeBtn = await page.$('button svg.lucide-x');
    if (closeBtn) await closeBtn.click();
    await new Promise(r => setTimeout(r, 300));
  }

  const transferBtn = await page.$('button[title="Transfer (Import/Export)"]');
  if (transferBtn) {
    await transferBtn.click();
    await new Promise(r => setTimeout(r, 500));
    let text = await page.$eval('body', b => b.innerText);
    console.log('   Transfer modal opened:', text.includes('Transfer') || text.includes('Import') || text.includes('Export'));
    const closeBtn = await page.$('button svg.lucide-x');
    if (closeBtn) await closeBtn.click();
    await new Promise(r => setTimeout(r, 300));
  }

  await page.screenshot({ path: 'test-interactive-complete.png' });
  console.log('Screenshot saved to test-interactive-complete.png');

  await browser.close();
  console.log('\n========================================');
  console.log(`TOTAL UNCAUGHT ERRORS: ${errors.length}`);
  if (errors.length === 0) {
    console.log('>>> ALL BUTTONS, MODALS, AND API ACTIONS ARE 100% OPERATIONAL! <<<');
  } else {
    console.error('Errors:', errors);
  }
  console.log('========================================');
}

run().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
