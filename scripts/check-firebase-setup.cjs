// Read-only local configuration check. Never prints secrets or sends notifications.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dotenv = require(path.join(root, 'backend/node_modules/dotenv'));
const env = file => fs.existsSync(path.join(root, file)) ? dotenv.parse(fs.readFileSync(path.join(root, file))) : {};
const backend = { ...env('backend/.env'), ...process.env };
const web = { ...env('website/.env'), ...env('website/.env.production'), ...env('website/.env.local'), ...env('website/.env.production.local'), ...process.env };
let missing = 0;
function check(label, ok, next) { console.log(`${ok ? 'OK' : 'TODO'}: ${label}${ok ? '' : ' — ' + next}`); if (!ok) missing++; }
let android;
try { android = JSON.parse(fs.readFileSync(path.join(root, 'frontend/android/app/google-services.json'), 'utf8')); } catch {}
check('Android Firebase configuration', android?.client?.some(c => c.client_info?.android_client_info?.package_name === 'in.activ.membership'), 'Download google-services.json for package in.activ.membership into frontend/android/app.');
check('iOS Firebase configuration', fs.existsSync(path.join(root, 'frontend/ios/Activ/GoogleService-Info.plist')), 'Add the plist to the Activ target in Xcode. Skip only if not releasing iOS.');
let credential;
try {
  if (backend.FIREBASE_SERVICE_ACCOUNT_JSON) credential = JSON.parse(backend.FIREBASE_SERVICE_ACCOUNT_JSON);
  else if (backend.GOOGLE_APPLICATION_CREDENTIALS) credential = JSON.parse(fs.readFileSync(backend.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
} catch {}
check('Backend service account', Boolean(credential?.project_id && credential?.client_email && credential?.private_key), 'Set FIREBASE_SERVICE_ACCOUNT_JSON or a readable GOOGLE_APPLICATION_CREDENTIALS file on the server.');
if (credential && android) check('Firebase project matches Android', credential.project_id === android.project_info?.project_id, 'Use the same Firebase project for the app and backend.');
check('Push enabled', backend.PUSH_ENABLED === 'true', 'After adding credentials, set PUSH_ENABLED=true on the backend host.');
check('Notification worker enabled', backend.NOTIFICATION_WORKER_ENABLED !== 'false', 'Set NOTIFICATION_WORKER_ENABLED=true.');
check('Website Google Analytics ID', /^G-[A-Z0-9]+$/.test(web.VITE_GA_MEASUREMENT_ID || ''), 'Add VITE_GA_MEASUREMENT_ID to the website build environment.');
for (const [provider, keys] of [['Google', ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']], ['Facebook', ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET']], ['LinkedIn', ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET']]]) {
  check(`${provider} sign-in settings`, keys.every(key => Boolean(backend[key])), 'Configure the provider credentials on the backend.');
}
console.log('See docs/firebase-setup.md. Presence checks do not verify live provider access, APNs signing, device permission or deployment settings.');
process.exitCode = missing ? 1 : 0;
