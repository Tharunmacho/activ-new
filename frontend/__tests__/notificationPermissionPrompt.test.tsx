import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationPermissionPrompt from '../src/components/NotificationPermissionPrompt';
import { syncPushRegistration } from '../src/services/pushNotifications';

jest.mock('../src/services/pushNotifications', () => ({ syncPushRegistration: jest.fn() }));

test('startup and restored-home changes show no custom popup and never request permission', async () => {
  await AsyncStorage.clear();
  let tree!: Renderer.ReactTestRenderer;
  await act(async () => { tree = Renderer.create(<NotificationPermissionPrompt ready={false} />); });
  expect(tree.toJSON()).toBeNull();
  await act(async () => tree.update(<NotificationPermissionPrompt ready />));
  expect(tree.toJSON()).toBeNull();
  expect(syncPushRegistration).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@activ_visitor_push_enabled')).toBeNull();
  await act(async () => tree.unmount());
});

test('remounting never changes a prior off choice or asks again', async () => {
  await AsyncStorage.setItem('@activ_visitor_push_enabled', 'false');
  let tree!: Renderer.ReactTestRenderer;
  await act(async () => { tree = Renderer.create(<NotificationPermissionPrompt ready />); });
  expect(tree.toJSON()).toBeNull();
  expect(await AsyncStorage.getItem('@activ_visitor_push_enabled')).toBe('false');
  expect(syncPushRegistration).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
