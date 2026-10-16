import api, { unwrap } from "./api";

export type ReportChannel = "email" | "whatsapp" | "push" | "in_app";
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
export const getDeliveryReport = async (
  filters: ReportFilters
): Promise<DeliveryReport> =>
  unwrap<DeliveryReport>(
    await api.get("/notifications/reports", {
      params: filters,
      timeout: 30000,
    }),
    null
  );
export const recordNotificationOpen = (
  id: string,
  channel: "push" | "in_app"
) => api.patch(`/notifications/${encodeURIComponent(id)}/open`, { channel });
export const CHANNEL_LABELS: Record<ReportChannel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  push: "Push notifications",
  in_app: "In-app notifications",
};
export const statusLabel = (row: Pick<ReportRow, "channel" | "status">) => {
  if (row.status === "accepted")
    return row.channel === "in_app" ? "In member inbox" : "Provider accepted";
  if (row.status === "read")
    return row.channel === "push"
      ? "Notification tapped"
      : row.channel === "whatsapp"
      ? "Read on WhatsApp"
      : "Opened";
  return (
    (
      {
        queued: "Queued",
        sent: "Sent to handset",
        delivered: "Delivered",
        failed: "Failed",
        skipped: "Skipped",
        mock: "Not sent",
        marked_read: "Marked as read",
      } as Record<string, string>
    )[row.status] || row.status
  );
};
