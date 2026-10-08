import { Page } from '@playwright/test';
import { LoginPage } from '../pages/loginPage';

export async function restoreOrLogin(page: Page): Promise<void> {
  if (page.isClosed()) {
    throw new Error('Page is closed during session restoration.');
  }

  await new LoginPage(page).restoreSession();
}
