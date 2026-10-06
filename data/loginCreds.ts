
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const getRequiredEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required but was not provided.`);
  }
  return value;
}
type LoginEntry =
  | { type: 'email'; emailSelector: string; submitSelector: string }
  | {
      type: 'clientIdThenEmail';
      clientIdSelector: string;
      clientIdSubmitSelector: string;
      emailSelector: string;
      emailSubmitSelector: string;
    }
  | {
      type: 'usernamePassword';
      usernameField: string;
      passwordField: string;
      submitSelector: string;
    }
  | { type: 'emailFallback' };

const products = {
  angus: {
    url: 'https://qa5.angus-systems.com/web?accountSwitch=true&mri_client_id=MRIQWEB&client=MRIQWEB&env_id=ANGUS-QA5',
    loginEntry: {
      type: 'email',
      emailSelector: 'input[id="email"]',
      submitSelector: '[id="loginButton"]',
    },
  },
  elconnect: {
    url: 'https://engage-resident-back-office-qa.mriengage.com/admin',
    loginEntry: {
      type: 'clientIdThenEmail',
      clientIdSelector: 'div[class="login__form form"] input',
      clientIdSubmitSelector: 'div[class="form-submit sso-btn"] button',
      emailSelector: 'input[id="email"]',
      emailSubmitSelector: '[id="loginButton"]',
    },
  },
  securesign: {
    url: 'https://qasecuresign.ff.mrisoftware.net/secure?widget=packetList',
    loginEntry: {
      type: 'email',
      emailSelector: 'input[name="email"]',
      submitSelector: 'button[id="loginPopupContinue"]',
    },
  },
   elapply: {
    url: 'https://engage-leasing-back-office-qa.mriengage.com/',
    loginEntry: {
      type: 'clientIdThenEmail',
      clientIdSelector: 'div[class="login__form form"] input',
      clientIdSubmitSelector: 'div[class="form-submit sso-btn"] button',
      emailSelector: 'input[id="email"]',
      emailSubmitSelector: '[id="loginButton"]',
    },
  },
   elbroadcast: {
    url: 'https://pricingandavailability-qa.mriengage.com/',
loginEntry: {
      type: 'email',
      emailSelector: 'input[id="email"]',
      submitSelector: '[id="loginButton"]',
    },
  },
   icentral: {
    url: 'https://docbot-sandbox.devtest.mrisoftware.com/?product=investmentcentral',
loginEntry: {
      type: 'email',
      emailSelector: 'input[id="email"]',
      submitSelector: '[id="loginButton"]',
    },
  },
  contractintelligence: {
    url: 'https://platform-ng-edge.dev.leverton.it/view/',
loginEntry: {
      type: 'usernamePassword',
      usernameField:'input[id="username"]',
      passwordField:'input[id="password-field"]',
      submitSelector: 'button[id="mriLogin"]',
    },
  }
} satisfies Record<string, { url: string; loginEntry: LoginEntry }>;

type Environment = keyof typeof products;
const environmentName = (process.env.AGORA_ENV || 'contractintelligence').toLowerCase();
if (!Object.prototype.hasOwnProperty.call(products, environmentName)) {
  throw new Error(`Unsupported AGORA_ENV "${environmentName}". Configure its URL and login entry in data/loginCreds.ts.`);
}
const env = environmentName as Environment;
const product = products[env];
export const loginCreds = {
  environment: env,
  Url: product.url,
  loginEntry: product.loginEntry,
  clientID:
    product.loginEntry.type === 'clientIdThenEmail'
      ? getRequiredEnv('CLIENT_ID')
      : process.env.CLIENT_ID || '',
  oktaUrl: 'https://mrisaas.oktapreview.com/',
  userName: getRequiredEnv('AGORA_USERNAME'),
  password: getRequiredEnv('AGORA_PASSWORD'),
};

