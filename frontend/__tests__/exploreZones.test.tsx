import React from 'react';
import Renderer from 'react-test-renderer';
import { Text } from 'react-native';
import { ExploreZones } from '../src/components/explore/ExploreDestinations';
import { PremiumSelect } from '../src/ui';
import { exploreStateChoices, publishedExploreZones } from '../src/utils/exploreRegions';
import { loadExploreContent } from '../src/services/publicContent';
import { loadNativePublicPage } from '../src/services/nativePublicContent';
import { getZones, invalidateWebsiteContent } from '../src/services/websiteContent';
import visitorApi from '../src/services/publicApi';
import api from '../src/services/api';

jest.mock('../src/services/publicApi', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../src/services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));

const zones = [
  { slug: 'national', label: 'National', national: true, hasPage: true, order: 0 },
  { slug: 'south', label: 'Southern region', hasPage: false, order: 1, states: [
    { slug: 'tamil-nadu', name: 'Tamil Nadu', hasPage: true, status: 'published' },
    { slug: 'kerala', name: 'Kerala', hasPage: true, status: 'published' },
    { slug: 'draft-state', name: 'Draft state', hasPage: true, status: 'draft' },
    { slug: 'no-page', name: 'No page', hasPage: false }, null,
  ] },
  { slug: 'west', label: 'Western region', hasPage: true, order: 2, states: [
    { slug: 'goa', name: 'Goa', hasPage: true, status: 'published' },
  ] },
];
let screen: Renderer.ReactTestRenderer | undefined;
const button = (label: string) => screen!.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const select = () => screen!.root.findByType(PremiumSelect);
const chooseState = async (name: string) => {
  await Renderer.act(async () => button('Find your state: ' + (select().props.value || 'Choose a state')).props.onPress());
  const choice = screen!.root.findAll(node => node.props.accessibilityRole === 'radio' && typeof node.props.onPress === 'function'
    && node.findAllByType(Text).some(text => text.props.children === name))[0];
  expect(choice).toBeDefined();
  await Renderer.act(async () => choice.props.onPress());
};
beforeEach(() => { jest.clearAllMocks(); invalidateWebsiteContent(); });
afterEach(async () => { await Renderer.act(async () => screen?.unmount()); screen = undefined; });

test('only published state destinations are selectable, including those without a zone overview', () => {
  const input = [null, ...zones, { slug: 'empty', hasPage: false }, { slug: 'hidden', visible: false, states: [{ slug: 'hidden-state', name: 'Hidden state' }] }];
  const normalized = publishedExploreZones(input);
  expect(normalized.map(zone => zone.slug)).toEqual(['national', 'south', 'west']);
  expect(normalized[1].hasPage).toBe(false);
  expect(exploreStateChoices(normalized).map(state => state.name)).toEqual(['Goa', 'Kerala', 'Tamil Nadu']);
  expect(exploreStateChoices(normalized, 'south').map(state => state.slug)).toEqual(['kerala', 'tamil-nadu']);
  expect(publishedExploreZones(null)).toEqual([]);
  expect(publishedExploreZones([{ ...zones[1], states: 'invalid' }])).toEqual([]);
  expect(publishedExploreZones([zones[2], zones[2]])).toHaveLength(1);
});

test('guest home, member home and the native zones page share published zone/state availability', async () => {
  const response = { data: { data: { regions: zones } } };
  (visitorApi.get as jest.Mock).mockResolvedValue(response);
  (api.get as jest.Mock).mockResolvedValue(response);
  const expected = publishedExploreZones(zones);
  expect((await loadExploreContent('zones')).zones).toEqual(expected);
  expect((await loadNativePublicPage('/zones', new AbortController().signal))?.items).toEqual(expected);
  expect(await getZones()).toEqual(expected);
  expect((visitorApi.get as jest.Mock).mock.calls.every(([path, config]) => path === '/cms/regions/map' && config.params.scope === 'public')).toBe(true);
});

test('zone filtering offers its states, opens the exact state page and resets to all regions', async () => {
  const openPage = jest.fn();
  await Renderer.act(async () => { screen = Renderer.create(<ExploreZones zones={zones} openPage={openPage} />); });
  expect(select().props.options).toEqual(['Goa', 'Kerala', 'Tamil Nadu']);
  await Renderer.act(async () => button('Filter by Southern region').props.onPress());
  expect(select().props.options).toEqual(['Kerala', 'Tamil Nadu']);
  expect(button('Explore Western region')).toBeUndefined();
  expect(button('Explore National')).toBeUndefined();
  await chooseState('Tamil Nadu');
  expect(button('Explore Kerala')).toBeUndefined();
  await Renderer.act(async () => button('Explore Tamil Nadu').props.onPress());
  expect(openPage).toHaveBeenCalledWith('/states/tamil-nadu', 'Tamil Nadu');
  await Renderer.act(async () => button('Clear zone and state filters').props.onPress());
  expect(select().props.value).toBe('');
  expect(select().props.options).toEqual(['Goa', 'Kerala', 'Tamil Nadu']);
  expect(button('Explore Western region')).toBeDefined();
  expect(button('Explore National')).toBeDefined();
});

test('an unpublished zone opens its available states and never routes to an unavailable overview', async () => {
  const openPage = jest.fn();
  await Renderer.act(async () => { screen = Renderer.create(<ExploreZones zones={zones} openPage={openPage} />); });
  expect(button('Explore Southern region')).toBeUndefined();
  await Renderer.act(async () => button('Browse states in Southern region').props.onPress());
  expect(openPage).not.toHaveBeenCalled();
  expect(button('Explore Tamil Nadu')).toBeDefined();
  expect(button('Explore Draft state')).toBeUndefined();
  await Renderer.act(async () => button('Clear zone and state filters').props.onPress());
  await Renderer.act(async () => button('Explore Western region').props.onPress());
  expect(openPage).toHaveBeenLastCalledWith('/regions/west', 'Western region');
});

test.each(['directory', 'preview'] as const)('choosing a state from all zones selects its owning region in the %s', async variant => {
  const openPage = jest.fn();
  await Renderer.act(async () => { screen = Renderer.create(<ExploreZones zones={zones} openPage={openPage} variant={variant} />); });
  await chooseState('Tamil Nadu');
  expect(button('Filter by Southern region').props.accessibilityState.selected).toBe(true);
  expect(button('Filter by All zones').props.accessibilityState.selected).toBe(false);
  expect(select().props.options).toEqual(['Kerala', 'Tamil Nadu']);
  expect(select().props.value).toBe('Tamil Nadu');
  expect(button('Explore Western region')).toBeUndefined();
  expect(button('Explore National')).toBeUndefined();
  await Renderer.act(async () => button('Explore Tamil Nadu').props.onPress());
  expect(openPage).toHaveBeenCalledWith('/states/tamil-nadu', 'Tamil Nadu');
  await Renderer.act(async () => button('Filter by Western region').props.onPress());
  expect(select().props.value).toBe('');
  expect(select().props.options).toEqual(['Goa']);
  expect(button('Explore Tamil Nadu')).toBeUndefined();
});

test('CMS refresh removes stale state and zone selections without keeping unavailable navigation', async () => {
  const openPage = jest.fn();
  await Renderer.act(async () => { screen = Renderer.create(<ExploreZones zones={zones} openPage={openPage} />); });
  await Renderer.act(async () => button('Filter by Southern region').props.onPress());
  await chooseState('Tamil Nadu');
  const refreshed = zones.map(zone => zone.slug === 'south' ? { ...zone, states: zone.states?.filter(state => state?.slug !== 'tamil-nadu') } : zone);
  await Renderer.act(async () => screen!.update(<ExploreZones zones={refreshed} openPage={openPage} />));
  expect(select().props.value).toBe('');
  expect(select().props.options).toEqual(['Kerala']);
  expect(button('Explore Tamil Nadu')).toBeUndefined();
  await Renderer.act(async () => screen!.update(<ExploreZones zones={[zones[0], zones[2]]} openPage={openPage} />));
  expect(select().props.options).toEqual(['Goa']);
  expect(button('Clear zone and state filters')).toBeUndefined();
  expect(button('Explore Western region')).toBeDefined();
  expect(openPage).not.toHaveBeenCalled();
});

test('an absent public map remains readable and has no invented state options', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<ExploreZones zones={null as any} openPage={jest.fn()} />); });
  expect(screen!.root.findAllByType(PremiumSelect)).toHaveLength(0);
  expect(screen!.root.findAllByType(Text).some(node => node.props.children === 'Regional pages will appear here as they are published.')).toBe(true);
});
