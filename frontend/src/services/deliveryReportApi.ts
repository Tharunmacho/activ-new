import api from './api';

export type ReportChannel = 'email' | 'whatsapp' | 'push' | 'in_app';
export interface ReportCounts {
  records: number;
  accepted: number;
  delivered: number;
  opened: number;
  failed: number;
  queued: number;
  skipped: number;
  unconfirmed: number;
}
export interface ReportCampaign extends ReportCounts {
  _id: string;
  title: string;
  kind: string;
  sourceId?: string;
  event: string;
  createdAt: string;
  lastAt: string;
  currentAudience?: string;
  contentStatus?: string;
  publicationStatuses?: string[];
  publicationErrors?: string[];
}
export interface ReportRow {
  _id: string;
  channel: ReportChannel;
  recipientName: string;
  recipient?: string;
  title: string;
  campaignKey: string;
  event?: string;
  status: string;
  error?: string;
  createdAt: string;
  updatedAt?: string;
  openedAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  nextAttemptAt?: string;
  attempts?: number;
  provider?: string;
  templateId?: string;
  bookingRef?: string;
  region?: { state?: string; district?: string; block?: string };
  history?: { status: string; at: string; detail?: string }[];
}
export interface ReportFilters {
  page?: number;
  limit?: number;
  campaignPage?: number;
  campaignKey?: string;
  group?: string;
  channel?: string;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
}
export interface DeliveryReport {
  summary: ReportCounts & { recipients: number };
  channels: (ReportCounts & { _id: ReportChannel })[];
  campaigns: ReportCampaign[];
  rows: ReportRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
  campaignPagination: { page: number; total: number; pages: number };
  generatedAt: string;
}
export interface DeliveryRetrySelection {
  filters?: ReportFilters;
  ids?: string[];
}
export interface DeliveryRetryReason {
  reason: string;
  count: number;
}
export interface DeliveryRetryPreview {
  matched: number;
  reviewed?: number;
  remaining?: number;
  eligible: number;
  skipped: number;
  reasons: DeliveryRetryReason[];
  ids: string[];
  token: string;
  statusToken?: string;
  truncated: boolean;
}
export interface DeliveryRetryResult {
  alreadySubmitted?: boolean;
  processing?: boolean;
  attempted: number;
  sent: number;
  queued: number;
  failed: number;
  skipped: number;
  reasons: DeliveryRetryReason[];
}
export interface DeliveryRetryStatus extends DeliveryRetryResult {
  found: boolean;
}
export const getDeliveryRetryStatus = async (token: string): Promise<DeliveryRetryStatus> => {
  const response = await api.get('/notifications/reports/retry-status', {
    headers: { 'X-Delivery-Retry-Token': token }, timeout: 30000,
  });
  return response.data?.data ?? response.data;
};
export const previewDeliveryRetry = async (
  selection: DeliveryRetrySelection,
): Promise<DeliveryRetryPreview> => {
  const response = await api.post('/notifications/reports/retry-preview', selection, { timeout: 120000 });
  return response.data?.data ?? response.data;
};
export const retryDeliveryReport = async (
  confirmation: Pick<DeliveryRetryPreview, 'ids' | 'token'>,
): Promise<DeliveryRetryResult> => {
  const response = await api.post('/notifications/reports/retry', confirmation, { timeout: 120000 });
  return response.data?.data ?? response.data;
};
export const getDeliveryReport = async (
  filters: ReportFilters,
): Promise<DeliveryReport> => {
  const response = await api.get('/notifications/reports', {
    params: filters,
    timeout: 30000,
  });
  return response.data?.data ?? response.data;
};
export const CHANNEL_LABELS: Record<ReportChannel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  push: 'Push notifications',
  in_app: 'In-app notifications',
};

/** Display known historical delivery explanations without changing stored data. */
export const notificationReason = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (/^(?:Media upload error:|WhatsApp could not deliver:).*WebP image uploads are not currently supported/i.test(text)) {
    return 'WhatsApp could not use this WebP image. Use a JPG or PNG image, then try Resend.';
  }
  // Only a known WhatsApp wrapper or an explicit provider-code prefix is a code.
  // Email diagnostics and arbitrary identifiers containing these digits stay intact.
  const whatsappCode = /^WhatsApp could not deliver:.*\(code\s*(131048|131049|131053)\)\s*$/i.exec(text)?.[1]
    || /^(?:\(#?(131048|131049|131053)\)|#?(131048|131049|131053)\b)/.exec(text)?.slice(1).find(Boolean);
  if (whatsappCode) {
    return ({
      '131048': 'WhatsApp has temporarily limited messages from ACTIV. Try again later.',
      '131049': 'WhatsApp did not allow this promotional message to this number.',
      '131053': 'WhatsApp could not use the image or document. Check that the file opens, then try Resend.',
    } as Record<string, string>)[whatsappCode];
  }
  const rules: [RegExp, string][] = [
    [/^Media download error\b|^Media upload error:.*Downloading media from weblink failed/i, 'WhatsApp could not download the image or document. Check that the file opens, then try Resend.'],
    [/^Worker interrupted.*(?:outcome|delivery)/i, 'Sending stopped before we could confirm the result. Check the delivery history before sending again.'],
    [/^Provider (?:acceptance|outcome).*(?:uncertain|partial|unknown|could not be confirmed)/i, 'We could not confirm whether the message was sent. Check its delivery history before sending again.'],
    [/^SMTP (?:accepted only some intended email addresses|did not confirm acceptance for the intended email address)\./i, 'We could not confirm whether the message was sent to every email address. Check its delivery history before sending again.'],
    [/^Current delivery or recipient eligibility could not be verified\.?$/i, 'We could not check whether this message can be sent again. Please try again.'],
    [/^This message contains an expired or one-time credential\./i, 'This password message cannot be sent again. Use Forgot password, or set a new admin password in Manage Admins.'],
    [/^This recipient has no enabled push device\.?$/i, 'No phone or browser is currently set up to receive notifications for this person.'],
    [/^Another worker owns this delivery\.?$/i, 'This message is already being sent.'],
    [/^This delivery changed or another retry already claimed it\.?$/i, 'This message changed or is already being sent again. Refresh the report before trying again.'],
    [/^This delivery changed or was already queued\.?$/i, 'This message changed or is already waiting to send. Refresh the report before trying again.'],
    [/^This (?:delivery|update) is (?:already )?queued, (?:already )?retried, or unavailable\.?$/i, 'This message is waiting to send, was already sent again, or is no longer available.'],
    [/^This delivery is already accepted, delivered, read, replaced, or has no confirmed failure\.?$/i, 'This message was already sent, delivered, opened or replaced, or has no confirmed failure.'],
    [/^A retry is running or its outcome needs review\.?$/i, 'This message is being sent again, or its last sending result needs review.'],
    [/^The retry outcome needs review;/i, 'Check the result of the last send. This message will not be sent again automatically.'],
    [/^The provider did not accept this retry\.?$/i, 'The sending service did not accept this message.'],
    [/^This delivery has no external failed message to retry\.?$/i, 'There is no failed message available to send again.'],
    [/^This delivery is older than the 30-day retry window\.?$/i, 'Messages more than 30 days old cannot be sent again.'],
    [/^No usable recipient address is available\.?$/i, 'No valid email address or phone number is available.'],
    [/^no_enabled_devices$/i, 'No phone or browser is currently set up to receive notifications for this person.'],
    [/^(?:push_unconfigured|push\/unavailable)$/i, 'The push notification service is not ready. Please try again later.'],
    [/^messaging\/(?:invalid-registration-token|registration-token-not-registered)\b/i, 'This phone or browser needs to turn on notifications again.'],
    [/^messaging\/(?:quota-exceeded|message-rate-exceeded)\b/i, 'The sending service is busy. This message can be tried again later.'],
    [/^messaging\/(?:authentication-error|mismatched-credential|third-party-auth-error)\b/i, 'The push notification service needs its settings checked.'],
    [/^(?:\(#?132005\)|#?132005\b)/i, 'The message was too long for WhatsApp.'],
    [/^(?:\(#?132001\)|#?132001\b)/i, 'The WhatsApp message format could not be found.'],
    [/^(?:\(#?131026\)|#?131026\b)/i, 'This number could not receive the WhatsApp message.'],
    [/^(?:\(#?131049\)|#?131049\b)/i, 'WhatsApp blocked this promotional message for this number.'],
    [/^(?:\(#?131047\)|#?131047\b)/i, 'WhatsApp requires an approved message format because the person has not replied recently.'],
    [/^(?:SMTP[ :]+)?535(?:[ -]|$)|^Invalid login:\s*535\b/i, 'The email service could not sign in. Its settings need checking.'],
    [/^(?:ETIMEDOUT|ECONNREFUSED)\b/i, 'The sending service did not respond. Check the message history before sending again.'],
  ];
  const rule = rules.find(([pattern]) => pattern.test(text));
  return rule ? rule[1] : text.replace(/\btemplate skipped\s*:/gi, 'template not used:');
};

export const notificationTemplatePath = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.replace(/(^| \| )([^|]+?) skipped:/g, '$1$2 not used:');
};

export const statusLabel = (row: Pick<ReportRow, 'channel' | 'status'>) => {
  if (row.status === 'accepted') return 'Sent';
  if (row.status === 'read') return 'Seen';
  return (
    (
      {
        queued: 'Waiting',
        unconfirmed: 'No recorded open',
        sent: 'Sent',
        delivered: 'Delivered',
        failed: 'Failed',
        skipped: 'Not sent',
        mock: 'Not sent',
        marked_read: 'Sent',
      } as Record<string, string>
    )[row.status] || row.status
  );
};
