import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { BackHandler, Text, TextInput } from 'react-native';
import EventBookingScreen from '../src/screens/member/events/EventBookingScreen';
import { createEventBooking, checkEventBooking, getBookableEvent, getMyProfile, getEventBooking } from '../src/services/memberApi';
import api, { getAuthToken, getUserRole } from '../src/services/api';
import { clearPublicAction, takePublicAction } from '../src/services/publicNavigation';

const mockLogin = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/stores/exampleStore', () => ({ useAuthStore: (select: any) => select({ login: mockLogin }) }));

jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../src/services/api', () => ({ __esModule: true, default: { post: jest.fn() }, getAuthToken: jest.fn(), getUserRole: jest.fn() }));
jest.mock('../src/services/memberApi', () => ({
  getBookableEvent: jest.fn(), getMyProfile: jest.fn(), createEventBooking: jest.fn(),
  checkEventBooking: jest.fn(), getEventBooking: jest.fn().mockResolvedValue(null),
}));
jest.mock('../src/ui', () => {
  const React = require('react');
  const { View, Text, TextInput, Pressable } = require('react-native');
  const actual = jest.requireActual('../src/ui');
  return {
    ...actual,
    PremiumPage: ({ header, footer, children }: any) => <View>{header}{children}{footer}</View>,
    PremiumPageHeader: () => null,
    PremiumSection: ({ children }: any) => <View>{children}</View>,
    FadeInUp: ({ children }: any) => <View>{children}</View>,
    PremiumInput: (props: any) => <TextInput {...props} accessibilityLabel={props.label} />,
    GradientButton: ({ label, onPress }: any) => <Pressable accessibilityLabel={label} onPress={onPress}><Text>{label}</Text></Pressable>,
    PressableScale: ({ children, onPress, accessibilityLabel, disabled }: any) => <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} disabled={disabled}>{children}</Pressable>,
  };
});

const navigation = { navigate: jest.fn(), goBack: jest.fn(), setParams: jest.fn(), isFocused: jest.fn(() => true) };
let tree: Renderer.ReactTestRenderer;
const inputs = () => tree.root.findAllByType(TextInput);
const screenText = () => tree.root.findAllByType(Text).map(node => React.Children.toArray(node.props.children).filter(value => typeof value === 'string' || typeof value === 'number').join('')).join('\n');
const edit = async (i: number, value: string) => { await act(async () => inputs()[i].props.onChangeText(value)); };
const press = async (label: string) => {
  const button = tree.root.findAll(b => b.props.accessibilityLabel === label && typeof b.props.onPress === 'function')[0];
  if (!button) throw new Error(`Button missing: ${label}. Available: ${tree.root.findAll(b => typeof b.props.onPress === 'function').map(b => b.props.accessibilityLabel || b.props.label).join(', ')}`);
  await act(async () => button.props.onPress());
};
const render = async (params = {}) => { await act(async () => { tree = Renderer.create(<EventBookingScreen navigation={navigation} route={{ params: { eventId: 'conference', ...params } }} />); }); };
const confirm = async () => { await press('Review booking'); expect(createEventBooking).not.toHaveBeenCalled(); await press('Confirm booking'); };

beforeEach(() => {
  jest.clearAllMocks();
  navigation.isFocused.mockReturnValue(true);
  clearPublicAction();
  (api.post as jest.Mock).mockReset();
  (getAuthToken as jest.Mock).mockResolvedValue('member-token');
  (getUserRole as jest.Mock).mockResolvedValue('member');
  (getBookableEvent as jest.Mock).mockResolvedValue({ title: 'Conference', amount: 0, maxPerBooking: 10, capacity: 100, seatsLeft: 100 });
  (getMyProfile as jest.Mock).mockResolvedValue({ fullName: 'Booker', email: 'booker@example.test', phoneNumber: '9000000001' });
  (checkEventBooking as jest.Mock).mockResolvedValue({});
  (createEventBooking as jest.Mock).mockResolvedValue({ bookingRef: 'REF', status: 'active', payment: { status: 'not_required' } });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('one seat visibly fills Participant 1 and follows changes to the booking contact', async () => {
  await render();
  expect(JSON.stringify(tree.toJSON())).toContain('Participant 1');
  expect(inputs()).toHaveLength(7);
  expect(inputs()[3].props.value).toBe('Booker');
  expect(inputs()[4].props.value).toBe('booker@example.test');
  expect(inputs()[5].props.value).toBe('9000000001');
  await edit(0, 'Updated Booker');
  expect(inputs()[3].props.value).toBe('Updated Booker');
  await edit(0, 'Booker');
  await confirm();
  expect(createEventBooking).toHaveBeenCalledWith('conference', expect.objectContaining({
    noOfPersons: 1, participants: [{ name: 'Booker', email: 'booker@example.test', phone: '9000000001' }],
  }), false);
});

test('book for someone else requires the friend and never substitutes the booker for an empty row', async () => {
  await render({ forOthers: true });
  expect(inputs()[3].props.value).toBe(''); expect(inputs()[4].props.value).toBe('');
  await edit(0, 'Updated Booker'); expect(inputs()[3].props.value).toBe('');
  await press('Review booking');
  expect(checkEventBooking).not.toHaveBeenCalled(); expect(createEventBooking).not.toHaveBeenCalled();
  expect(inputs()[3].props.error).toBeTruthy(); expect(inputs()[4].props.error).toBeTruthy(); expect(inputs()[5].props.error).toBeTruthy();
  await edit(3, 'Friend'); await edit(4, 'friend@example.test'); await edit(5, '9000000001');
  await confirm();
  expect(createEventBooking).toHaveBeenCalledWith('conference', expect.objectContaining({ useBookerForFirstParticipant: false, participants: [{ name: 'Friend', email: 'friend@example.test', phone: '9000000001' }] }), false);
});

test('confirmed receipt starts another booking with fresh availability and an empty attendee', async () => {
  (getEventBooking as jest.Mock).mockResolvedValueOnce({ bookingRef: 'EXISTING', eventId: 'conference', status: 'active', payment: { status: 'paid' }, totalAmount: 600 });
  await render({ ref: 'EXISTING' });
  expect(screenText()).toContain('Booking confirmed');
  await press('Book for someone else');
  expect(getBookableEvent).toHaveBeenLastCalledWith('conference', false);
  expect(inputs()[0].props.value).toBe('Booker'); expect(inputs()[3].props.value).toBe('');
  expect(navigation.setParams).toHaveBeenCalledWith({ ref: undefined, forOthers: true });
  await press('Review booking'); expect(createEventBooking).not.toHaveBeenCalled(); expect(inputs()[4].props.error).toBeTruthy();
});

test('late paid booking awaiting organiser review never displays a confirmed ticket or another payment action', async () => {
  (getEventBooking as jest.Mock).mockResolvedValueOnce({ bookingRef: 'REVIEW', eventId: 'conference', status: 'waitlist', payment: { status: 'paid', reconciliationRequired: true }, totalAmount: 600 });
  await render({ ref: 'REVIEW' });
  expect(screenText()).toContain('Payment received — organiser review needed');
  expect(screenText()).toContain('Please do not pay again');
  expect(screenText()).not.toContain('Booking confirmed');
  expect(screenText()).not.toContain('no payment is due');
  expect(createEventBooking).not.toHaveBeenCalled();
});

test.each(['online', 'offline'])('confirmed %s receipt does not assume an email or entry pass was delivered', async mode => {
  const person = { name: 'Participant with a complete name', email: 'participant.long.address@example.test', phone: '9000000002' };
  (getEventBooking as jest.Mock).mockResolvedValueOnce({ bookingRef: 'CONFIRMED', eventId: 'conference', mode,
    status: 'active', payment: { status: 'not_required' }, participants: [person], passes: [] });
  await render({ ref: 'CONFIRMED' });
  expect(screenText()).toContain(person.name);
  expect(screenText()).toContain(person.email);
  expect(screenText()).toContain(person.phone);
  expect(screenText()).not.toContain('available in your confirmation email');
  if (mode === 'online') {
    expect(screenText()).toContain('use the online event details below');
    expect(screenText()).not.toContain('show your entry pass at the venue');
  } else expect(screenText()).toContain('Refresh your booking or contact the organiser with your booking reference.');
});

test('a single guest can differ from the booking contact, and the same data reaches check and create', async () => {
  await render();
  await edit(3, 'Guest'); await edit(4, 'Guest@Example.test'); await edit(5, '+91 9000000002');
  await confirm();
  const [, payload] = (createEventBooking as jest.Mock).mock.calls[0];
  expect(payload.name).toBe('Booker');
  expect(payload.participants).toEqual([{ name: 'Guest', email: 'guest@example.test', phone: '9000000002' }]);
  expect((checkEventBooking as jest.Mock).mock.calls[0][1].participants).toEqual(payload.participants);
  expect(payload.amount).toBeUndefined();
});

test('Participant 1 may explicitly use the same contacts as the booker', async () => {
  await render();
  await edit(3, 'Booker'); await edit(4, 'booker@example.test'); await edit(5, '9000000001');
  await confirm();
  expect(createEventBooking).toHaveBeenCalledTimes(1);
});

test('one attendee row per seat, retaining entered details when count changes', async () => {
  await render(); await edit(3, 'Guest');
  await press('One more seat');
  expect(inputs()).toHaveLength(10);
  expect(JSON.stringify(tree.toJSON())).toContain('Participant 2');
  expect(inputs()[3].props.value).toBe('Guest');
  await press('One fewer seat');
  expect(inputs()).toHaveLength(7);
  expect(inputs()[3].props.value).toBe('Guest');
});

test('duplicate attendee contacts are rejected, including the blank first row fallback', async () => {
  await render(); await press('One more seat');
  await edit(6, 'Another attendee'); await edit(7, 'booker@example.test');
  await press('Review booking');
  expect(inputs()[7].props.error).toBe('Use another email');
  expect(createEventBooking).not.toHaveBeenCalled();
});

test('server error for Participant 1 appears on its own field', async () => {
  (checkEventBooking as jest.Mock).mockRejectedValue({ response: { data: { fields: { 'participants.0.email': 'Guest already booked' } } } });
  await render(); await edit(3, 'Guest'); await edit(4, 'guest@example.test');
  await press('Review booking');
  expect(inputs()[4].props.error).toBe('Guest already booked');
  expect(inputs()[1].props.error).toBeFalsy();
  expect(createEventBooking).not.toHaveBeenCalled();
});

test('paid guest booking keeps all attendee rows and opens the shared checkout', async () => {
  (getBookableEvent as jest.Mock).mockResolvedValue({ title: 'Conference', amount: 1000, maxPerBooking: 10 });
  (createEventBooking as jest.Mock).mockResolvedValue({ bookingRef: 'PAID-REF', payment: { status: 'pending' } });
  await render(); await press('One more seat'); await edit(6, 'Guest'); await edit(7, 'guest@example.test'); await edit(8, '9173652408');
  await press('Review booking');
  expect(createEventBooking).not.toHaveBeenCalled();
  await press('Pay ₹2,000 and confirm');
  expect((createEventBooking as jest.Mock).mock.calls[0][1].participants).toHaveLength(2);
  expect(navigation.navigate).toHaveBeenCalledWith('PaymentCheckout', { orderType: 'event_booking', bookingRef: 'PAID-REF', eventId: 'conference' });
});

test('ten seats require all ten complete participants before review or payment', async () => {
  await render();
  for (let i = 1; i < 10; i++) await press('One more seat');
  await press('Review booking');
  expect(checkEventBooking).not.toHaveBeenCalled();
  expect(createEventBooking).not.toHaveBeenCalled();
  for (let i = 1; i < 10; i++) {
    expect(inputs()[3 + i * 3].props.error).toBeTruthy();
    expect(inputs()[4 + i * 3].props.error).toBeTruthy();
    expect(inputs()[5 + i * 3].props.error).toBeTruthy();
    await edit(3 + i * 3, 'Delegate ' + i);
    await edit(4 + i * 3, `delegate${i}@example.test`);
    await edit(5 + i * 3, '91736524' + String(i).padStart(2, '0'));
  }
  await confirm();
  const payload = (createEventBooking as jest.Mock).mock.calls[0][1];
  expect(payload.noOfPersons).toBe(10);
  expect(payload.participants).toHaveLength(10);
  expect(payload.participants.every((person: any) => person.name && person.email && person.phone)).toBe(true);
});

test('required event questions validate before review and persist through edit', async () => {
  (getBookableEvent as jest.Mock).mockResolvedValue({ title: 'Conference', amount: 0, maxPerBooking: 10, registrationFields: [{ key: 'organisation', label: 'Organisation', type: 'text', required: true }] });
  await render();
  await press('Review booking');
  expect(createEventBooking).not.toHaveBeenCalled();
  expect(inputs()[7].props.error).toBe('Organisation is required');
  await edit(7, 'ACTIV');
  await press('Review booking'); await press('Edit details');
  expect(inputs()[7].props.value).toBe('ACTIV');
  await confirm();
  expect(createEventBooking).toHaveBeenCalledWith('conference', expect.objectContaining({ responses: { organisation: 'ACTIV' } }), false);
});

test('changed price must be reviewed before booking is created', async () => {
  const event = { title: 'Conference', amount: 1000, maxPerBooking: 10 };
  (getBookableEvent as jest.Mock).mockResolvedValue(event);
  await render(); await press('Review booking');
  (getBookableEvent as jest.Mock).mockResolvedValue({ ...event, amount: 1200 });
  await press('Pay ₹1,000 and confirm');
  expect(createEventBooking).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('The event price has changed');
});

test('sold-out availability blocks checkout and does not promise a seat', async () => {
  (getBookableEvent as jest.Mock).mockResolvedValue({ title: 'Conference', amount: 1000, capacity: 50, seatsLeft: 0 });
  await render();
  expect(JSON.stringify(tree.toJSON())).toContain('Fully booked');
  expect(createEventBooking).not.toHaveBeenCalled();
  expect(tree.root.findAll(b => b.props.label === 'Review booking')).toHaveLength(0);
});

test('ticket lookup errors never silently open a fresh booking form', async () => {
  (getEventBooking as jest.Mock).mockRejectedValueOnce(new Error('Network unavailable'));
  await act(async () => { tree = Renderer.create(<EventBookingScreen navigation={navigation} route={{ params: { eventId: 'conference', ref: 'EXISTING' } }} />); });
  expect(JSON.stringify(tree.toJSON())).toContain('The booking could not be loaded');
  expect(inputs()).toHaveLength(0);
  expect(createEventBooking).not.toHaveBeenCalled();
});

test('active failed payment shows failure, never confirmation or entry pass', async () => {
  (getEventBooking as jest.Mock).mockResolvedValueOnce({ bookingRef: 'FAILED', eventId: 'conference', status: 'active', payment: { status: 'failed' }, totalAmount: 1000 });
  await act(async () => { tree = Renderer.create(<EventBookingScreen navigation={navigation} route={{ params: { eventId: 'conference', ref: 'FAILED' } }} />); });
  const text = JSON.stringify(tree.toJSON());
  expect(text).toContain('Payment failed'); expect(text).not.toContain('Booking confirmed');
  expect(text).not.toContain('Show this entry pass');
});

const guestSession = () => {
  (getAuthToken as jest.Mock).mockResolvedValue(null);
  (getUserRole as jest.Mock).mockResolvedValue(null);
};
const guestDetails = async () => { await edit(0, 'Visitor'); await edit(1, 'visitor@example.test'); await edit(2, '9000000003'); };
const memberCredentials = async () => { await edit(0, ' MEMBER@EXAMPLE.TEST '); await edit(1, 'test-password'); };
const loginResponse = { data: { data: { token: 'new-member-token', role: 'member', user: { fullName: 'Member', password: 'must-not-persist' } } } };

test('signed-out Book Now shows both choices and never reads a member profile', async () => {
  guestSession(); await render();
  const view = screenText();
  expect(view).toContain('Continue as guest'); expect(view).toContain('Sign in & checkout');
  expect(view).not.toContain('Review booking');
  expect(getBookableEvent).toHaveBeenCalledWith('conference', true);
  expect(getMyProfile).not.toHaveBeenCalled();
  expect(navigation.navigate).not.toHaveBeenCalled();
});

test('guest completes a free native booking and returns to public events', async () => {
  guestSession(); await render(); await press('Continue as guest'); await guestDetails(); await confirm();
  expect(createEventBooking).toHaveBeenCalledWith('conference', expect.objectContaining({ name: 'Visitor', email: 'visitor@example.test', noOfPersons: 1 }), true);
  expect(checkEventBooking).toHaveBeenCalledWith('conference', expect.any(Object), true);
  expect(getMyProfile).not.toHaveBeenCalled(); expect(mockLogin).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('Booking confirmed');
  await press('Back to events');
  expect(navigation.navigate).toHaveBeenLastCalledWith('PublicExplore', { section: 'events' });
});

test('Android Back leaves policy screens alone and preserves the booking review until focused again', async () => {
  const addListener = jest.spyOn(BackHandler, 'addEventListener');
  guestSession(); await render(); await press('Continue as guest'); await guestDetails(); await press('Review booking');
  const back = () => {
    const calls = addListener.mock.calls.filter(([event]) => event === 'hardwareBackPress');
    return calls[calls.length - 1][1]();
  };
  navigation.isFocused.mockReturnValue(false);
  await act(async () => { expect(back()).toBe(false); });
  expect(screenText()).toContain('Confirm booking');
  navigation.isFocused.mockReturnValue(true);
  await act(async () => { expect(back()).toBe(true); });
  expect(screenText()).toContain('Review booking');
  expect(inputs()[0].props.value).toBe('Visitor');
  await act(async () => { expect(back()).toBe(true); });
  expect(screenText()).toContain('Continue as guest');
  addListener.mockRestore();
});

test('priced guest booking uses the server total and the existing payment checkout', async () => {
  guestSession();
  (getBookableEvent as jest.Mock).mockResolvedValue({ id: 'conference', title: 'Conference', price: 1000, amount: 1000, hasMemberRate: true, memberPrice: 500 });
  (createEventBooking as jest.Mock).mockResolvedValue({ bookingRef: 'GUEST-PAID', payment: { status: 'pending' }, totalAmount: 1000 });
  await render(); await press('Continue as guest'); await guestDetails(); await press('Review booking'); await press('Pay ₹1,000 and confirm');
  expect(createEventBooking).toHaveBeenCalledWith('conference', expect.not.objectContaining({ amount: expect.anything() }), true);
  expect(navigation.navigate).toHaveBeenCalledWith('PaymentCheckout', { orderType: 'event_booking', bookingRef: 'GUEST-PAID', eventId: 'conference' });
  expect(getMyProfile).not.toHaveBeenCalled();
});

test.each([true, false])('inline sign-in refreshes the server rate, active paid membership: %s', async active => {
  guestSession();
  (getBookableEvent as jest.Mock).mockImplementation(async (_id: string, guest: boolean) => ({ id: 'conference', title: 'Conference', price: 1000, amount: !guest && active ? 500 : 1000, memberPrice: 500, hasMemberRate: true, memberRateApplied: !guest && active, memberSaving: !guest && active ? 500 : 0 }));
  (api.post as jest.Mock).mockResolvedValue(loginResponse);
  await render(); await memberCredentials(); await press('Sign in & checkout');
  expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'member@example.test', password: 'test-password', portal: 'member' });
  expect(mockLogin).toHaveBeenCalledWith({ fullName: 'Member' }, 'new-member-token', 'member');
  expect(getBookableEvent).toHaveBeenLastCalledWith('conference', false);
  expect(navigation.navigate).not.toHaveBeenCalled();
  await guestDetails(); await press('Review booking');
  const payLabel = active ? 'Pay ₹500 and confirm' : 'Pay ₹1,000 and confirm';
  expect(JSON.stringify(tree.toJSON())).toContain(payLabel);
  await press(payLabel);
  expect(createEventBooking).toHaveBeenCalledWith('conference', expect.any(Object), false);
});

test('incorrect member credentials keep both choices available', async () => {
  guestSession(); (api.post as jest.Mock).mockRejectedValue({ response: { data: { message: 'Invalid email or password' } } });
  await render(); await memberCredentials(); await press('Sign in & checkout');
  expect(screenText()).toContain('Invalid email or password');
  expect(mockLogin).not.toHaveBeenCalled(); expect(createEventBooking).not.toHaveBeenCalled();
  await press('Continue as guest'); expect(JSON.stringify(tree.toJSON())).toContain('Review booking');
});

test('a failed member-price refresh blocks checkout and retries without posting the password again', async () => {
  guestSession(); (api.post as jest.Mock).mockResolvedValue(loginResponse);
  await render(); await memberCredentials();
  (getBookableEvent as jest.Mock).mockRejectedValueOnce(new Error('Price unavailable'));
  await press('Sign in & checkout');
  expect(screenText()).toContain('Price unavailable');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Review booking');
  await press('Continue with membership rate');
  expect(api.post).toHaveBeenCalledTimes(1); expect(JSON.stringify(tree.toJSON())).toContain('Review booking');
});

test('admin credentials cannot be used for the paid member option', async () => {
  guestSession(); (api.post as jest.Mock).mockResolvedValue({ data: { data: { token: 'admin-token', role: 'super_admin' } } });
  await render(); await memberCredentials(); await press('Sign in & checkout');
  expect(mockLogin).not.toHaveBeenCalled(); expect(createEventBooking).not.toHaveBeenCalled();
  expect(screenText()).toContain('Use your ACTIV member account');
});

test('a saved administrator session is not sent with a guest booking', async () => {
  (getAuthToken as jest.Mock).mockResolvedValue('admin-token'); (getUserRole as jest.Mock).mockResolvedValue('super_admin');
  await render(); await press('Continue as guest'); await guestDetails(); await confirm();
  expect(getBookableEvent).toHaveBeenCalledWith('conference', true);
  expect(createEventBooking).toHaveBeenCalledWith('conference', expect.any(Object), true);
  expect(getMyProfile).not.toHaveBeenCalled();
});

test('forgot-password remembers this booking for the existing login return', async () => {
  guestSession(); await render(); await press('Forgot password?');
  expect(navigation.navigate).toHaveBeenCalledWith('ForgotPassword', { portal: 'member' });
  expect(takePublicAction()).toEqual({ name: 'EventBooking', params: { eventId: 'conference' } });
});

test('guest payment return opens the existing ticket without asking for sign-in or a second booking', async () => {
  guestSession();
  (getEventBooking as jest.Mock).mockResolvedValueOnce({ bookingRef: 'GUEST-DONE', eventId: 'conference', status: 'active', payment: { status: 'paid' }, totalAmount: 1000 });
  await act(async () => { tree = Renderer.create(<EventBookingScreen navigation={navigation} route={{ params: { eventId: 'conference', ref: 'GUEST-DONE' } }} />); });
  expect(JSON.stringify(tree.toJSON())).toContain('Booking confirmed');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Continue as guest');
  expect(getMyProfile).not.toHaveBeenCalled(); expect(createEventBooking).not.toHaveBeenCalled();
  await press('Back to events'); expect(navigation.navigate).toHaveBeenLastCalledWith('PublicExplore', { section: 'events' });
});
