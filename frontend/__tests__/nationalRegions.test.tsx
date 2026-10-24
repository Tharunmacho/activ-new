import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import useRegionCascade from '../src/hooks/useRegionCascade';
import { getStates, getDistricts, getBlocks, invalidateRegionCache } from '../src/services/regions';

jest.mock('../src/services/regions', () => ({
  getStates: jest.fn(), getDistricts: jest.fn(), getBlocks: jest.fn(), invalidateRegionCache: jest.fn(),
}));
const reference = require('../../backend/src/modules/regions/data/india-geography.json').states;
const nodes = (names: string[]) => names.map(name => ({ name, admins: 0 }));
let current: ReturnType<typeof useRegionCascade>;
const Probe = () => { current = useRegionCascade(); return null; };
const districtNames = (state: string) => reference.find((s: any) => s.state === state)?.districts.map((d: any) => d.district) || [];
const blockNames = (state: string, district: string) => reference.find((s: any) => s.state === state)?.districts.find((d: any) => d.district === district)?.block || [];

beforeEach(() => {
  jest.clearAllMocks();
  (getStates as jest.Mock).mockImplementation(async () => nodes(reference.map((s: any) => s.state)));
  (getDistricts as jest.Mock).mockImplementation(async state => nodes(districtNames(state)));
  (getBlocks as jest.Mock).mockImplementation(async (state, district) => nodes(blockNames(state, district)));
});
const mount = async () => { let tree: Renderer.ReactTestRenderer; await act(async () => { tree = Renderer.create(<Probe />); }); return tree!; };

test('all national states cascade to their own districts and blocks, even with zero admins', async () => {
  const tree = await mount();
  expect(current.states).toHaveLength(36);
  expect(current.noCoverage).toBe(false);
  for (const state of reference) {
    await act(async () => current.setState(state.state));
    expect(current.district).toBe(''); expect(current.block).toBe('');
    expect(current.districts.map(d => d.name)).toEqual(districtNames(state.state));
    const district = state.districts[0];
    await act(async () => current.setDistrict(district.district));
    expect(current.blocks.map(b => b.name)).toEqual(district.block);
    if (district.block.length) await act(async () => current.setBlock(district.block[0]));
  }
  await act(async () => tree.unmount());
});

test('urban districts expose an empty block list and allow the selection to stay district-only', async () => {
  const tree = await mount();
  const state = reference.find((s: any) => s.districts.some((d: any) => !d.block.length));
  const district = state.districts.find((d: any) => !d.block.length);
  await act(async () => current.setState(state.state));
  await act(async () => current.setDistrict(district.district));
  expect(current.district).toBe(district.district);
  expect(current.block).toBe(''); expect(current.blocks).toEqual([]);
  expect(current.refreshing).toBe(false); expect(current.error).toBe('');
  await act(async () => tree.unmount());
});

test('changing a state clears old child lists immediately and ignores a slow previous response', async () => {
  const tree = await mount();
  let finish: (nodes: any[]) => void = () => {};
  (getDistricts as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => current.setState('Bihar'));
  expect(current.refreshing).toBe(true);
  await act(async () => current.setState('Tamil Nadu'));
  await act(async () => finish(nodes(['Patna'])));
  expect(current.state).toBe('Tamil Nadu');
  expect(current.districts.map(d => d.name)).toEqual(districtNames('Tamil Nadu'));
  expect(current.districts.some(d => d.name === 'Patna')).toBe(false);
  await act(async () => tree.unmount());
});

test('a failed block load is shown as an error, and Retry reloads that district', async () => {
  const tree = await mount();
  await act(async () => current.setState('Bihar'));
  (getBlocks as jest.Mock).mockRejectedValueOnce(new Error('Connection lost'));
  await act(async () => current.setDistrict('Patna'));
  expect(current.error).toContain('Could not load blocks');
  await act(async () => current.reload());
  expect(invalidateRegionCache).toHaveBeenCalled();
  expect(current.error).toBe('');
  expect(current.blocks.map(b => b.name)).toEqual(blockNames('Bihar', 'Patna'));
  await act(async () => tree.unmount());
});
