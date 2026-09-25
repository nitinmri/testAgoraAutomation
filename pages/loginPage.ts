import {Page} from '@playwright/test'
import fs from 'fs'
import { loginCreds } from '../data/loginCreds'

export class LoginPage{
    readonly page: Page;
    readonly clientID ="input[id=MriClientId]"
readonly signinButton='[id=loginButton]';
readonly loginButton = 'button[type="submit"]';
readonly errorMessage='.error-message';
readonly mriSaaSoktaPreviewOptionButton= "[id='urn:mri:auth:proxy:link:redirect']";
readonly signInWithEmailField ='input[id="email"]';
  readonly emailField = "[autocomplete='username']";
  readonly passwordField="[autocomplete='current-password']";
  readonly signInButtonForOkta="[data-type='save']";
  readonly checkbox='input[type="checkbox"]';
  readonly needHelpLink='[data-se="needhelp"]';
  readonly autoPush='input[name="autoPush"]'
readonly rememberMe='input[name="rememberDevice"]'
readonly sendPushButon='input[value="Send Push"]'
readonly signInEmailIDfieldTwo='input[name="email"]';
readonly signInButtonTwo='button[id="loginPopupContinue"]'
  constructor(page: Page) {
    this.page = page;

  }

  async login() { 
    await this.page.goto(loginCreds.Url,{ waitUntil:'domcontentloaded' });
  // await this.page.fill(this.clientID, loginCredentials.clientID);
  // await this.page.click(this.signinButton);
  //await this.page.click(this.mriSaaSoktaPreviewOptionButton);
  await this.page.locator(this.signInWithEmailField).or(this.page.locator(this.signInEmailIDfieldTwo)).first().fill(loginCreds.userName)
  await this.page.locator(this.signinButton).or(this.page.locator(this.signInButtonTwo)).first().click()
//  await this.page.click(this.signinButton);
  await this.page.fill(this.emailField, loginCreds.userName);
  await this.page.fill(this.passwordField, loginCreds.password);
  await this.page.click(this.signInButtonForOkta);
  /* 3 lines are for the session cookies*/
// await  this.page.getByText('Send push automatically').click();
// await this.page.getByText('Do not challenge me on this').click();
 await this.page.locator(this.sendPushButon).click();
 await this.page.waitForTimeout(3000);
    await this.page.waitForSelector('.minimized-container', { state: 'visible' });
      /* get session cookies*/
    // Get session cookies
    const cookies = await this.page.context().cookies();

    // Optionally, get localStorage/sessionStorage if needed
    const localStorage = await this.page.evaluate(() => Object.assign({}, window.localStorage));
    const sessionStorage = await this.page.evaluate(() => Object.assign({}, window.sessionStorage));

    // Store session data as needed (e.g., in a file or variable)
    // Example: Write to a JSON file
    fs.writeFileSync('sessionData.json', JSON.stringify({ cookies, localStorage, sessionStorage }));
    return { cookies, localStorage, sessionStorage };
  }

 async restoreSession() {
  const session = JSON.parse(fs.readFileSync('sessionData.json','utf-8'));

  // Restore cookies
  await this.page.context().addCookies(session.cookies);

  // Go to base URL before setting local/session storage
  await this.page.goto(loginCreds.Url,{ waitUntil: 'domcontentloaded' });
  // Restore storage
  await this.page.evaluate(([local, sessionData]) => {
    Object.entries(local).forEach(([key, value]) => localStorage.setItem(String(key), String(value)));
    Object.entries(sessionData).forEach(([key, value]) => sessionStorage.setItem(String(key), String(value)));
  }, [session.localStorage, session.sessionStorage]);

  // Reload to apply restored state
  await this.page.reload();

  // Confirm login was successful
  await this.page.waitForSelector('.minimized-container', { state: 'visible' });

}

}
