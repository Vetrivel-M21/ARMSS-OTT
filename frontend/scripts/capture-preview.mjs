import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  
  console.log("Waiting for profile picker...");
  const miraBtn = page.locator('button:has-text("Mira")').first();
  await miraBtn.waitFor({ state: "visible", timeout: 20000 });
  console.log("Mira button is visible, clicking it...");
  await miraBtn.click();
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: "app_preview.png" });
  console.log("Saved app_preview.png successfully");
  await browser.close();
}

main().catch(console.error);
