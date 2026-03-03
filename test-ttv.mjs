import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false }); // visible untuk debug
const context = await browser.newContext();
const page = await context.newPage();

// Login
await page.goto('http://localhost:7000');
await page.waitForTimeout(2000);
await page.fill('input[placeholder="contoh: ferdi"]', 'ferdi');
await page.fill('input[placeholder="masukkan password"]', 'fer123456');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

console.log('URL setelah login:', page.url());

// Buka EMR
await page.goto('http://localhost:7000/emr');
await page.waitForTimeout(3000);
console.log('URL EMR:', page.url());

const getVitals = async () =>
  await page.evaluate(() =>
    Array.from(document.querySelectorAll('.vitals-matrix input')).map(i => i.value).join(' | ')
  );

console.log('Vitals awal:', await getVitals());

// Klik HIPERTENSI
await page.click('button:has-text("HIPERTENSI")');
await page.waitForTimeout(300);
const v1 = await getVitals();
console.log('Setelah HT  :', v1);

// Klik HIPOGLIKEMIA
await page.click('button:has-text("HIPOGLIKEMIA")');
await page.waitForTimeout(300);
const v2 = await getVitals();
console.log('Setelah HIPO:', v2);

// Klik HIPERTENSI lagi
await page.click('button:has-text("HIPERTENSI")');
await page.waitForTimeout(300);
const v3 = await getVitals();
console.log('HT lagi     :', v3);

console.log('\nHT vs HIPO beda?', v1 !== v2 ? 'YA ✓' : 'TIDAK ✗');
console.log('HT tiap klik beda?', v1 !== v3 ? 'YA ✓' : 'TIDAK ✗');

await browser.close();
