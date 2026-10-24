// Kept as an inert compatibility component for the app entry wiring.
// Permission requests now come only from Enable in the bell or account settings;
// the native operating-system dialog is the only permission prompt.
export default function NotificationPermissionPrompt(_props: { ready: boolean }) {
  return null;
}
