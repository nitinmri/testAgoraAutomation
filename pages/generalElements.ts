import { expect, Page } from '@playwright/test'
export class generalElements{
    readonly page: Page;
    readonly headerTitle ='header h1'
  readonly askAgoraWidget = '#agWidget'
  readonly bottomRightWidget='.minimized-container'
  readonly askAgoraModal = 'div[class="chat-window-container"]'
  readonly askAgoraModallandingtext='h2[class="landing-title"]'
  readonly helpAndSupportButton='button[class="category-bucket"]'
  readonly askAgoraModalheader='header[class="ask-agora-header"]'
  readonly askAgoraDragHandle='[aria-label="Drag to move Ask Agora container"]'
  readonly askAgoraPinButton='.ask-agora-header .pin-button'
  readonly askAgoraCloseButton='.ask-agora-header .close-button'
  readonly askAgoraCategoryButton='.ask-ai-container .category-bucket'
  readonly askAgoraNewChatButton='button[class="chat-window-input-controls-button"]'
  readonly askAgoraHistoryButton='button[class="chat-window-input-controls-button history-button"]'
  readonly askAgoraPromptInput='textarea.prompt-input'
  readonly placeholdertext='textarea[placeholder="Ask Agora anything..."]'
  readonly sendButton='button[class="send-button"]'
  readonly askAgoraDisclaimer='div[class="chat-window-disclaimer"]'
  readonly responseBodyContainer='div[class="chat-response-body-container"]'
  readonly processingMessage=/Checking if query is suitable|Query is suitable|documentation research phase/i
 
  constructor(page: Page) {
    this.page = page;
  }

  async openAskAgora() {
    await expect(this.page.locator(this.bottomRightWidget)).toBeVisible();
    await this.page.locator(this.bottomRightWidget).click();
    await expect(this.page.locator(this.askAgoraModal)).toBeVisible();
  }

  async askQuestion(question: string): Promise<string> {
    const modal = this.page.locator(this.askAgoraModal);
    await this.page.locator(this.askAgoraPromptInput).fill(question);
    await expect(this.page.locator(this.sendButton)).toBeEnabled();
    await this.page.locator(this.sendButton).click();
    await this.page.waitForTimeout(1000);
    // The widget disables the input while the response is being generated.
    await expect(this.page.locator(this.askAgoraPromptInput)).toBeDisabled({
      timeout: 60_000,
    });
    await expect(modal.getByText(this.processingMessage).first()).toBeHidden({
      timeout: 60_000,
    }); 
    await this.page.waitForSelector(this.responseBodyContainer)
    await expect(this.page.locator(this.responseBodyContainer)).toBeVisible()
    await this.page.waitForTimeout(5000)
    const responseBodies = modal.locator(this.responseBodyContainer);
    const answer = responseBodies.last();
    await expect(answer).toBeVisible({ timeout: 60_000 });
    await expect(answer).not.toHaveText('', { timeout: 60_000 });
    const answerText = (await answer.innerText()).trim();
    expect(answerText, 'Ask Agora did not render an answer').not.toBe('');
    return answerText;
  }

}
