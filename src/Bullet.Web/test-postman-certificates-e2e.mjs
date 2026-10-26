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

const BROWSER_PATH = KNOWN_PATHS.find(p => fs.existsSync(p));
const APP_URL = 'http://127.0.0.1:5000';
const ARTIFACTS_DIR = 'C:\\Users\\visha\\.gemini\\antigravity\\brain\\1925c293-76e8-4aaf-a212-5f1f0c7051a6';
const LOCAL_SCREENSHOTS_DIR = path.resolve('e2e-screenshots');

if (!fs.existsSync(LOCAL_SCREENSHOTS_DIR)) {
  fs.mkdirSync(LOCAL_SCREENSHOTS_DIR, { recursive: true });
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
    ['run', '--project', 'src/Bullet.Api', '--no-launch-profile', '--', '--urls', APP_URL],
    {
      cwd: repoRoot,
      stdio: 'pipe',
      env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development' },
    }
  );

  serverProc.stdout.on('data', (d) => {
    const msg = d.toString();
    if (msg.includes('Now listening on:')) {
      console.log('   [Server Output]', msg.trim());
    }
  });

  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await checkServerReady()) {
      console.log('[E2E Setup] Backend server is up and responsive!');
      return serverProc;
    }
  }

  throw new Error('Timed out waiting for backend server to start');
}

async function runTest() {
  console.log('===============================================================');
  console.log('🚀 [E2E] Verifying Postman-Parity Certificate Importing & mTLS');
  console.log('===============================================================');

  let serverProc = null;
  let browser = null;

  try {
    serverProc = await ensureBackendRunning();

    console.log(`[Browser] Launching executable at: ${BROWSER_PATH}`);
    browser = await puppeteer.launch({
      executablePath: BROWSER_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // 1. Navigate to Bullet app
    console.log('\n[Step 1] Navigating to http://127.0.0.1:5000...');
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 30000 });

    // Handle Opening Bullet Firing Intro Splash if rendered
    const introSplash = await page.$('[data-testid="bullet-intro-splash"]');
    if (introSplash) {
      console.log('   ✓ Animated Bullet Firing Intro Splash detected, dismissing...');
      const dismissBtn = await page.$('[data-testid="dismiss-intro-btn"]');
      if (dismissBtn) {
        await dismissBtn.click().catch(() => {});
      }
      await page.waitForSelector('[data-testid="bullet-intro-splash"]', { hidden: true, timeout: 5000 }).catch(() => {});
    }

    await page.waitForSelector('[data-testid="header-new-shot-btn"]', { timeout: 10000 });
    console.log('   ✓ Bullet app loaded and workspace ready.');

    // 2. Click on Certificates sidebar tab
    console.log('\n[Step 2] Navigating to Certificates & TLS view...');
    const tlsTab = await page.waitForSelector('[data-testid="sidebar-tab-tls"]', { timeout: 10000 });
    await tlsTab.click();
    await new Promise((r) => setTimeout(r, 1200));

    // Wait for Certificates view
    await page.waitForFunction(() => document.body.innerText.includes('CA Certificates'), { timeout: 8000 });
    console.log('   ✓ Certificates & Bulletproof TLS view loaded.');

    // 3. Test CA Toggle Switch
    console.log('\n[Step 3] Testing CA Certificate Verification Toggle Switch...');
    const caToggleBtn = await page.waitForSelector('button[title*="CA Certificate"]');
    await caToggleBtn.click();
    await new Promise((r) => setTimeout(r, 800));

    const toggleText = await page.evaluate(() => document.body.innerText);
    const caEnabled = toggleText.includes('Enabled');
    console.log(`   ✓ CA toggle switched: Status = ${caEnabled ? 'Enabled' : 'Disabled'}`);

    // Screenshot initial state
    const caScreenPath = path.join(LOCAL_SCREENSHOTS_DIR, '36-postman-certificates-view.png');
    await page.screenshot({ path: caScreenPath });
    if (fs.existsSync(ARTIFACTS_DIR)) {
      fs.copyFileSync(caScreenPath, path.join(ARTIFACTS_DIR, '36-postman-certificates-view.png'));
    }
    console.log(`   ✓ Saved screenshot to: ${caScreenPath}`);

    // 4. Test "Add Client Certificate" Modal
    console.log('\n[Step 4] Opening "Add Client Certificate" modal...');
    const addCertButtons = await page.$$('button');
    let addBtn = null;
    for (const b of addCertButtons) {
      const text = await (await b.getProperty('innerText')).jsonValue();
      if (text.includes('Add Client Certificate') || text.includes('Add Certificate')) {
        addBtn = b;
        break;
      }
    }

    if (!addBtn) throw new Error('Could not find Add Certificate button');
    await addBtn.click();
    await new Promise((r) => setTimeout(r, 800));

    // Check modal opened
    const modalOpened = await page.evaluate(() => document.body.innerText.includes('Add Client Certificate'));
    if (!modalOpened) throw new Error('Add Client Certificate modal did not open!');
    console.log('   ✓ Modal opened cleanly.');

    // Fill in Host, Port, Profile Name, Passphrase
    console.log('\n[Step 5] Entering Certificate metadata (Host, Port, Passphrase)...');
    const hostInput = await page.waitForSelector('[data-testid="tls-host-pattern-input"]');
    await hostInput.click({ clickCount: 3 });
    await hostInput.type('api.internal.bank.com');

    const portInput = await page.$('input[placeholder="e.g. 443"]');
    if (portInput) {
      await portInput.type('8443');
    }

    const nameInput = await page.waitForSelector('[data-testid="tls-profile-name-input"]');
    await nameInput.type('Banking Core API mTLS');

    // Switch between PFX and CRT tabs to verify both render
    console.log('   ✓ Switching tabs: PFX <-> CRT/PEM...');
    const crtTab = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('CRT / PEM'));
    });
    if (crtTab && crtTab.asElement()) {
      await crtTab.asElement().click();
      await new Promise((r) => setTimeout(r, 400));
    }

    const pfxTab = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('PFX / PKCS#12'));
    });
    if (pfxTab && pfxTab.asElement()) {
      await pfxTab.asElement().click();
      await new Promise((r) => setTimeout(r, 400));
    }

    // Enter passphrase
    const passInput = await page.$('input[placeholder*="PFX password"]');
    if (passInput) {
      await passInput.type('ProductionSecretPassphrase123!');
    }

    const modalScreenPath = path.join(LOCAL_SCREENSHOTS_DIR, '37-add-certificate-modal.png');
    await page.screenshot({ path: modalScreenPath });
    if (fs.existsSync(ARTIFACTS_DIR)) {
      fs.copyFileSync(modalScreenPath, path.join(ARTIFACTS_DIR, '37-add-certificate-modal.png'));
    }
    console.log(`   ✓ Saved modal screenshot to: ${modalScreenPath}`);

    // Submit certificate
    console.log('\n[Step 6] Saving Client Certificate...');
    const saveBtn = await page.waitForSelector('[data-testid="save-tls-profile-btn"]');
    await saveBtn.click();
    await new Promise((r) => setTimeout(r, 1200));

    // 5. Verify certificate appears in list
    console.log('\n[Step 7] Verifying Client Certificate card in list...');
    await page.waitForFunction(() => document.body.innerText.includes('api.internal.bank.com'), { timeout: 5000 });
    const listText = await page.evaluate(() => document.body.innerText);
    
    if (listText.includes('api.internal.bank.com') && listText.includes('8443')) {
      console.log('   ✓ Certificate card verified with Host "api.internal.bank.com" and Port "8443"!');
    } else {
      throw new Error('Certificate card not found in list after saving!');
    }

    const finalListScreenPath = path.join(LOCAL_SCREENSHOTS_DIR, '38-certificates-list-verified.png');
    await page.screenshot({ path: finalListScreenPath });
    if (fs.existsSync(ARTIFACTS_DIR)) {
      fs.copyFileSync(finalListScreenPath, path.join(ARTIFACTS_DIR, '38-certificates-list-verified.png'));
    }
    console.log(`   ✓ Saved final verified screenshot to: ${finalListScreenPath}`);

    console.log('\n===============================================================');
    console.log('🎉 [SUCCESS] Postman-Parity Certificate Management Verified End-to-End!');
    console.log('===============================================================');

  } catch (err) {
    console.error('❌ E2E Verification failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (serverProc) {
      console.log('[Cleanup] Stopping backend server process...');
      serverProc.kill();
    }
  }
}

runTest();
