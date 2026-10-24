import { getAuthToken, getUserRole } from './api';
import { homeForRole } from './session';
import { getPublicEvent } from './publicContent';
import type { PublicAction } from '../utils/publicBrowse';
import type { RootStackParamList } from '../types';

type Destination = { name: 'EventBooking'; params: RootStackParamList['EventBooking'] }
  | { name: 'MemberEventDetail'; params: RootStackParamList['MemberEventDetail'] }
  | { name: 'UpdateDetail'; params: RootStackParamList['UpdateDetail'] }
  | { name: 'MembershipPlans' | 'MemberDonations' };
let pending: { destination: Destination; at: number } | null = null;
export const clearPublicAction = () => { pending = null; };
export const rememberEventBooking = (eventId: string) => {
  pending = { destination: { name: 'EventBooking', params: { eventId } }, at: Date.now() };
};
export const takePublicAction = (): Destination | null => {
  const value = pending;
  pending = null;
  return value && Date.now() - value.at < 30 * 60 * 1000 ? value.destination : null;
};
export async function openPublicAction(navigation: any, action: PublicAction) {
  if (['register', 'event', 'member-event', 'member-update'].includes(action.kind)) clearPublicAction();
  let destination: Destination | null = null;
  if (action.kind === 'event') {
    const event = await getPublicEvent(action.id);
    const id = String(event?.id || event?._id || '');
    if (!id) throw new Error('This event is no longer available.');
    // The native booking screen offers guest checkout and member sign-in.
    // Opening a public event must never require an account first.
    navigation.navigate('EventBooking', { eventId: id });
    return;
  } else if (action.kind === 'membership') destination = { name: 'MembershipPlans' };
  else if (action.kind === 'donate') destination = { name: 'MemberDonations' };
  // Resume only the selected gated detail. Its normal authenticated API still
  // checks the recipient's membership and audience after sign-in.
  else if (action.kind === 'member-event') destination = { name: 'MemberEventDetail', params: { id: action.id } };
  else if (action.kind === 'member-update') destination = { name: 'UpdateDetail', params: { id: action.id } };
  const [token, role] = await Promise.all([getAuthToken(), getUserRole()]);
  if (token && role === 'member') {
    if (destination) navigation.navigate(destination.name, 'params' in destination ? destination.params : undefined);
    else {
      const home = await homeForRole(role);
      navigation.navigate(home || 'MemberMain');
    }
    return;
  }
  if (action.kind === 'register') {
    navigation.navigate('RegistrationStep1');
    return;
  }
  pending = destination ? { destination, at: Date.now() } : null;
  navigation.navigate('Login');
}
