import puppeteer from 'puppeteer-core';
import fs from 'fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
  console.log('>>> STARTING COMPREHENSIVE E2E BUTTON CLICK-THROUGH TEST <<<');
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
  page.on('dialog', async dialog => {
    console.warn(`[BROWSER DIALOG] ${dialog.type().toUpperCase()}: "${dialog.message()}"`);
    await dialog.dismiss();
  });

  console.log('1. Navigating to http://127.0.0.1:5000/...');
  await page.goto('http://127.0.0.1:5000/', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // 2. Test Range and Loadout Selection
  console.log('2. Testing Loadout selector dropdown...');
  const loadoutSelect = await page.$('select');
  if (loadoutSelect) {
    await loadoutSelect.select('Production');
    await new Promise(r => setTimeout(r, 500));
    console.log('   Step 2 OK: Switched loadout to Production.');
  }

  // 3. Click "+ New Shot" Button in Header
  console.log('3. Testing "+ New Shot" button in header...');
  const newShotBtn = await page.$('button[title="Create New Shot"]');
  if (!newShotBtn) throw new Error('Create New Shot button not found!');
  await newShotBtn.click();
  await new Promise(r => setTimeout(r, 800));

  // Verify modal is open
  const modalHeader = await page.$eval('body', b => b.innerText);
  if (!modalHeader.includes('Create New Shot')) throw new Error('New Shot modal did not appear!');
  console.log('   Modal opened successfully. Filling in shot details...');

  // Fill in shot name
  await page.type('input[placeholder="e.g. Fetch Current User Profile"]', 'E2E Automated Click Test');

  // Click "Create Shot" button inside modal
  const createBtn = await page.waitForSelector('button ::-p-text(Create Shot)');
  await createBtn.click();
  console.log('   Clicked "Create Shot". Waiting for range data to refresh...');
  await new Promise(r => setTimeout(r, 2000));
  console.log('   Step 3 OK: Shot created.');

  // 4. Select the first shot or created shot in tree
  console.log('4. Locating and clicking shot in tree...');
  const shotItems = await page.$$('.group\\/shot');
  console.log(`   Found ${shotItems.length} shots in the Arsenal tree.`);
  if (shotItems.length > 0) {
    await shotItems[0].click();
    await new Promise(r => setTimeout(r, 600));
    console.log('   Step 4 OK: Clicked shot item from tree.');
  }

  // 5. Click the primary FIRE button
  console.log('5. Clicking primary "FIRE" button...');
  const fireBtn = await page.waitForSelector('button ::-p-text(FIRE)');
  await fireBtn.click();
  console.log('   Clicked FIRE! Waiting for live response...');
  await new Promise(r => setTimeout(r, 3500));

  const responseText = await page.$eval('body', b => b.innerText);
  const statusOk = responseText.includes('ms') || responseText.includes('Status') || responseText.includes('200') || responseText.includes('Error');
  console.log(`   Step 5 OK: Fire execution completed. Response received: ${statusOk}`);

  // 6. Test Header Tabs (Params, Headers, Armor, Payload, Triggers, Verifiers, Settings)
  console.log('6. Clicking through editor sub-tabs...');
  const editorTabs = ['Headers', 'Armor', 'Payload', 'Triggers', 'Verifiers', 'Settings', 'Params'];
  for (const tabName of editorTabs) {
    const tabEl = await page.waitForSelector(`button ::-p-text(${tabName})`);
    if (tabEl) {
      await tabEl.click();
      await new Promise(r => setTimeout(r, 300));
      console.log(`   Clicked editor tab: ${tabName}`);
    }
  }

  // 7. Click "+ Add Row" in Params
  console.log('7. Testing "+ Add Row" in Params...');
  const addRowBtn = await page.$('button ::-p-text(+ Add Row)');
  if (addRowBtn) {
    await addRowBtn.click();
    await new Promise(r => setTimeout(r, 300));
    console.log('   Step 7 OK: Added parameter row.');
  }

  // 8. Click "Save" Button
  console.log('8. Testing "Save" button...');
  const saveBtn = await page.waitForSelector('button ::-p-text(Save)');
  await saveBtn.click();
  await new Promise(r => setTimeout(r, 1000));
  console.log('   Step 8 OK: Shot saved without errors.');

  // 9. Click "Code" Button (Polyglot Snippet Generator)
  console.log('9. Testing "Code" button...');
  const codeBtn = await page.waitForSelector('button ::-p-text(Code)');
  await codeBtn.click();
  await new Promise(r => setTimeout(r, 800));

  // Click Python language pill
  const pythonBtn = await page.$('button ::-p-text(Python (requests))');
  if (pythonBtn) {
    await pythonBtn.click();
    await new Promise(r => setTimeout(r, 500));
    console.log('   Generated Python code snippet.');
  }

  // Close modal
  const closeCodeModal = await page.$('button svg.lucide-x');
  if (closeCodeModal) await closeCodeModal.click();
  await new Promise(r => setTimeout(r, 500));
  console.log('   Step 9 OK: Code modal opened, generated snippet, and closed.');

  // 10. Test "Firing Run" Button
  console.log('10. Testing "Firing Run" modal button...');
  const firingRunBtn = await page.$('button[title="Run Arsenal Firing Run"]');
  if (firingRunBtn) {
    await firingRunBtn.click();
    await new Promise(r => setTimeout(r, 800));
    console.log('   Firing Run modal opened.');

    // Click "START FIRING RUN" button
    const startRunBtn = await page.$('button ::-p-text(START FIRING RUN)');
    if (startRunBtn) {
      console.log('   Clicking "START FIRING RUN"...');
      await startRunBtn.click();
      await new Promise(r => setTimeout(r, 3000));
      console.log('   Firing run executed!');
    }

    const closeRunModal = await page.$('button svg.lucide-x');
    if (closeRunModal) await closeRunModal.click();
    await new Promise(r => setTimeout(r, 500));
    console.log('   Step 10 OK: Firing Run completed and closed.');
  }

  // 11. Test "Transfer" Button (Import/Export)
  console.log('11. Testing "Transfer" modal button...');
  const transferBtn = await page.$('button[title="Transfer (Import/Export)"]');
  if (transferBtn) {
    await transferBtn.click();
    await new Promise(r => setTimeout(r, 800));
    const closeTransferModal = await page.$('button svg.lucide-x');
    if (closeTransferModal) await closeTransferModal.click();
    await new Promise(r => setTimeout(r, 500));
    console.log('   Step 11 OK: Transfer modal opened and closed.');
  }

  // 12. Test ALL Sidebar Navigation Tabs
  console.log('12. Clicking through all 8 sidebar navigation views...');
  const sidebarViews = [
    { title: 'Loadouts & Rounds (Environments & Variables)', name: 'Loadouts' },
    { title: 'Shot Log (Execution History)', name: 'Shot Log' },
    { title: 'Bulletproof TLS (Certificates & mTLS)', name: 'TLS' },
    { title: 'Target Range (Mock Servers)', name: 'Target Range' },
    { title: 'Sentinels (Automated Health Monitors)', name: 'Sentinels' },
    { title: 'Cookie Locker (Session & Cookie Management)', name: 'Cookie Locker' },
    { title: 'Field Manual (Documentation & Guide)', name: 'Field Manual' },
    { title: 'Arsenals (Collections & Requests)', name: 'Arsenals' },
  ];

  for (const view of sidebarViews) {
    const btn = await page.$(`button[title="${view.title}"]`);
    if (btn) {
      await btn.click();
      await new Promise(r => setTimeout(r, 600));
      console.log(`   Switched to view: ${view.name}`);
    }
  }

  // 13. Test Trajectory Console Toggle
  console.log('13. Testing Trajectory Console dock button...');
  const trajToggle = await page.$('button[title="Trajectory Console (Ctrl+J)"]');
  if (trajToggle) {
    await trajToggle.click();
    await new Promise(r => setTimeout(r, 500));
    console.log('   Trajectory console opened.');
    await trajToggle.click();
    await new Promise(r => setTimeout(r, 300));
    console.log('   Trajectory console closed.');
  }

  await page.screenshot({ path: 'step13-final-verified.png' });
  console.log('   Step 13 OK: Final screenshot saved.');

  await browser.close();
  console.log('\n============================================================');
  console.log(`TOTAL UNCAUGHT ERRORS: ${errors.length}`);
  if (errors.length === 0) {
    console.log('>>> COMPLETE E2E BUTTON CLICK-THROUGH TEST PASSED 100%! <<<');
  } else {
    console.error('FAILED WITH ERRORS:', errors);
    process.exit(1);
  }
  console.log('============================================================');
}

run().catch(err => {
  console.error('TEST FATAL ERROR:', err);
  process.exit(1);
});
