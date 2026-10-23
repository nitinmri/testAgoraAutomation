import { expect, Locator, Page } from '@playwright/test'
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
readonly askAgorabutton='ask-ai-sparkle-button[id="sparkle-button-container"]'

  constructor(page: Page) {
    this.page = page;
  }

  async openAskAgora() {
    await expect(this.page.locator(this.bottomRightWidget)).toBeVisible();
    await this.page.locator(this.bottomRightWidget).click();
    await expect(this.page.locator(this.askAgoraModal)).toBeVisible();
  }

  async askQuestion(question: string): Promise<string> {
    const { answer } = await this.askQuestionWithLatency(question);
    return answer;
  }

  async askQuestionWithLatency(
    question: string,
  ): Promise<{ answer: string; latencyMs: number; totalTimeMs: number }> {
    const modal = this.page.locator(this.askAgoraModal);
    const responseCountBeforeSubmit = await modal.locator(this.responseBodyContainer).count();
    const errorCountBeforeSubmit = await modal.locator(this.errorContainer).count();
    const response = modal.locator(this.responseBodyContainer).nth(responseCountBeforeSubmit);
    const error = modal.locator(this.errorContainer).nth(errorCountBeforeSubmit);
    await this.page.locator(this.askAgoraPromptInput).fill(question);
    await expect(this.page.locator(this.sendButton)).toBeEnabled();
    const requestStartedAt = performance.now();
    await this.page.locator(this.sendButton).click();
    await Promise.race([
      response.waitFor({ state: 'visible', timeout: 60_000 }).catch(() => undefined),
      error.waitFor({ state: 'visible', timeout: 60_000 }).catch(() => undefined),
    ]);

    if (await response.isVisible()) {
      return this.waitForResponseCompletion(response, requestStartedAt);
    }

    if (await error.isVisible()) {
      const errorText = (await modal.locator(this.errortext).nth(errorCountBeforeSubmit).innerText()).trim();
      expect(errorText, 'Ask Agora error response did not include error text').not.toBe('');
      const totalTimeMs = performance.now() - requestStartedAt;
      return { answer: errorText, latencyMs: totalTimeMs, totalTimeMs };
    }

    throw new Error('Ask Agora rendered neither an answer nor an error response.');
  }

  private async waitForResponseCompletion(
    response: Locator,
    requestStartedAt: number,
  ): Promise<{ answer: string; latencyMs: number; totalTimeMs: number }> {
    const timeoutAt = requestStartedAt + 60_000;
    let answer = '';
    let latencyMs: number | undefined;
    let lastChangedAt = requestStartedAt;

    while (performance.now() < timeoutAt) {
      const currentText = (await response.innerText()).trim();
      const now = performance.now();

      if (currentText && latencyMs === undefined) {
        latencyMs = now - requestStartedAt;
      }

      if (currentText !== answer) {
        answer = currentText;
        lastChangedAt = now;
      } else if (answer && now - lastChangedAt >= 1_000) {
        if (latencyMs === undefined) {
          throw new Error('Ask Agora response generation did not start.');
        }
        return {
          answer,
          latencyMs,
          totalTimeMs: now - requestStartedAt,
        };
      }

      await this.page.waitForTimeout(100);
    }

    throw new Error('Ask Agora response did not finish generating within 60 seconds.');
  }
  
  async askQuestionFordocBot(question: string): Promise<string> {
    const responses = this.page.locator(this.docBotresponseBodyContainer);
    const responseCountBeforeSubmit = await responses.count();
    const response = responses.nth(responseCountBeforeSubmit);
    await this.page.locator(this.inputForDocNot).fill(question);
    await expect(this.page.locator(this.docBotSubmitButton)).toBeEnabled();
    await this.page.locator(this.docBotSubmitButton).click();

    await response.waitFor({ state: 'visible', timeout: 60_000 });

    await expect(response).not.toHaveText('', { timeout: 60_000 });
    await this.page.waitForTimeout(5000);
    const answerText = (await response.innerText()).trim();
    expect(answerText, 'DocBot did not render an answer').not.toBe('');
    return answerText;
  }
  async OpenAskAgoraForFormsIntelligence(){
    await expect(this.page.locator(this.askAgorabutton)).toBeVisible();
    await this.page.locator(this.askAgorabutton).click();
    const modal = this.page.locator(this.askAgoraModal);
    try {
      await modal.waitFor({ state: 'visible', timeout: 5000 });
      return;
    } catch {
      const minimizedWidget = this.page.locator(this.bottomRightWidget);
      await expect(minimizedWidget).toBeVisible();
      await minimizedWidget.click();
      await expect(modal).toBeVisible();
    }
  }

}
