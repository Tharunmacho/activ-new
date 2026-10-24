import React from 'react';
import Renderer from 'react-test-renderer';
import { Alert } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../src/services/api';
import { uploadAdminProfilePhoto } from '../src/services/adminProfilePhoto';
import TierSettingsView from '../src/screens/admin/shared/TierSettingsView';

let mockServerPhoto = '/uploads/original.png';
let mockUploadFailure = false;
jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(async (url: string) => ({ data: { data: url === '/admin/profile'
      ? { fullName: 'Regional Admin', email: 'regional@example.test', profilePhoto: mockServerPhoto }
      : { stats: { stateName: 'Tamil Nadu', districtName: 'Chennai', blockName: 'Guindy' }, applicants: {}, members: [] } } })),
    post: jest.fn(async () => {
      if (mockUploadFailure) throw new Error('Upload unavailable');
      mockServerPhoto = '/uploads/confirmed.png';
      return { data: { data: { profilePhoto: mockServerPhoto } } };
    }),
  },
  getUserData: jest.fn().mockResolvedValue({ fullName: 'Regional Admin', email: 'regional@example.test' }),
  setUserData: jest.fn(),
}));
const rows = ['Block', 'District', 'State'].map(tier => [
  tier,
  require(`../src/screens/admin/${tier.toLowerCase()}/context/${tier}AdminContext`)[`${tier}AdminProvider`],
  require(`../src/screens/admin/${tier.toLowerCase()}/${tier}SettingsScreen`).default,
] as const);
let screen: Renderer.ReactTestRenderer;
let alert: jest.SpyInstance;
let append: jest.SpyInstance;
const navigation = { navigate: jest.fn() };
const mount = async (Provider: any, Screen: any) => {
  await Renderer.act(async () => { screen = Renderer.create(<Provider><Screen navigation={navigation} /></Provider>); });
};
beforeEach(() => {
  jest.clearAllMocks(); mockServerPhoto = '/uploads/original.png'; mockUploadFailure = false;
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  append = jest.spyOn(FormData.prototype, 'append');
  (launchImageLibrary as jest.Mock).mockResolvedValue({ assets: [{ uri: 'file:///chosen.png', type: 'image/png', fileName: 'chosen.png', fileSize: 200 }] });
});
afterEach(async () => { await Renderer.act(async () => screen?.unmount()); alert.mockRestore(); append.mockRestore(); });

test.each(rows)('%s photo uses confirmed server URL and survives a fresh provider mount', async (_tier, Provider, Screen) => {
  await mount(Provider, Screen);
  expect(screen.root.findByType(TierSettingsView).props.photo).toBe('/uploads/original.png');
  await Renderer.act(async () => screen.root.findByType(TierSettingsView).props.onPickImage());
  expect(api.post).toHaveBeenCalledWith('/admin/profile/photo', expect.any(FormData), expect.any(Object));
  expect(append).toHaveBeenCalledWith('photo', expect.objectContaining({ uri: 'file:///chosen.png', name: 'chosen.png', type: 'image/png' }));
  expect(screen.root.findByType(TierSettingsView).props.photo).toBe('/uploads/confirmed.png');
  await Renderer.act(async () => screen.unmount());
  await mount(Provider, Screen);
  expect(screen.root.findByType(TierSettingsView).props.photo).toBe('/uploads/confirmed.png');
});

test('failed upload preserves the existing photo and cancel makes no request', async () => {
  await mount(rows[0][1], rows[0][2]);
  mockUploadFailure = true;
  await Renderer.act(async () => screen.root.findByType(TierSettingsView).props.onPickImage());
  expect(screen.root.findByType(TierSettingsView).props.photo).toBe('/uploads/original.png');
  expect(alert).toHaveBeenCalledWith('Photo not saved', 'Upload unavailable');
  (api.post as jest.Mock).mockClear();
  (launchImageLibrary as jest.Mock).mockResolvedValue({ didCancel: true });
  await Renderer.act(async () => screen.root.findByType(TierSettingsView).props.onPickImage());
  expect(api.post).not.toHaveBeenCalled();
});

test('client rejects non-images and oversized files before upload', async () => {
  await expect(uploadAdminProfilePhoto({ uri: 'file:///report.pdf', type: 'application/pdf' })).rejects.toThrow('image');
  await expect(uploadAdminProfilePhoto({ uri: 'file:///large.png', type: 'image/png', fileSize: 5 * 1024 * 1024 + 1 })).rejects.toThrow('5 MB');
  expect(api.post).not.toHaveBeenCalled();
});
