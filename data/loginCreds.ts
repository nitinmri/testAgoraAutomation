
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
const env = (process.env.AGORA_ENV || 'angus').toLowerCase() as 'angus' | 'pmx' | 'horizon' | 'engageAtWork' ;
const urls = {
  angus: 'https://qa5.angus-systems.com/web?accountSwitch=true&mri_client_id=MRIQWEB&client=MRIQWEB&env_id=ANGUS-QA5',
  pmx:'https://mrix6-trunk.qasaas.mrisoftware.net',
  horizon: 'https://hzpdsys001.proleaseenterprise.mrisoftware.com/PDSYS01A/MainWindow/Create?client_id=MRIQWEB&env_id=HORIZON-DEV-0001',
  engageAtWork:'https://engage-atwork-back-office-qa.mriengage.com/admin'
};

export const loginCreds = {
  Url: urls[env],
  clientID: getRequiredEnv('CLIENT_ID'),
  oktaUrl: 'https://mrisaas.oktapreview.com/',
  userName: getRequiredEnv('AGORA_USERNAME'),
  password: getRequiredEnv('AGORA_PASSWORD'),
};

 