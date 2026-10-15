import api from './api';

export type AssociationUpdatePreferences = { email: boolean; whatsapp: boolean; whatsappNumber: string };
export type AssociationUpdateChannel = 'email' | 'whatsapp';
const endpoint = '/notifications/update-preferences';
export class UnconfirmedUpdatePreferencesError extends Error {}
const preferencesFrom = (response: any): AssociationUpdatePreferences => {
    const data = response?.data?.data ?? response?.data;
    if (typeof data?.email !== 'boolean' || typeof data?.whatsapp !== 'boolean' || typeof data?.whatsappNumber !== 'string') {
        throw new UnconfirmedUpdatePreferencesError('Your preferences could not be confirmed. Please reload and try again.');
    }
    return { email: data.email, whatsapp: data.whatsapp, whatsappNumber: data.whatsappNumber };
};
export const getAssociationUpdatePreferences = async () => preferencesFrom(await api.get(endpoint));
export const saveAssociationUpdatePreference = async (channel: AssociationUpdateChannel, enabled: boolean) =>
    preferencesFrom(await api.patch(endpoint, { [channel]: enabled }));
