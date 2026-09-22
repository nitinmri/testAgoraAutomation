import { LoginPage } from '../pages/loginPage'
import fs from 'fs' 
const sessionFile = 'sessionData.json';
export async function restoreOrLogin(page: any) {
  const loginPage = new LoginPage(page);
  const sessionExists = fs.existsSync(sessionFile);
  let sessionRestored = false;
  if (sessionExists && !page.isClosed()) {
    try {
      await loginPage.restoreSession();
      sessionRestored = true;
    } catch (error) {
      console.warn('Session restore failed, deleting invalid session file and falling back to login.', error);
      // Delete the invalid session file
      try {
        fs.unlinkSync(sessionFile);
      } catch (unlinkError) {
        console.warn('Failed to delete session file:', unlinkError);
      }
    }
  } else {
    console.log('No session file exists or page is closed, skipping restoration.');
  }
  // Always perform fresh login to avoid session-related page closures
  if (!sessionRestored && !page.isClosed()) {
    console.log("Performing fresh login...");
    try {
      console.log('Calling loginPage.login()...');
      await loginPage.login();
      console.log('Login completed.');
    } catch (error) {
      console.error('Login failed:', error);
      throw error; // Re-throw to fail the test
    }
  } else if (page.isClosed()) {
    console.error('Page is closed, cannot proceed with login.');
    throw new Error('Page is closed during session management.');
  }
}
