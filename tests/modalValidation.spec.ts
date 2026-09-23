import { test, expect } from '../utils/fixtures'
import { generalElements } from '../pages/generalElements'
import { restoreOrLogin } from '../utils/sessionManager';

let general: generalElements;

test.describe('basic Validations for Ask Agora widget Modal', () => {
  test.beforeEach(async ({ page, takeScreenshot }) => {
    general = new generalElements(page);
    await restoreOrLogin(page);
    await page.waitForLoadState('domcontentloaded');
    await takeScreenshot('authenticated');
  })

  test('validate the bottom right corner Modal', { tag: ['@Smoketest'] }, async ({ page, takeScreenshot }) => {
    await expect(page.locator(general.bottomRightWidget)).toBeVisible()
    await takeScreenshot('widget-visible');
    await expect(page.locator(general.bottomRightWidget)).toHaveRole('button')
    await page.locator(general.bottomRightWidget).click()
    await expect(page.locator(general.askAgoraModal)).toBeVisible();
    await takeScreenshot('modal-open');
    await expect(page.locator(general.askAgoraModalheader)).toBeVisible()
    // await expect(page.locator(general.askAgoraModallandingtext)).toContainText('')
  })

  

})