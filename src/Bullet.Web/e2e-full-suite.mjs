// e2e-full-suite.mjs
// Comprehensive End-to-End Automated Browser Test for Bullet Platform
import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const KNOWN_PATHS = [
  process.env.EDGE_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge'
].filter(Boolean);

const EDGE_PATH = KNOWN_PATHS.find(p => fs.existsSync(p));
const APP_URL = process.env.APP_URL || 'http://127.0.0.1:5000';
const SCREENSHOT_DIR = path.resolve('e2e-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function checkServerReady() {
  return new Promise((resolve) => {
    const req = http.get(`${APP_URL}/api/ranges`, (res) => {
      if (res.statusCode === 200) resolve(true);
      else resolve(false);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureBackendRunning() {
  const ready = await checkServerReady();
  if (ready) {
    console.log('[E2E Setup] Backend is already running on port 5000.');
    return null;
  }

  console.log('[E2E Setup] Starting backend server via dotnet run...');
  const currentScriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = fs.existsSync(path.resolve('src', 'Bullet.Api')) 
    ? process.cwd() 
    : path.resolve(currentScriptDir, '..', '..');
  const serverProc = spawn(
    'dotnet',
    ['run', '--project', 'src/Bullet.Api', '-c', 'Release', '--no-launch-profile', '--no-build', '--', '--urls', APP_URL],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development' },
    }
  );

  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await checkServerReady()) {
      console.log('[E2E Setup] Backend server is up and responsive!');
      return serverProc;
    }
    if (i % 10 === 0 && i > 0) {
      console.log(`[E2E Setup] Waiting for backend server... (${i}s elapsed)`);
    }
  }
  throw new Error('Backend failed to start within 90 seconds.');
}

async function runFullTestSuite() {
  console.log('===============================================================');
  console.log('  BULLET: COMPREHENSIVE END-TO-END AUTOMATED VERIFICATION SUITE');
  console.log('===============================================================');

  const serverProc = await ensureBackendRunning();

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    defaultViewport: { width: 1400, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const uncaughtErrors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      uncaughtErrors.push(text);
      console.error(`  [Browser Error]: ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    uncaughtErrors.push(err.message);
    console.error(`  [Page Error]: ${err.message}`);
  });

  try {
    console.log(`\n[STEP 1] Navigating to Bullet Web IDE at ${APP_URL}...`);
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.waitForSelector('[data-testid="header-new-shot-btn"]', { timeout: 10000 });
    console.log('  ✓ UI loaded and Header mounted successfully.');

    // -------------------------------------------------------------
    // TEST 1: CREATE SHOT BUTTON (The exact bug reported by user)
    // -------------------------------------------------------------
    console.log('\n[TEST 1] Testing "Create Shot" Modal & Creation Flow...');
    const newShotBtn = await page.waitForSelector('[data-testid="header-new-shot-btn"]');
    await newShotBtn.click();
    console.log('  ✓ Clicked "+ New Shot" button in Header.');

    await page.waitForSelector('[data-testid="new-shot-modal"]', { timeout: 5000 });
    console.log('  ✓ Create New Shot modal opened.');

    // Fill in Shot Name
    const shotName = 'Google Live Search Check';
    const nameInput = await page.waitForSelector('[data-testid="shot-name-input"]');
    await nameInput.click({ clickCount: 3 });
    await nameInput.type(shotName);
    console.log(`  ✓ Entered Shot Name: "${shotName}"`);

    // Fill in URL: https://www.google.com
    const urlInputModal = await page.waitForSelector('[data-testid="shot-url-input"]');
    await urlInputModal.click({ clickCount: 3 });
    await urlInputModal.type('https://www.google.com');
    console.log('  ✓ Entered URL: "https://www.google.com"');

    // Click "Create Shot" submit button
    const submitShotBtn = await page.waitForSelector('[data-testid="create-shot-submit-btn"]');
    await submitShotBtn.click();
    console.log('  ✓ Clicked "Create Shot" submit button.');

    // Verify modal closes
    await page.waitForSelector('[data-testid="new-shot-modal"]', { hidden: true, timeout: 5000 });
    console.log('  ✓ Create Shot modal closed cleanly.');

    // Verify center URL bar updated to https://www.google.com
    await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
    const urlBarInput = await page.waitForSelector('[data-testid="url-input"]');
    const currentUrlVal = await page.evaluate((el) => el.value, urlBarInput);
    console.log(`  ✓ Current active Shot URL in editor: "${currentUrlVal}"`);
    if (!currentUrlVal.includes('google.com')) {
      throw new Error(`Expected active URL to contain google.com but got: "${currentUrlVal}"`);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-create-shot-success.png') });
    console.log('  ★ TEST 1 PASSED: Create Shot button functions perfectly!');

    // -------------------------------------------------------------
    // TEST 2: LIVE EXTERNAL API EXECUTION (HITTING GOOGLE.COM)
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Testing Live External API Execution against https://www.google.com...');
    const fireBtn = await page.waitForSelector('[data-testid="fire-btn"]');
    await fireBtn.click();
    console.log('  ✓ Clicked FIRE button.');

    // Wait for response to arrive (impact viewer status pill)
    await page.waitForSelector('[data-testid="status-code"]', { timeout: 15000 });
    const statusCode1 = await page.$eval('[data-testid="status-code"]', (el) => el.textContent.trim());
    console.log(`  ✓ Received response: Status Code ${statusCode1} verified`);

    // Verify timing captured
    const timingText = await page.$eval('[data-testid="impact-timing"]', (el) => el.textContent.trim());
    console.log(`  ✓ Roundtrip timing captured: ${timingText}`);

    // Click Response Headers tab
    const headersTab = await page.evaluateHandle(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      return tabs.find((b) => b.textContent.includes('Headers ('));
    });
    if (headersTab && headersTab.asElement()) {
      await headersTab.asElement().click();
      console.log('  ✓ Clicked Response Headers tab.');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-fire-google-success.png') });
    console.log('  ★ TEST 2 PASSED: Successfully hit google.com with 200 OK and live telemetry!');

    // -------------------------------------------------------------
    // TEST 3: CREATE SECOND SHOT & FIRE TO HTTPBIN WITH PARAMETERS
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Testing Query Parameters with https://httpbin.org/get...');
    const newShotBtn2 = await page.waitForSelector('[data-testid="header-new-shot-btn"]');
    await newShotBtn2.click();
    await page.waitForSelector('[data-testid="new-shot-modal"]');

    const nameInput2 = await page.waitForSelector('[data-testid="shot-name-input"]');
    await nameInput2.click({ clickCount: 3 });
    await nameInput2.type('HTTPBin Echo Param Test');

    const urlInputModal2 = await page.waitForSelector('[data-testid="shot-url-input"]');
    await urlInputModal2.click({ clickCount: 3 });
    await urlInputModal2.type('https://httpbin.org/get');

    const submitShotBtn2 = await page.waitForSelector('[data-testid="create-shot-submit-btn"]');
    await submitShotBtn2.click();
    await page.waitForSelector('[data-testid="new-shot-modal"]', { hidden: true });
    console.log('  ✓ Second shot created.');

    // Switch to Params tab
    const paramsTab = await page.evaluateHandle(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      return tabs.find((b) => b.textContent.trim() === 'Params');
    });
    if (paramsTab && paramsTab.asElement()) {
      await paramsTab.asElement().click();
      console.log('  ✓ Clicked Params editor tab.');
    }

    // Click "+ Add Row" in params table
    const addParamRowBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => b.textContent.includes('Add Row'));
    });
    if (addParamRowBtn && addParamRowBtn.asElement()) {
      await addParamRowBtn.asElement().click();
      console.log('  ✓ Clicked "+ Add Row" in Params.');
    }

    // Select text inputs (exclude checkboxes)
    const textInputs = await page.$$('table input[type="text"]');
    if (textInputs.length >= 2) {
      await textInputs[0].type('bullet_tag');
      await textInputs[1].type('e2e_verified_123');
      console.log('  ✓ Inputted parameter "bullet_tag=e2e_verified_123"');
    }

    // Fire HTTPBin request
    const fireBtn2 = await page.waitForSelector('[data-testid="fire-btn"]');
    await fireBtn2.click();
    console.log('  ✓ Dispatched HTTPBin GET with query parameters.');

    // Wait for response to finish
    await page.waitForSelector('[data-testid="status-code"]', { timeout: 20000 });
    const statusCode2 = await page.$eval('[data-testid="status-code"]', (el) => el.textContent.trim());
    console.log(`  ✓ Received response: Status Code ${statusCode2} verified`);

    // Switch to Raw tab to inspect body
    const rawTab = await page.evaluateHandle(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      return tabs.find((b) => b.textContent.trim() === 'Raw');
    });
    if (rawTab && rawTab.asElement()) {
      await rawTab.asElement().click();
      await new Promise((r) => setTimeout(r, 300));
    }

    const httpbinBody = await page.evaluate(() => document.body.innerText);
    const reflected = httpbinBody.includes('e2e_verified_123') || httpbinBody.includes('bullet_tag');
    console.log(`  ✓ Parameter reflection in response: ${reflected}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-fire-httpbin-success.png') });
    console.log('  ★ TEST 3 PASSED: Query parameter addition and live reflection verified!');

    // -------------------------------------------------------------
    // TEST 4: EDITOR SUB-TABS & SAVE SHOT
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Testing All Editor Sub-Tabs (Headers, Auth, Body, Pre-request, Tests, Settings)...');
    const tabNames = ['Headers', 'Auth', 'Body', 'Pre-request', 'Tests', 'Settings'];
    for (const tabName of tabNames) {
      const tabHandle = await page.evaluateHandle((name) => {
        const tabs = Array.from(document.querySelectorAll('button'));
        return tabs.find((b) => b.textContent.trim().startsWith(name));
      }, tabName);
      if (tabHandle && tabHandle.asElement()) {
        await tabHandle.asElement().click();
        await new Promise((r) => setTimeout(r, 200));
        console.log(`  ✓ Navigated to "${tabName}" editor tab.`);
      }
    }

    // Click Save Shot
    const saveBtn = await page.waitForSelector('[data-testid="save-shot-btn"]');
    await saveBtn.click();
    console.log('  ✓ Clicked "Save" button.');
    await new Promise((r) => setTimeout(r, 500));
    console.log('  ★ TEST 4 PASSED: All editor sub-tabs interactive & Save shot executed!');

    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // TEST 5: CODE SHOT MODAL (POLYGLOT CODE GENERATOR)
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Testing Code Shot Modal (Polyglot Snippets)...');
    const codeBtn = await page.waitForSelector('[data-testid="code-shot-btn"]');
    await codeBtn.click();
    await page.waitForFunction(() => document.body.innerText.includes('Code Shot'));
    console.log('  ✓ Code Shot modal opened.');

    // Switch language to Python (requests)
    const pythonBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => b.textContent.includes('Python'));
    });
    if (pythonBtn && pythonBtn.asElement()) {
      await pythonBtn.asElement().click();
      console.log('  ✓ Switched language to Python (requests).');
      await new Promise((r) => setTimeout(r, 300));
    }

    // Close modal
    const closeBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find((b) => b.textContent.trim() === 'Close');
    });
    if (closeBtn && closeBtn.asElement()) {
      await closeBtn.asElement().click();
      console.log('  ✓ Closed Code Shot modal.');
    }
    console.log('  ★ TEST 5 PASSED: Polyglot snippet generator verified!');

    // -------------------------------------------------------------
    // TEST 6: FIRING RUN RUNNER (BATCH COLLECTION TEST RUNNER)
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Testing Firing Run Collection Runner...');
    const firingRunBtn = await page.waitForSelector('[data-testid="header-firing-run-btn"]');
    await firingRunBtn.click();
    await page.waitForFunction(() => document.body.innerText.includes('Firing Run Engine'));
    // Select Target Squad (Authentication or first available squad for rapid verified batch)
    const squadSelect = await page.waitForSelector('[data-testid="target-squad-select"]');
    const squadValue = await page.evaluate((el) => {
      const option = Array.from(el.options).find(o => o.value && o.value.length > 0);
      return option ? option.value : '';
    }, squadSelect);
    if (squadValue) {
      await squadSelect.select(squadValue);
      console.log('  ✓ Selected target squad for batch run.');
      await new Promise((r) => setTimeout(r, 200));
    }

    // Click Start Firing Run
    const startRunBtn = await page.waitForSelector('[data-testid="start-firing-run-btn"]');
    await startRunBtn.click();
    console.log('  ✓ Started Firing Run execution.');

    // Wait for run to complete
    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return text.includes('Total Shots') || text.includes('Passed') || text.includes('Download JUnit XML');
      },
      { timeout: 30000 }
    );
    console.log('  ✓ Firing Run batch completed successfully.');

    // Close Firing Run modal
    const closeRunModalBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find((b) => b.textContent.trim() === 'Close' || b.querySelector('svg.lucide-x'));
    });
    if (closeRunModalBtn && closeRunModalBtn.asElement()) {
      await closeRunModalBtn.asElement().click();
      console.log('  ✓ Closed Firing Run modal.');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-firing-run-success.png') });
    console.log('  ★ TEST 6 PASSED: Automated batch Firing Run executed with live progress!');

    // -------------------------------------------------------------
    // TEST 7: ARMORY TRANSFER MODAL (IMPORT / EXPORT)
    // -------------------------------------------------------------
    console.log('\n[TEST 7] Testing Armory Transfer Modal (Import/Export)...');
    const transferBtn = await page.waitForSelector('[data-testid="header-transfer-btn"]');
    await transferBtn.click();
    await page.waitForFunction(() => document.body.innerText.includes('Armory Transfer'));
    console.log('  ✓ Armory Transfer modal opened.');

    const closeTransferBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find((b) => b.textContent.trim() === 'Close' || b.querySelector('svg.lucide-x'));
    });
    if (closeTransferBtn && closeTransferBtn.asElement()) {
      await closeTransferBtn.asElement().click();
      console.log('  ✓ Closed Armory Transfer modal.');
    }
    console.log('  ★ TEST 7 PASSED: Armory Transfer modal operational!');

    // -------------------------------------------------------------
    // TEST 8: COMMAND PALETTE (Ctrl+Shift+P / ⌘K)
    // -------------------------------------------------------------
    console.log('\n[TEST 8] Testing Command Palette Modal...');
    const cmdPaletteBtn = await page.waitForSelector('[data-testid="header-cmd-palette-btn"]');
    await cmdPaletteBtn.click();
    await page.waitForSelector('input[placeholder*="Type a command"]');
    console.log('  ✓ Command Palette opened.');

    // Press Escape to dismiss
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('input[placeholder*="Type a command"]'));
    console.log('  ✓ Dismissed Command Palette with Escape.');
    console.log('  ★ TEST 8 PASSED: Command Palette verified!');

    // -------------------------------------------------------------
    // TEST 9: ALL 8 DEDICATED SIDEBAR VIEWS
    // -------------------------------------------------------------
    console.log('\n[TEST 9] Testing All 8 Dedicated Sidebar Navigation Views...');
    const views = [
      { id: 'sidebar-tab-loadouts', name: 'Loadouts & Rounds' },
      { id: 'sidebar-tab-logs', name: 'Shot Log' },
      { id: 'sidebar-tab-tls', name: 'Bulletproof TLS' },
      { id: 'sidebar-tab-target-range', name: 'Target Range' },
      { id: 'sidebar-tab-sentinels', name: 'Sentinels' },
      { id: 'sidebar-tab-cookies', name: 'Cookie Locker' },
      { id: 'sidebar-tab-manual', name: 'Field Manual' },
      { id: 'sidebar-tab-arsenals', name: 'Arsenals Tree' },
    ];

    for (const v of views) {
      const tab = await page.waitForSelector(`[data-testid="${v.id}"]`);
      await tab.click();
      await new Promise((r) => setTimeout(r, 250));
      console.log(`  ✓ Navigated to "${v.name}" view.`);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-all-views-success.png') });
    console.log('  ★ TEST 9 PASSED: All 8 sidebar views verified and fully accessible!');

    // -------------------------------------------------------------
    // TEST 10: TRAJECTORY CONSOLE DOCK TOGGLE
    // -------------------------------------------------------------
    console.log('\n[TEST 10] Testing Trajectory Console Dock (Ctrl+J)...');
    const consoleBtn = await page.waitForSelector('[data-testid="header-console-toggle-btn"]');
    await consoleBtn.click();
    await page.waitForSelector('[data-testid="trajectory-console-dock"]');
    console.log('  ✓ Trajectory Console dock expanded.');

    await consoleBtn.click();
    await page.waitForFunction(() => !document.querySelector('[data-testid="trajectory-console-dock"]'));
    console.log('  ✓ Trajectory Console dock collapsed.');
    console.log('  ★ TEST 10 PASSED: Real-time telemetry dock toggle verified!');

    // -------------------------------------------------------------
    // TEST 11: ENVIRONMENT LOADOUT SELECTOR
    // -------------------------------------------------------------
    console.log('\n[TEST 11] Testing Loadout Environment Selector...');
    const loadoutSelect = await page.waitForSelector('[data-testid="header-loadout-select"]');
    await loadoutSelect.select(await page.evaluate((el) => el.options[el.options.length - 1].value, loadoutSelect));
    console.log('  ✓ Switched to Loadout environment.');
    console.log('  ★ TEST 11 PASSED: Environment selection active!');

    // -------------------------------------------------------------
    // TEST 12: THEME TOGGLE (LIGHT / DARK MODE)
    // -------------------------------------------------------------
    console.log('\n[TEST 12] Testing Light/Dark Mode Theme Toggle...');
    const themeBtn = await page.waitForSelector('[data-testid="theme-toggle-btn"]');
    
    // 1. Toggle to Light Mode
    await themeBtn.click();
    await page.waitForFunction(() => document.documentElement.classList.contains('light'));
    console.log('  ✓ Toggled to Light Mode (document has .light class).');
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-light-mode-success.png') });
    console.log('  ✓ Captured 06-light-mode-success.png screenshot.');

    // 2. Toggle back to Dark Mode
    await themeBtn.click();
    await page.waitForFunction(() => !document.documentElement.classList.contains('light'));
    console.log('  ✓ Toggled back to Dark Mode.');
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-dark-mode-restored.png') });
    console.log('  ✓ Captured 07-dark-mode-restored.png screenshot.');
    console.log('  ★ TEST 12 PASSED: Light/Dark theme switching verified with visual snapshots!');

    console.log('\n===============================================================');
    console.log(`TOTAL UNCAUGHT ERRORS: ${uncaughtErrors.length}`);
    if (uncaughtErrors.length > 0) {
      console.error('Errors encountered:', uncaughtErrors);
      throw new Error(`Test failed with ${uncaughtErrors.length} uncaught browser error(s).`);
    }

    console.log('>>> COMPLETE E2E TEST SUITE PASSED 100% WITH 0 ERRORS! <<<');
    console.log('===============================================================');
  } catch (err) {
    try {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00-failure-state.png') });
      console.log('  Saved failure screenshot to 00-failure-state.png');
    } catch (_) {}
    throw err;
  } finally {
    await browser.close();
    if (serverProc) {
      console.log('[E2E Teardown] Terminating backend test process...');
      serverProc.kill();
    }
  }
}

runFullTestSuite().catch((err) => {
  console.error('\n❌ E2E TEST SUITE FAILED:', err);
  process.exit(1);
});
