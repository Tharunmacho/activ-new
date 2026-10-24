import React from 'react';
import Renderer from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
import { TaxCertificateView } from '../src/screens/member/certificates/CertificateViews';
import { amountInWords } from '../src/utils/amountInWords';

const certificate = {
  member: { name: 'Sample ACTIV Member', pan: 'ABCDE1234F' },
  reference: 'ACTIV-TAX-2026-TEST', issuedAt: '2026-10-08T12:00:00Z', financialYear: '2026-27', issuedBy: 'ACTIV',
  contribution: { amount: 200000, payments: [{ date: '2026-10-07T12:00:00Z', amount: 200000, mode: 'Cash', reference: 'OFFICE-TEST-001' }] },
};
let tree: Renderer.ReactTestRenderer;
const render = async (cert: any, extra = {}) => {
  await Renderer.act(async () => { tree = Renderer.create(<TaxCertificateView cert={cert} width={380} {...extra} />); });
};
const flatten = (node: any): string => typeof node === 'string' ? node
  : Array.isArray(node) ? node.map(flatten).join('') : node?.children ? flatten(node.children) : '';
const text = () => flatten(tree.toJSON());
afterEach(async () => { if (tree) await Renderer.act(async () => tree.unmount()); });

test('member certificate includes the new heading, complete office address and dynamic payment data', async () => {
  await render(certificate);
  for (const content of ['Tax Exemption Certificate', 'Sample ACTIV Member', 'ABCDE1234F', 'ACTIV-TAX-2026-TEST',
    '₹ 2,00,000.00', 'Rupees Two Lakh Only', 'Invoice / Payment ID', 'OFFICE-TEST-001', 'Cash',
    '6&7, Hayagreeva Apartment', '121, Velachery Main Road', 'Chennai - 600032', 'info@activ.org.in',
    '+91-82201-12188', 'https://activ.org.in', '2026–2027']) expect(text()).toContain(content);
  expect(text()).not.toContain('CERTIFICATE OF');
  expect(text()).not.toContain('New Delhi');
});

test('annual statements retain every receipt, server-supplied words and provisional notice', async () => {
  const payments = Array.from({ length: 20 }, (_, index) => ({ date: '2026-10-07T12:00:00Z', amount: 500, reference: `RECEIPT-${index + 1}` }));
  await render({ ...certificate, contribution: { payments } }, { receiptColumn: true, stamp: 'Provisional annual statement', amountInWords: 'Rupees Ten Thousand Only' });
  expect(text()).toContain('Receipt No.');
  expect(text()).toContain('Provisional annual statement');
  expect(text()).toContain('Rupees Ten Thousand Only');
  payments.forEach(payment => expect(text()).toContain(payment.reference));
  const flow = () => tree.root.findAllByType(View).find(node => node.props.onLayout && StyleSheet.flatten(node.props.style)?.paddingHorizontal === 70)!;
  const footer = tree.root.findAllByType(View).find(node => node.props.onLayout && StyleSheet.flatten(node.props.style)?.marginTop === 'auto')!;
  await Renderer.act(async () => footer.props.onLayout({ nativeEvent: { layout: { y: 1500, height: 220 } } }));
  expect(StyleSheet.flatten(flow().props.style).transform[0].scale).toBeLessThan(1);
  expect(text()).toContain('RECEIPT-20');
  expect(text()).toContain('Chennai - 600032');
});

test('missing payment facts remain unknown; partially known amounts do not become a false total', async () => {
  await render({ ...certificate, contribution: { payments: [
    { amount: 5000, reference: 'KNOWN' }, { amount: null, reference: 'UNKNOWN' },
  ] } });
  expect(text()).not.toContain('a total amount of');
  expect(text()).not.toContain('Online');
  expect(text()).not.toContain('NaN');
  expect(text()).toContain('KNOWN');
  expect(text()).toContain('UNKNOWN');
});

test('an old contribution without payment rows retains its recorded amount and reference', async () => {
  await render({ ...certificate, contribution: { amount: 200000, receivedOn: '2026-10-07T12:00:00Z', reference: 'LEGACY-PAYMENT' } });
  expect(text()).toContain('LEGACY-PAYMENT');
  expect(text()).toContain('Rupees Two Lakh Only');
  expect(text()).not.toContain('Online');
});

test('amount words follow Indian numbering and the displayed two-decimal amount', () => {
  expect(amountInWords(0)).toBe('Rupees Zero Only');
  expect(amountInWords(10000000)).toBe('Rupees One Crore Only');
  expect(amountInWords(1000.5)).toBe('Rupees One Thousand and Fifty Paise Only');
  expect(amountInWords(1.999)).toBe('Rupees Two Only');
  for (const value of [null, undefined, NaN, Infinity, -1]) expect(amountInWords(value)).toBe('');
});
