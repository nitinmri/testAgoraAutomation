import { chromium, type FullConfig } from '@playwright/test';
import { LoginPage } from '../pages/loginPage';

export default async function globalSetup(config: FullConfig): Promise<void> {
  const projectUse = config.projects[0]?.use;
  const browser = await chromium.launch({ headless: projectUse?.headless ?? false });
  let context = await browser.newContext({
    ignoreHTTPSErrors: projectUse?.ignoreHTTPSErrors ?? false,
  });

  try {
    let page = await context.newPage();
    const loginPage = new LoginPage(page);

    try {
      await loginPage.restoreSession();
      console.log('Existing authenticated session validated before workers start.');
    } catch (error) {
      console.log('Saved session is missing or invalid; refreshing it once before workers start.');
      await context.close();
      context = await browser.newContext({
        ignoreHTTPSErrors: projectUse?.ignoreHTTPSErrors ?? false,
      });
      page = await context.newPage();
      await new LoginPage(page).login();
      console.log('Authenticated session saved for parallel workers.');
    }
  } finally {
    await context.close();
    await browser.close();
  }
}