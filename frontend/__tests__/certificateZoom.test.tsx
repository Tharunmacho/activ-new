import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { ScrollView, StyleSheet } from 'react-native';
import CertificateZoomScreen from '../src/screens/member/certificates/CertificateZoomScreen';
import { MembershipCertificateView, TaxCertificateView } from '../src/screens/member/certificates/CertificateViews';
import { A4_WIDTH, A4_HEIGHT, certificateFitWidth } from '../src/screens/member/certificates/certificateLayout';

jest.mock('../src/screens/member/certificates/CertificateViews', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    MembershipCertificateView: (props: any) => React.createElement(View, { ...props, testID: 'membership-page' }),
    TaxCertificateView: (props: any) => React.createElement(View, { ...props, testID: 'tax-page' }),
  };
});

let tree: Renderer.ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const cert = { member: { name: 'Certificate Member', companyName: 'The Initial Company' }, reference: 'CERT-ONE' };
const radio = (label: string) => tree.root.findAll(node => node.props.accessibilityRole === 'radio'
  && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const viewport = async (width: number, height: number) => act(async () => {
  tree.root.findByProps({ testID: 'certificate-viewport' }).props.onLayout({ nativeEvent: { layout: { width, height } } });
});

test.each([[320, 480], [390, 620], [844, 220], [270, 180]])('Fit contains the entire A4 page in %s × %s available space', (width, height) => {
  for (const landscape of [true, false]) {
    const fit = certificateFitWidth(width, height, landscape);
    const pageHeight = fit * (landscape ? A4_WIDTH / A4_HEIGHT : A4_HEIGHT / A4_WIDTH);
    expect(fit).toBeLessThanOrEqual(width);
    expect(pageHeight).toBeLessThanOrEqual(height);
  }
});

test('opens with full-page Fit and uses explicit zoom controls to enable both pan directions', async () => {
  await act(async () => { tree = Renderer.create(<CertificateZoomScreen navigation={{}} route={{ params: { cert, kind: 'membership' } }} />); });
  await viewport(390, 620);
  expect(radio('Fit to screen').props.accessibilityState.checked).toBe(true);
  const page = () => tree.root.findByType(MembershipCertificateView);
  const fitWidth = page().props.width;
  expect(fitWidth).toBe(366);
  expect(page().props.cert).toBe(cert);
  expect(page().props.onPress).toBeUndefined();
  expect(tree.root.findAllByType(ScrollView).every(node => node.props.scrollEnabled === false)).toBe(true);
  for (const zoom of [2, 3]) {
    await act(async () => radio(`Zoom ${zoom} times`).props.onPress());
    expect(page().props.width).toBe(fitWidth * zoom);
    expect(tree.root.findAllByType(ScrollView).every(node => node.props.scrollEnabled === true)).toBe(true);
    const horizontal = tree.root.findAllByType(ScrollView).find(node => node.props.horizontal);
    expect(StyleSheet.flatten(horizontal?.props.contentContainerStyle).width).toBe(page().props.width + 24);
  }
  await act(async () => radio('Fit to screen').props.onPress());
  expect(page().props.width).toBe(fitWidth);
  expect(tree.root.findAllByType(ScrollView).every(node => node.props.scrollEnabled === false)).toBe(true);
});

test('a different document resets zoom and tax pages also fit a short landscape viewport', async () => {
  await act(async () => { tree = Renderer.create(<CertificateZoomScreen navigation={{}} route={{ params: { cert, kind: 'membership' } }} />); });
  await act(async () => radio('Zoom 3 times').props.onPress());
  const tax = { ...cert, reference: 'CERT-TAX' };
  await act(async () => tree.update(<CertificateZoomScreen navigation={{}} route={{ params: { cert: tax, stamp: 'Annual statement', receiptColumn: true } }} />));
  await viewport(844, 220);
  expect(radio('Fit to screen').props.accessibilityState.checked).toBe(true);
  const page = tree.root.findByType(TaxCertificateView);
  expect(page.props.width * A4_HEIGHT / A4_WIDTH).toBeLessThanOrEqual(196);
  expect(page.props.cert).toBe(tax);
  expect(page.props.stamp).toBe('Annual statement');
  expect(page.props.receiptColumn).toBe(true);
});
