import puppeteer from 'puppeteer-core';
import fs from 'fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
  console.log('Launching Edge browser...');
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = `[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`;
    console.log(text);
    logs.push(text);
  });

  page.on('pageerror', err => {
    const text = `[PAGE ERROR] ${err.toString()}`;
    console.error(text);
    logs.push(text);
  });

  page.on('requestfailed', req => {
    const text = `[REQUEST FAILED] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`;
    console.error(text);
    logs.push(text);
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      const text = `[HTTP ${res.status()}] ${res.request().method()} ${res.url()}`;
      console.error(text);
      logs.push(text);
    }
  });

  console.log('Navigating to http://127.0.0.1:5000/...');
  await page.goto('http://127.0.0.1:5000/', { waitUntil: 'networkidle0', timeout: 15000 });

  console.log('Waiting 2 seconds for initial React render and API calls...');
  await new Promise(r => setTimeout(r, 2000));

  // Check what buttons exist on the page
  const buttonTexts = await page.$$eval('button', btns => btns.map(b => (b.innerText.trim() || b.getAttribute('title') || b.getAttribute('aria-label') || '[icon button]')));
  console.log('Found buttons count:', buttonTexts.length);
  console.log('Found buttons:', JSON.stringify(buttonTexts, null, 2));

  // Check body text
  const bodyText = await page.$eval('body', el => el.innerText);
  console.log('Body text snippet:\n', bodyText.substring(0, 300));

  // Try clicking various buttons to test responsiveness
  console.log('\n--- Testing Sidebar Tab Clicks ---');
  const sidebarButtons = await page.$$('nav button');
  console.log(`Found ${sidebarButtons.length} sidebar nav buttons`);
  for (let i = 0; i < sidebarButtons.length; i++) {
    const title = await sidebarButtons[i].evaluate(b => b.getAttribute('title'));
    console.log(`Clicking sidebar tab ${i}: ${title}`);
    await sidebarButtons[i].click();
    await new Promise(r => setTimeout(r, 300));
  }

  // Click back to first tab (Arsenals)
  if (sidebarButtons.length > 0) {
    await sidebarButtons[0].click();
    await new Promise(r => setTimeout(r, 300));
  }

  // Test New Shot button
  console.log('\n--- Testing Header / Action Buttons ---');
  const newShotBtn = await page.$('button[title="Create New Shot"]');
  if (newShotBtn) {
    console.log('Found "Create New Shot" button! Clicking it...');
    await newShotBtn.click();
    await new Promise(r => setTimeout(r, 500));
    const modalVisible = await page.$eval('body', b => b.innerText.includes('New Shot') || b.innerText.includes('Create'));
    console.log('Modal appeared after clicking New Shot:', modalVisible);
  } else {
    console.log('Could not find button[title="Create New Shot"]');
  }

  // Test Firing Run button
  const firingRunBtn = await page.$('button[title="Run Arsenal Firing Run"]');
  if (firingRunBtn) {
    console.log('Found "Firing Run" button! Clicking it...');
    await firingRunBtn.click();
    await new Promise(r => setTimeout(r, 500));
    const modalVisible = await page.$eval('body', b => b.innerText.includes('Firing Run') || b.innerText.includes('Runner'));
    console.log('Modal appeared after clicking Firing Run:', modalVisible);
  }

  // Test Transfer button
  const transferBtn = await page.$('button[title="Transfer (Import/Export)"]');
  if (transferBtn) {
    console.log('Found "Transfer" button! Clicking it...');
    await transferBtn.click();
    await new Promise(r => setTimeout(r, 500));
    const modalVisible = await page.$eval('body', b => b.innerText.includes('Transfer') || b.innerText.includes('Import'));
    console.log('Modal appeared after clicking Transfer:', modalVisible);
  }

  // Capture screenshot
  await page.screenshot({ path: 'test-screenshot.png' });
  console.log('Screenshot saved to test-screenshot.png');

  fs.writeFileSync('browser-test-logs.txt', logs.join('\n'));
  console.log('Logs written to browser-test-logs.txt');

  await browser.close();
  console.log('Test complete!');
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
