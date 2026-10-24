import { AppRegistry } from 'react-native';
import App from './App';
import { registerBackgroundPush } from './src/services/pushNotifications';
registerBackgroundPush();
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
if (appName !== 'Activ') {
  AppRegistry.registerComponent('Activ', () => App);
}
if (appName !== 'ActivApp') {
  AppRegistry.registerComponent('ActivApp', () => App);
}
