import { test as base, Page, TestInfo } from '@playwright/test';

export const MAX_SCREENSHOTS_PER_TEST = 5;

type ScreenshotFixture = {
  takeScreenshot: (checkpoint: string) => Promise<void>;
};

function safeName(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

/**
 * Captures screenshots as test attachments and enforces the per-test limit.
 * The counter is created inside the test-scoped fixture, so every test starts at zero.
 */
export const test = base.extend<ScreenshotFixture>({
  takeScreenshot: async ({ page }, use, testInfo: TestInfo) => {
    let screenshotCount = 0;

    const takeScreenshot = async (checkpoint: string): Promise<void> => {
      if (screenshotCount >= MAX_SCREENSHOTS_PER_TEST) {
        return;
      }

      screenshotCount += 1;
      const screenshotName = `screenshot-${screenshotCount}-${safeName(checkpoint) || 'checkpoint'}`;

      await testInfo.attach(screenshotName, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    };

    await use(takeScreenshot);

    // Always retain the final state, unless the limit has already been reached.
    await takeScreenshot('final');
  },
});

export { expect } from '@playwright/test';
export type { Page };
