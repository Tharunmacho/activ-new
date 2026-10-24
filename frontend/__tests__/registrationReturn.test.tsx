import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import api from '../src/services/api';
import { takePublicAction } from '../src/services/publicNavigation';
import RegistrationStep2Screen from '../src/screens/registration/RegistrationStep2Screen';

jest.mock('../src/services/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../src/services/session', () => ({ clearSession: jest.fn(), sanitizeUser: (user: any) => user }));
jest.mock('../src/stores/exampleStore', () => ({ useAuthStore: () => ({ login: jest.fn() }) }));
jest.mock('../src/services/publicNavigation', () => ({ takePublicAction: jest.fn() }));
jest.mock('../src/hooks/useRegionCascade', () => ({ __esModule: true, default: () => ({ states: [], districts: [], blocks: [], state: '', district: '', block: '', reload: jest.fn() }) }));

test.each([null, { name: 'EventBooking', params: { eventId: 'fixture-event' } }])('registration resumes only an explicitly selected public action: %j', async resume => {
  jest.useFakeTimers();
  (api.post as jest.Mock).mockResolvedValue({ data: { data: { token: 'fixture-token', user: { role: 'member', fullName: 'Fixture Member' } } } });
  (takePublicAction as jest.Mock).mockReturnValue(resume);
  const navigation = { reset: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
  let tree!: Renderer.ReactTestRenderer;
  try {
    await act(async () => { tree = Renderer.create(<RegistrationStep2Screen navigation={navigation as any} route={{ params: { email: 'fixture@example.test', password: 'Fixture-only-123', fullName: 'Fixture Member', phoneNumber: '9000000001' } } as any} />); });
    const submit = tree.root.findAll(node => node.props.primaryLabel === 'Complete registration' && typeof node.props.onPrimary === 'function')[0];
    await act(async () => { await submit.props.onPrimary(); });
    expect(navigation.reset).toHaveBeenCalledWith(resume
      ? { index: 1, routes: [{ name: 'MemberMain' }, resume] }
      : { index: 0, routes: [{ name: 'MemberMain' }] });
  } finally { if (tree) act(() => tree.unmount()); jest.useRealTimers(); }
});
