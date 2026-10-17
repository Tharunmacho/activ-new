export type UpdateDeliveryChannels = { email: boolean; whatsapp: boolean; push: boolean };

export const UPDATE_DELIVERY_CHANNELS = [
    { key: 'email', label: 'Email', detail: 'Email members who have enabled association updates.' },
    { key: 'whatsapp', label: 'WhatsApp', detail: 'Message members who have opted in to WhatsApp updates.' },
    { key: 'push', label: 'Push notifications', detail: 'Notify eligible members and included visitors who allow app or browser notifications.' },
] as const;

/** New updates require an explicit choice; old records keep their existing delivery policy. */
export function resolveUpdateDeliveryChannels(announcement?: { deliveryChannels?: UpdateDeliveryChannels } | null): UpdateDeliveryChannels {
    const value = announcement?.deliveryChannels;
    const legacy = !!announcement && value === undefined;
    if (legacy) return { email: true, whatsapp: true, push: true };
    const keys = ['email', 'whatsapp', 'push'] as const;
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).length !== keys.length || keys.some(key => typeof value[key] !== 'boolean')) {
        return { email: false, whatsapp: false, push: false };
    }
    return { email: value.email, whatsapp: value.whatsapp, push: value.push };
}

export function updateDeliverySummary(channels: UpdateDeliveryChannels): string {
    return UPDATE_DELIVERY_CHANNELS.filter(channel => channels[channel.key]).map(channel => channel.label).join(', ') || 'In ACTIV only';
}
