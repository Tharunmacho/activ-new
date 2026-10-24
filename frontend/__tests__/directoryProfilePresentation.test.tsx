import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import DirectoryProfileScreen from '../src/screens/member/directory/DirectoryProfileScreen';
import { PhotoViewer } from '../src/ui/PhotoViewer';
import { BrandFrame, BrandHeaderBlock } from '../src/ui/premium/BrandFrame';
import { BrandBackdrop } from '../src/ui/premium/BrandBackdrop';
import { PremiumPage } from '../src/ui/premium/PremiumPage';
import { openConversationWith } from '../src/services/memberApi';

let mockEntry: any;
jest.mock('../src/screens/member/useLoad', () => ({ useLoad: () => ({ data: mockEntry, loading: false, refreshing: false, error: '', reload: jest.fn(), refresh: jest.fn() }) }));
jest.mock('../src/screens/member/useMemberAccess', () => ({
  useMemberAccess: () => ({ paid: true, profile: { _id: 'viewer', memberType: 'business' } }),
  useLockedCta: () => ({}), runMembershipCta: jest.fn(),
}));
jest.mock('../src/services/memberApi', () => ({ getDirectoryEntry: jest.fn(), openConversationWith: jest.fn(), recordProductView: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...require('react-native-safe-area-context/jest/mock').default,
  useSafeAreaInsets: () => ({ top: 24, bottom: 28, left: 0, right: 0 }),
}));
let tree: Renderer.ReactTestRenderer;
const nav = { navigate: jest.fn(), goBack: jest.fn() };
beforeEach(() => {
  mockEntry = { id: 'member-one', fullName: 'Sample Public Member', profilePhoto: '/uploads/sample-member.jpg',
    block: 'Example Block', district: 'Chennai', state: 'Tamil Nadu', memberSince: '2026-10-15', companies: [], products: [] };
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const mountProfile = async () => act(async () => { tree = Renderer.create(<DirectoryProfileScreen navigation={nav} route={{ params: { id: 'member-one' } }} />); });
const button = (label: string) => tree.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const imageDocuments = () => tree.root.findAll(node => typeof node.props.source?.html === 'string');

test('profile photo opens the complete original image only on tap and closes with Android back', async () => {
  await mountProfile();
  expect(tree.root.findByType(PhotoViewer).props.visible).toBe(false);
  expect(imageDocuments()).toHaveLength(0);
  const photo = button('View Sample Public Member\'s profile photo');
  expect(photo.props.accessibilityRole).toBe('button');
  await act(async () => photo.props.onPress());
  expect(tree.root.findByType(PhotoViewer).props.visible).toBe(true);
  const document = imageDocuments()[0].props.source.html;
  expect(document).toContain('/uploads/sample-member.jpg');
  expect(document).toContain('object-fit:contain');
  expect(document).not.toContain('w=');
  expect(document).toContain('user-scalable=yes');
  expect(openConversationWith).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType(Modal).props.onRequestClose());
  expect(tree.root.findByType(PhotoViewer).props.visible).toBe(false);
  expect(imageDocuments()).toHaveLength(0);
});

test('missing photos stay noninteractive and the profile viewport clears the navigation buttons', async () => {
  mockEntry.profilePhoto = '';
  await mountProfile();
  expect(button('View Sample Public Member\'s profile photo')).toBeUndefined();
  expect(tree.root.findByType(PremiumPage).props.safeBottom).toBe(true);
  const scroll = tree.root.findByType(ScrollView);
  let ancestor = scroll.parent, reserved = false;
  while (ancestor) {
    if (ancestor.type === View && StyleSheet.flatten(ancestor.props.style)?.paddingBottom === 28) reserved = true;
    ancestor = ancestor.parent;
  }
  expect(reserved).toBe(true);
  expect(tree.root.findAllByType(Text).some(node => node.props.children === 'This member has not published any products or services.')).toBe(true);
});

test.each(['brand', 'premium'])('%s background belongs to the scrolling header, with only the status inset fixed', async shell => {
  await act(async () => { tree = Renderer.create(shell === 'brand'
    ? <BrandFrame tone="business" safeBottom><ScrollView><BrandHeaderBlock tone="business"><Text>Scrolling company header</Text></BrandHeaderBlock><Text>Page body</Text></ScrollView></BrandFrame>
    : <PremiumPage safeBottom header={<Text>Scrolling network header</Text>}><Text>Page body</Text></PremiumPage>); });
  const header = tree.root.findByType(BrandBackdrop);
  let ancestor = header.parent, scrolls = false;
  while (ancestor) { if (ancestor.type === ScrollView) scrolls = true; ancestor = ancestor.parent; }
  expect(scrolls).toBe(true);
  const fixedBackgrounds = tree.root.findAllByType(View).filter(node => {
    const style = StyleSheet.flatten(node.props.style);
    if (style?.position !== 'absolute' || !style.backgroundColor) return false;
    let parent = node.parent;
    while (parent) { if (parent.type === ScrollView) return false; parent = parent.parent; }
    return true;
  });
  expect(fixedBackgrounds.length).toBeGreaterThan(0);
  fixedBackgrounds.forEach(node => expect(StyleSheet.flatten(node.props.style).height).toBe(24));
});
