import React from 'react';
import Renderer from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import PublicRegionContent from '../src/screens/public/PublicRegionContent';
import { PremiumSelect } from '../src/ui';
import { readPublicCms, submitPublicCms } from '../src/services/publicContent';
import { hasRegionContact, regionContacts, regionLabels, regionLeaderContext, regionPanels, regionScope, regionTitle } from '../src/utils/publicRegionContent';

jest.mock('../src/services/publicContent', () => ({ readPublicCms: jest.fn(), submitPublicCms: jest.fn() }));
const navigation = { navigate: jest.fn(), push: jest.fn(), goBack: jest.fn() };
let screen: Renderer.ReactTestRenderer | undefined;
const button = (label: string) => screen!.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const text = () => screen!.root.findAllByType(Text).map(node => node.props.children).join(' ');
beforeEach(() => jest.clearAllMocks());
afterEach(async () => { await Renderer.act(async () => screen?.unmount()); screen = undefined; });

test('published child pages replace stale copies by place name without dropping other authored boards', () => {
  const record = { statePanels: [{ name: 'Tamil Nadu', slug: 'tamil-nadu', leaders: [{ name: 'Current chair' }] }, { name: 'Kerala', contacts: [{ phone: '1234567' }] }],
    stateRegions: [{ name: 'TAMILNADU', leaders: [{ name: 'Stale chair' }] }, { name: 'Karnataka', leaders: [{ name: 'Authored chair' }] }] };
  expect(regionPanels(record, 'region').map(row => row.name)).toEqual(['Tamil Nadu', 'Kerala', 'Karnataka']);
  expect(regionPanels(record, 'region')[0].leaders[0].name).toBe('Current chair');
});

test('national panels use zone names and hidden or unpublished children never replace a visible board', () => {
  const panels = regionPanels({ statePanels: [{ name: 'South', slug: 'south' }, { name: 'North', visible: false }, { name: 'West', status: 'draft' }],
    stateRegions: [{ name: 'South Region' }, { name: 'North' }, { name: 'West' }] }, 'national');
  expect(panels.map(row => row.name)).toEqual(['South Zone', 'North Zone', 'West Zone']);
  expect(regionScope({ slug: 'national' }, 'regions')).toBe('national');
  expect(regionTitle({ regionName: 'South' }, 'region')).toBe('South Zone');
  expect(regionTitle({ regionName: 'National' }, 'national')).toBe('National');
});

test('leader enquiries identify the selected tier and its geography', () => {
  expect(regionLeaderContext({ regionName: 'National' }, 'national', { name: 'South' })).toEqual({ tier: 'region', region: 'South Zone', state: '', district: '' });
  expect(regionLeaderContext({ regionName: 'South' }, 'region', { name: 'Tamil Nadu' })).toEqual({ tier: 'state', region: 'South Zone', state: 'Tamil Nadu', district: '' });
  const state = { stateName: 'Tamil Nadu', regionName: 'South' };
  expect(regionLeaderContext(state, 'state', { name: 'North' })).toEqual({ tier: 'region', region: 'North', state: 'Tamil Nadu', district: '' });
  expect(regionLeaderContext(state, 'state', { name: 'Chennai' }, true)).toEqual({ tier: 'district', region: '', state: 'Tamil Nadu', district: 'Chennai' });
});

test('authored headings and name-only contacts survive while hidden contacts are omitted', () => {
  expect(regionLabels({ labels: { tierBelowHeading: 'Our state councils', ownTierEyebrow: ' ' } }, 'region')).toMatchObject({ tierBelowHeading: 'Our state councils', ownTierEyebrow: 'Zone' });
  expect(hasRegionContact({ name: 'Office coordinator' })).toBe(true);
  expect(hasRegionContact({ photoUrl: '/portrait.jpg' })).toBe(false);
  expect(regionContacts({ contact: { phone: '1234567' }, contacts: [{ name: 'Coordinator' }, { name: 'Hidden', isHidden: true }, {}] })).toEqual([{ phone: '1234567' }, { name: 'Coordinator' }]);
});

test('zone detail renders current leadership, contact-only councils and all published section links', async () => {
  const page = { kind: 'region', title: 'South', scope: 'regions', page: { slug: 'south', regionName: 'South',
    statePanels: [{ slug: 'tamil-nadu', name: 'Tamil Nadu', leaders: [{ name: 'Current chair' }] }, { slug: 'kerala', name: 'Kerala', contacts: [{ name: 'Kerala coordinator' }] }],
    stateRegions: [{ name: 'TAMILNADU', leaders: [{ name: 'Stale chair' }] }],
    regionContactGroups: [{ name: 'Regional support', contacts: [{ name: 'Named contact' }, { name: 'Hidden contact', visible: false }] }],
    projects: [{ title: 'Enterprise programme' }], newsUpdates: [{ title: 'Hidden update', isHidden: true }],
  } };
  await Renderer.act(async () => { screen = Renderer.create(<PublicRegionContent page={page} path="/regions/south" navigation={navigation} offset={0} onOffset={jest.fn()} />); });
  expect(button('View profile: Current chair')).toBeDefined();
  expect(button('View profile: Stale chair')).toBeUndefined();
  expect(text()).toContain('Kerala coordinator');
  expect(text()).toContain('Named contact');
  expect(text()).not.toContain('Hidden contact');
  expect(button('Projects')).toBeDefined();
  expect(button('News updates')).toBeUndefined();
  await Renderer.act(async () => button('Explore Kerala').props.onPress());
  expect(navigation.push).toHaveBeenLastCalledWith('PublicContent', { path: '/states/kerala', title: 'Explore Kerala' });
});

test('opening a state internal region sends its own context through the existing callback flow', async () => {
  (readPublicCms as jest.Mock).mockResolvedValue([{ key: 'general', label: 'General enquiry' }]);
  (submitPublicCms as jest.Mock).mockResolvedValue({ sent: true });
  const page = { kind: 'region', title: 'Tamil Nadu', scope: 'states', page: { slug: 'tamil-nadu', stateName: 'Tamil Nadu', regionName: 'South',
    stateRegions: [{ name: 'North', leaders: [{ id: 'north-chair', name: 'North chair' }] }] } };
  await Renderer.act(async () => { screen = Renderer.create(<PublicRegionContent page={page} path="/states/tamil-nadu" navigation={navigation} offset={0} onOffset={jest.fn()} />); });
  await Renderer.act(async () => button('View profile: North chair').props.onPress());
  await Renderer.act(async () => button('Request a callback').props.onPress());
  const field = (label: string) => screen!.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === label)!;
  await Renderer.act(async () => {
    field('Your name').props.onChangeText('Member');
    field('Your phone').props.onChangeText('9999999999');
    screen!.root.findByType(PremiumSelect).props.onChange('General enquiry');
  });
  await Renderer.act(async () => button('Send enquiry').props.onPress());
  expect(submitPublicCms).toHaveBeenCalledWith('/cms/leader-messages', expect.objectContaining({ tier: 'region', region: 'North', state: 'Tamil Nadu', district: '', pagePath: '/states/tamil-nadu' }));
  expect(text()).toContain('Enquiry sent');
});
