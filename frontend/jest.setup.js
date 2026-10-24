/* Native modules have no implementation under Jest: use their official mocks,
   or a minimal stand-in, so the whole app can be rendered as a smoke test. */
jest.mock('@react-native-firebase/app', () => ({ getApps: jest.fn(() => []) }));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(), AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
  getToken: jest.fn(), deleteToken: jest.fn(), hasPermission: jest.fn(), requestPermission: jest.fn(),
  onMessage: jest.fn(() => () => {}), onTokenRefresh: jest.fn(() => () => {}),
  onNotificationOpenedApp: jest.fn(() => () => {}), getInitialNotification: jest.fn(async () => null),
  setBackgroundMessageHandler: jest.fn(),
}));
jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(), logEvent: jest.fn(async () => {}), setConsent: jest.fn(async () => {}),
  setAnalyticsCollectionEnabled: jest.fn(async () => {}), setUserId: jest.fn(async () => {}),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(async () => []),
  keepLocalCopy: jest.fn(),
  types: { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', images: 'image/*', zip: 'application/zip', plainText: 'text/plain', csv: 'text/csv' },
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: error => !!error && typeof error.code === 'string',
}));
jest.mock('react-native-linear-gradient', () => {
  const { View } = require('react-native');
  return View;
});
// react-native-svg (waves, illustrations): every element becomes a plain View.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const make = (name) => {
    const C = ({ children }) => React.createElement(View, { testID: `svg-${name}` }, children);
    C.displayName = name;
    return C;
  };
  const names = [
    'Svg', 'Circle', 'Ellipse', 'G', 'Text', 'TSpan', 'TextPath', 'Path', 'Polygon', 'Polyline', 'Line', 'Rect',
    'Use', 'Image', 'Symbol', 'Defs', 'LinearGradient', 'RadialGradient', 'Stop', 'ClipPath', 'Pattern', 'Mask',
    'Marker', 'ForeignObject',
  ];
  const mod = { __esModule: true };
  names.forEach((n) => { mod[n] = make(n); });
  mod.default = mod.Svg;
  return mod;
});
// The in-app payment browser (PaymentCheckout) — a plain View under Jest.
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { __esModule: true, WebView: View, default: View };
});
jest.mock('react-native-video', () => ({ __esModule: true, default: require('react-native').View }));
// react-native-vision-camera (event check-in scanner): no native camera under
// Jest. A plain View for <Camera>, a granted permission, a back camera, and a
// code scanner that never fires — the screens' manual-entry path is testable.
jest.mock('react-native-vision-camera', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    Camera: View,
    useCameraDevice: jest.fn(() => ({ id: 'back', position: 'back' })),
    useCameraPermission: jest.fn(() => ({ hasPermission: true, requestPermission: jest.fn(() => Promise.resolve(true)) })),
    useCodeScanner: jest.fn((config) => config),
  };
});
