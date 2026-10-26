import api from '../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useActiveCompanyStore } from '../src/stores/activeCompanyStore';

jest.mock('../src/services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
const payload = (id: string) => ({ data: { data: [{ _id: id, businessName: id }] } });
beforeEach(() => { jest.clearAllMocks(); useActiveCompanyStore.getState().clear(); });

test('a response from the signed-out account cannot restore its companies or persisted selection', async () => {
  let finish: (value: any) => void = () => {};
  (api.get as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const old = useActiveCompanyStore.getState().loadCompanies();
  useActiveCompanyStore.getState().clear();
  (api.get as jest.Mock).mockResolvedValueOnce(payload('new-account-company'));
  await useActiveCompanyStore.getState().loadCompanies();
  finish(payload('old-account-company'));
  await old;
  expect(useActiveCompanyStore.getState().companies.map(company => company._id)).toEqual(['new-account-company']);
  expect(useActiveCompanyStore.getState().activeCompanyId).toBe('new-account-company');
  expect(await AsyncStorage.getItem('@activ:activeCompanyId')).toBe('new-account-company');
});

test('newer forced loads win even when the first request finishes last', async () => {
  let finish: (value: any) => void = () => {};
  (api.get as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const old = useActiveCompanyStore.getState().loadCompanies({ force: true });
  (api.get as jest.Mock).mockResolvedValueOnce(payload('latest'));
  await useActiveCompanyStore.getState().loadCompanies({ force: true });
  finish(payload('stale'));
  await old;
  expect(useActiveCompanyStore.getState().activeCompanyId).toBe('latest');
  expect(useActiveCompanyStore.getState().isLoading).toBe(false);
});

test('only an owned company can become the active selection', async () => {
  (api.get as jest.Mock).mockResolvedValueOnce(payload('owned'));
  await useActiveCompanyStore.getState().loadCompanies();
  useActiveCompanyStore.getState().setActiveCompany('foreign');
  expect(useActiveCompanyStore.getState().activeCompanyId).toBe('owned');
});
