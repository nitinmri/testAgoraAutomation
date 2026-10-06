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
  readonly errorContainer='div[class="ask-ai-error-response-container"]'
  readonly errortext='div[class="ask-ai-error-response-container"] div[class="ask-ai-error-response-container-error-message"]'
  readonly wentWrong='div[class="ask-ai-error-response-container"] div[class="ask-ai-error-response-container-error-message"] h1'
  readonly errorDetail='div[class="ask-ai-error-response-container"] div[class="ask-ai-error-response-container-error-message"] p'
  readonly docBotresponseBodyContainer='app-botmessage div[class="message-content"]'
readonly docBotSubmitButton='button[class="submit-button"]'
  readonly inputForDocNot='div[class="input-row"] textarea'

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
    const responseCountBeforeSubmit = await modal.locator(this.responseBodyContainer).count();
    const errorCountBeforeSubmit = await modal.locator(this.errorContainer).count();
    const response = modal.locator(this.responseBodyContainer).nth(responseCountBeforeSubmit);
    const error = modal.locator(this.errorContainer).nth(errorCountBeforeSubmit);

    await this.page.locator(this.askAgoraPromptInput).fill(question);
    await expect(this.page.locator(this.sendButton)).toBeEnabled();
    await this.page.locator(this.sendButton).click();

    await Promise.race([
      response.waitFor({ state: 'visible', timeout: 60_000 }).catch(() => undefined),
      error.waitFor({ state: 'visible', timeout: 60_000 }).catch(() => undefined),
    ]);

    if (await response.isVisible()) {
      await this.page.waitForTimeout(5000)
      const answerText = (await response.innerText()).trim();
      expect(answerText, 'Ask Agora did not render an answer').not.toBe('');
      return answerText;
    }

    if (await error.isVisible()) {
      const errorText = (await modal.locator(this.errortext).nth(errorCountBeforeSubmit).innerText()).trim();
      expect(errorText, 'Ask Agora error response did not include error text').not.toBe('');
      return errorText;
    }

    throw new Error('Ask Agora rendered neither an answer nor an error response.');
  }
  
  async askQuestionFordocBot(question: string): Promise<string> {
    const modal =  await this.page.locator(this.docBotresponseBodyContainer)
    await this.page.locator(this.inputForDocNot).fill(question);
    await expect(this.page.locator(this.docBotSubmitButton)).toBeEnabled();
    await this.page.locator(this.docBotSubmitButton).click();

    await Promise.race([
      modal.waitFor({ state: 'visible', timeout: 60_000 }).catch(() => undefined),
    ]);

    if (await modal.isVisible()) {
      await this.page.waitForTimeout(5000)
      const answerText = (await modal.innerText()).trim();
      expect(answerText, 'Ask Agora did not render an answer').not.toBe('');
      return answerText;
    }
    throw new Error('Ask Agora rendered neither an answer nor an error response.');
  }
}
