import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Users,
  Send,
  Eye,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Mail,
  MessageSquare,
  Bell,
  Inbox,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import {
  ADMIN_CARD,
  ADMIN_SECONDARY_BTN,
  AdminStat,
} from "@/features/admin/components/AdminUI";
import { CARD_TITLE } from "@/components/layout/appTypography";
import {
  getDeliveryReport,
  previewDeliveryRetry,
  retryDeliveryReport,
  getDeliveryRetryStatus,
  CHANNEL_LABELS,
  statusLabel,
  type DeliveryReport,
  type ReportFilters,
  type ReportRow,
  type DeliveryRetryPreview,
  type DeliveryRetryResult,
} from "@/services/deliveryReportApi";
import { errorMessage } from "@/services/activApi";
import { notificationReason } from "@/utils/notificationCopy";
import { messageLabel } from "@/features/admin/components/DeliveryUI";

const input =
  "h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-ui-small focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none";
const fmt = (n?: number) => Number(n || 0).toLocaleString("en-IN");
const when = (s?: string) =>
  s
    ? new Date(s).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not recorded";
const human = (s = "") =>
  s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
const icons = {
  email: Mail,
  whatsapp: MessageSquare,
  push: Bell,
  in_app: Inbox,
};
const tones: Record<string, string> = {
  failed: "bg-rose-50 text-rose-700",
  read: "bg-emerald-50 text-emerald-700",
  delivered: "bg-emerald-50 text-emerald-700",
  accepted: "bg-blue-50 text-blue-700",
  queued: "bg-amber-50 text-amber-800",
};
const startDate = () =>
  new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
const recipientColumns =
  "grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_14rem]";
const canReviewResend = (row: ReportRow) =>
  row.status === "failed" && ["email", "whatsapp", "push"].includes(row.channel);
const reportTitle = (row: ReportRow) => row.event && (!row.title || row.title === row.templateId || row.title === row.event)
  ? messageLabel(row.event)
  : row.title || "Notification";

function SummaryCard({
  active,
  onClick,
  ...stat
}: Parameters<typeof AdminStat>[0] & { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Show ${stat.label.toLowerCase()}`}
      aria-pressed={active}
      aria-controls="delivery-report-recipients"
      onClick={onClick}
      className={`min-w-0 rounded-2xl text-left transition-shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 [&>[data-admin-stat]]:h-full ${
        active ? "ring-2 ring-blue-600 ring-offset-2" : "hover:ring-2 hover:ring-blue-300"
      }`}
    >
      <AdminStat {...stat} footer={active ? "Selected · View records" : "View delivery records"} />
    </button>
  );
}

function Ratio({
  label,
  value,
  total,
  color = "bg-blue-500",
}: {
  label: string;
  value: number;
  total: number;
  color?: string;
}) {
  const percent = total ? Math.round((value / total) * 1000) / 10 : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-ui-caption">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-700">
          {fmt(value)} / {fmt(total)} · {percent}%
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Detail({ row }: { row: ReportRow }) {
  return (
    <div className="grid gap-4 p-4 sm:p-5 bg-slate-50/70 text-ui-small [overflow-wrap:anywhere] sm:grid-cols-2">
      <div className="space-y-2">
        <p className="font-semibold text-slate-900">Person & message</p>
        <p>
          {row.recipientName} · {row.recipient || "ACTIV notifications / device"}
        </p>
        <p className="text-slate-500">
          {[row.region?.state, row.region?.district, row.region?.block]
            .filter(Boolean)
            .join(" / ") || "Region not recorded"}
        </p>
        <p>
          Sending service: {row.provider || "Not recorded"} · Tries:{" "}
          {fmt(row.attempts)}
        </p>
        {row.templateId && (
          <p className="break-all">Template: {row.templateId}</p>
        )}
        {row.bookingRef && <p>Booking: {row.bookingRef}</p>}
        {row.error && (
          <p
            className={
              row.status === "failed" ? "text-rose-700" : "text-slate-600"
            }
          >
            {notificationReason(row.error)}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <p className="font-semibold text-slate-900">Recorded timeline</p>
        <p>Created: {when(row.createdAt)}</p>
        {row.history?.map((event, i) => (
          <p key={i}>
            {statusLabel({ channel: row.channel, status: event.status })}: {when(event.at)}
            {event.detail ? ` · ${notificationReason(event.detail)}` : ""}
          </p>
        ))}
        {row.deliveredAt && <p>Delivered: {when(row.deliveredAt)}</p>}
        {row.openedAt && <p>Seen: {when(row.openedAt)}</p>}
        {row.readAt && <p>Marked read: {when(row.readAt)}</p>}
        {row.status === "queued" && row.nextAttemptAt && (
          <p>Next try: {when(row.nextAttemptAt)}</p>
        )}
        <p className="text-slate-500">
          Sent means the sending service received the message. It does not confirm arrival.
          Seen means an open or tap was recorded. Email opens are not tracked.
        </p>
      </div>
      {(row.error || row.history?.some(event => event.detail)) && (
        <details className="text-slate-600 sm:col-span-2">
          <summary className="cursor-pointer py-2 font-medium">Technical details</summary>
          {row.error && <p className="whitespace-pre-wrap">{row.error}</p>}
          {row.history?.filter(event => event.detail).map((event, index) => (
            <p key={index} className="mt-2 whitespace-pre-wrap">{when(event.at)} · {event.detail}</p>
          ))}
        </details>
      )}
    </div>
  );
}

export default function NotificationReports({
  refreshKey = 0,
}: {
  refreshKey?: number;
}) {
  const [filters, setFilters] = useState<ReportFilters>({
    from: startDate(),
    page: 1,
    campaignPage: 1,
    limit: 25,
  });
  const [data, setData] = useState<DeliveryReport | null>(null);
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [expanded, setExpanded] = useState("");
  const [retryPreview, setRetryPreview] = useState<DeliveryRetryPreview | null>(null);
  const [retryResult, setRetryResult] = useState<DeliveryRetryResult | null>(null);
  const [retryBusy, setRetryBusy] = useState<"review" | "send" | null>(null);
  const [retryError, setRetryError] = useState("");
  const [retryLabel, setRetryLabel] = useState("");
  const [retryRefresh, setRetryRefresh] = useState(0);
  const retryLock = useRef(false);
  const retrySeq = useRef(0);
  const mounted = useRef(true);
  const seq = useRef(0);
  const recipientHeading = useRef<HTMLHeadingElement>(null);
  const change = (patch: ReportFilters) => {
    setExpanded("");
    setFilters((f) => ({
      ...f,
      ...patch,
      page: 1,
      ...(patch.campaignKey !== undefined || patch.group !== undefined
        ? { campaignPage: 1 }
        : {}),
    }));
  };
  const showRecipients = (patch: ReportFilters) => {
    change(patch);
    recipientHeading.current?.focus({ preventScroll: true });
    recipientHeading.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };
  const load = useCallback(async () => {
    const request = ++seq.current;
    setBusy(true);
    setError("");
    try {
      const report = await getDeliveryReport(filters);
      if (request === seq.current) setData(report);
    } catch (err) {
      if (request === seq.current)
        setError(
          errorMessage(err, "Could not load delivery reports. Try refreshing.")
        );
    } finally {
      if (request === seq.current) setBusy(false);
    }
  }, [filters]);
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => {
      clearTimeout(timer);
      seq.current++;
    };
  }, [load, refreshKey, retryRefresh]);
  useEffect(() => {
    retrySeq.current++;
    setRetryPreview(null);
    setRetryError("");
  }, [filters]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; retrySeq.current++; };
  }, []);
  const reviewRetry = async (row?: ReportRow, pageOnly = false) => {
    if (retryLock.current || busy) return;
    const pageIds = (data?.rows || []).filter(item => canReviewResend(item) && item._id).map(item => item._id);
    if (pageOnly && !pageIds.length) return;
    retryLock.current = true;
    const request = ++retrySeq.current;
    setRetryBusy("review");
    setRetryPreview(null);
    setRetryResult(null);
    setRetryError("");
    setRetryLabel(row ? `${row.recipientName || "This person"} · ${CHANNEL_LABELS[row.channel]}` : pageOnly
      ? `Failed deliveries on page ${data?.pagination?.page || 1}`
      : "Failed deliveries for the current activity, channel, date and search filters");
    recipientHeading.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    try {
      const preview = await previewDeliveryRetry(row
        ? { ids: [row._id] }
        : pageOnly ? { ids: pageIds }
        : { filters: { ...filters, status: "failed" } });
      if (mounted.current && request === retrySeq.current) setRetryPreview(preview);
    } catch (err) {
      if (mounted.current && request === retrySeq.current)
        setRetryError(notificationReason(errorMessage(err, "Could not review failed deliveries.")));
    } finally {
      retryLock.current = false;
      if (mounted.current) setRetryBusy(null);
    }
  };
  const confirmRetry = async () => {
    if (retryLock.current || !retryPreview?.eligible || !retryPreview.token || !retryPreview.ids?.length) return;
    retryLock.current = true;
    setRetryBusy("send");
    setRetryError("");
    const statusToken = retryPreview.statusToken || retryPreview.token;
    const recover = async () => {
      let status = await getDeliveryRetryStatus(statusToken);
      for (let attempt = 1; status?.processing && attempt < 5 && mounted.current; attempt++) {
        await new Promise<void>(resolve => setTimeout(resolve, 2000));
        if (!mounted.current) break;
        status = await getDeliveryRetryStatus(statusToken);
      }
      return status;
    };
    try {
      const result = await retryDeliveryReport({ ids: retryPreview.ids, token: retryPreview.token });
      const finalResult = result?.processing && mounted.current ? await recover().catch(() => result) : result;
      if (mounted.current) setRetryResult(finalResult);
    } catch (err) {
      // Recover an uncertain network outcome through reads, never another send.
      let recovered = false;
      if (!(err as { response?: unknown })?.response && mounted.current) {
        try {
          const status = await recover();
          if (mounted.current && status?.found) { setRetryResult(status); recovered = true; }
        } catch { /* Keep the original request error when status is unavailable. */ }
      }
      if (mounted.current && !recovered) setRetryError(notificationReason(errorMessage(err, "We could not confirm the result. Refresh the report and check it before trying again.")));
    } finally {
      retryLock.current = false;
      if (mounted.current) {
        setRetryPreview(null);
        setRetryBusy(null);
        setRetryRefresh(value => value + 1);
      }
    }
  };
  const summary = data?.summary;
  const selected = data?.campaigns.find((c) => c._id === filters.campaignKey);
  return (
    <div className="space-y-5" aria-busy={busy}>
      <section className={`${ADMIN_CARD} p-4 sm:p-6 space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={`${CARD_TITLE} flex items-center gap-2`}>
              <BarChart3 className="w-5 h-5 text-blue-600" /> Delivery reports
            </h2>
            <p className="mt-1 text-ui-small text-slate-500">
              Check updates and automatic messages sent by email, WhatsApp, push and in the app.
            </p>
          </div>
          {data && (
            <p className="text-ui-caption text-slate-400">
              Updated {when(data.generatedAt)}
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-ui-caption text-slate-600">
            Activity
            <select
              aria-label="Report activity"
              className={input}
              value={filters.group || ""}
              onChange={(e) =>
                change({ group: e.target.value, campaignKey: "" })
              }
            >
              <option value="">All activity</option>
              <option value="publication">Published updates</option>
              <option value="automation">Automatic messages</option>
            </select>
          </label>
          <label className="space-y-1 text-ui-caption text-slate-600">
            Channel
            <select
              aria-label="Report channel"
              className={input}
              value={filters.channel || ""}
              onChange={(e) => change({ channel: e.target.value })}
            >
              <option value="">All channels</option>
              {Object.entries(CHANNEL_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-ui-caption text-slate-600">
            From date (IST)
            <input
              aria-label="Report from date"
              className={input}
              type="date"
              value={filters.from || ""}
              onChange={(e) => change({ from: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-ui-caption text-slate-600">
            To date (IST)
            <input
              aria-label="Report to date"
              className={input}
              type="date"
              value={filters.to || ""}
              onChange={(e) => change({ to: e.target.value })}
            />
          </label>
        </div>
        <p className="text-ui-caption text-slate-500">
          Each message is counted separately for email, WhatsApp, push and app notifications.
          Sent means it was passed to the sending service. Delivered means arrival was confirmed.
          Seen means an open or tap was recorded. No recorded open does not mean the message was unread.
        </p>
      </section>
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 text-rose-700 border border-rose-200 p-4 text-ui-small"
        >
          {error}{" "}
          <button
            type="button"
            onClick={load}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Users className="w-5 h-5" />}
          label="People and contacts"
          value={fmt(summary?.recipients)}
          hint="Counted by account, email or phone"
          tone="blue"
          primary
          active={!filters.status}
          onClick={() => showRecipients({ status: "" })}
        />
        <SummaryCard
          icon={<Send className="w-5 h-5" />}
          label="Sent / in ACTIV"
          value={fmt(summary?.accepted)}
          hint={`${fmt(summary?.records)} delivery records`}
          tone="emerald"
          active={filters.status === "accepted_any"}
          onClick={() => showRecipients({ status: "accepted_any" })}
        />
        <SummaryCard
          icon={<Eye className="w-5 h-5" />}
          label="Seen"
          value={fmt(summary?.opened)}
          hint="Recorded opens and notification taps"
          tone="blue"
          active={filters.status === "read"}
          onClick={() => showRecipients({ status: "read" })}
        />
        <SummaryCard
          icon={<AlertCircle className="w-5 h-5" />}
          label="Failed"
          value={fmt(summary?.failed)}
          hint={`${fmt(summary?.queued)} waiting to send · ${fmt(
            summary?.skipped
          )} not sent`}
          tone="rose"
          active={filters.status === "failed"}
          onClick={() => showRecipients({ status: "failed" })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(CHANNEL_LABELS).map(([key, label]) => {
          const channel = data?.channels.find((c) => c._id === key);
          const Icon = icons[key as keyof typeof icons];
          return (
            <button
              key={key}
              type="button"
              aria-label={`Filter delivery records by ${label}`}
              aria-pressed={filters.channel === key}
              aria-controls="delivery-report-recipients"
              onClick={() => showRecipients({ channel: filters.channel === key ? "" : key })}
              className={`${ADMIN_CARD} min-w-0 p-4 space-y-4 text-left transition-colors hover:border-blue-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 ${
                filters.channel === key ? "border-blue-500 ring-2 ring-blue-500 bg-blue-50/30" : ""
              }`}
            >
              <h3 className="flex items-center gap-2 font-semibold text-ui-small text-slate-900">
                <Icon className="w-4 h-4 text-blue-600" />
                {label}
              </h3>
              <Ratio
                label={key === "in_app" ? "In the app" : "Sent"}
                value={channel?.accepted || 0}
                total={channel?.records || 0}
              />
              {key === "whatsapp" && (
                <Ratio
                  label="Delivered"
                  value={channel?.delivered || 0}
                  total={channel?.records || 0}
                  color="bg-emerald-500"
                />
              )}
              {key !== "email" ? (
                <Ratio
                  label={
                    key === "push"
                      ? "Seen / sent"
                      : key === "whatsapp"
                      ? "Seen / delivered"
                      : "Seen"
                  }
                  value={channel?.opened || 0}
                  total={
                    (key === "whatsapp"
                      ? channel?.delivered
                      : key === "push"
                      ? channel?.accepted
                      : channel?.records) || 0
                  }
                  color="bg-amber-500"
                />
              ) : (
                <p className="text-ui-caption text-slate-500">
                  We cannot tell whether an email reached the inbox or was opened.
                </p>
              )}
              <p className="text-ui-caption text-slate-500">
                {fmt(channel?.failed)} failed · {fmt(channel?.queued)} waiting to send ·{" "}
                {fmt(channel?.skipped)} not sent
              </p>
              <span className="flex items-center justify-between gap-2 text-ui-caption font-semibold text-blue-700">
                {filters.channel === key ? "Selected · Show all channels" : "View people and messages"}
                <ArrowRight className="w-4 h-4 shrink-0" />
              </span>
            </button>
          );
        })}
      </div>
      <section className={`${ADMIN_CARD} p-4 sm:p-6 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={CARD_TITLE}>
            {filters.campaignKey
              ? selected?.title || "Selected report"
              : "Updates & automatic messages"}
          </h2>
          {filters.campaignKey && (
            <button
              className={ADMIN_SECONDARY_BTN}
              onClick={() => change({ campaignKey: "" })}
            >
              <ArrowLeft className="w-4 h-4" /> All reports
            </button>
          )}
        </div>
        {selected && (
          <p className="text-ui-small text-slate-500">
            {human(selected.kind)} · Started {when(selected.createdAt)}
            {selected.currentAudience
              ? ` · Current audience: ${human(selected.currentAudience)}`
              : ""}
            . Each published version has its own report.
          </p>
        )}
        {selected?.publicationStatuses?.some((state) => state !== "done") && (
          <p className="text-ui-small text-amber-700">
            Preparing messages:{" "}
            {selected.publicationStatuses.filter(Boolean).map(state => ({ queued: "Waiting to start", processing: "Preparing", failed: "Failed", done: "Ready", skipped: "Not sent" }[state] || human(state))).join(", ")}
            . Counts grow as messages are prepared for people who match your choices.
          </p>
        )}
        {selected?.publicationErrors?.filter(Boolean).map((reason, i) => (
          <p key={i} className="text-ui-small text-rose-700">
            {notificationReason(reason)}
          </p>
        ))}
        {!filters.campaignKey && (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              {data?.campaigns.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() =>
                    change({ campaignKey: c._id, status: "", search: "" })
                  }
                  className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                >
                  <p className="text-ui-caption uppercase tracking-wide text-blue-600 font-semibold">
                    {human(c.kind === "automation" ? c.event : c.kind)}
                  </p>
                  <p className="mt-1 text-ui-small font-semibold text-slate-900 line-clamp-2">
                    {c.kind === "automation" ? human(c.event) : c.title}
                  </p>
                  <p className="text-ui-caption text-slate-400 mt-1">
                    {when(c.lastAt)}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-ui-caption text-slate-600 mt-3">
                    <span>{fmt(c.records)} deliveries</span>
                    <span className="text-emerald-700">
                      {fmt(c.opened)} opened
                    </span>
                    <span className="text-rose-700">
                      {fmt(c.failed)} failed
                    </span>
                    <span>{fmt(c.queued)} waiting to send</span>
                  </div>
                </button>
              ))}
            </div>
            {!busy && !data?.campaigns.length && (
              <p className="py-8 text-center text-ui-small text-slate-500">
                No activity matches these filters.
              </p>
            )}
            {(data?.campaignPagination.pages || 0) > 1 && (
              <div className="flex items-center justify-end gap-3">
                <button
                  aria-label="Previous reports"
                  className={ADMIN_SECONDARY_BTN}
                  disabled={busy || data?.campaignPagination.page === 1}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      campaignPage: (f.campaignPage || 1) - 1,
                    }))
                  }
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-ui-small">
                  {data?.campaignPagination.page} /{" "}
                  {data?.campaignPagination.pages}
                </span>
                <button
                  aria-label="Next reports"
                  className={ADMIN_SECONDARY_BTN}
                  disabled={
                    busy ||
                    data?.campaignPagination.page ===
                      data?.campaignPagination.pages
                  }
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      campaignPage: (f.campaignPage || 1) + 1,
                    }))
                  }
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
      <section id="delivery-report-recipients" aria-labelledby="delivery-report-recipient-heading" className={`${ADMIN_CARD} overflow-hidden`}>
        <div className="p-4 sm:p-6 space-y-3">
          <h2 id="delivery-report-recipient-heading" ref={recipientHeading} tabIndex={-1} className={`${CARD_TITLE} scroll-mt-6 focus:outline-none`}>People and messages</h2>
          <p className="text-ui-small text-slate-600" aria-live="polite">
            {filters.channel ? CHANNEL_LABELS[filters.channel as keyof typeof CHANNEL_LABELS] : "All channels"}
            {" · "}{filters.status === "accepted_any" ? "All sent messages, including delivered, seen and marked read" : filters.status === "read" ? "Seen" : filters.status === "unconfirmed" ? "No recorded open" : filters.status === "accepted" ? "Sent / in ACTIV" : filters.status ? statusLabel({ channel: "email", status: filters.status }) : "Every outcome"}
            {busy ? " · Updating records…" : ""}
          </p>
          <p className="text-ui-caption text-slate-500">
            {fmt(summary?.recipients)} people and contacts across {fmt(summary?.records)} delivery records for the current activity, channel, date and search filters.
            {" "}People are counted by account, email or phone. The same person can appear more than once. Select a message for its history and sending details.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <input
                aria-label="Search people and contacts"
                value={filters.search || ""}
                onChange={(e) => change({ search: e.target.value })}
                className={`${input} pl-9`}
                placeholder="Name, email, phone or booking reference"
              />
            </div>
            <select
              aria-label="Report delivery outcome"
              className={`${input} sm:max-w-xs`}
              value={filters.status || ""}
              onChange={(e) => change({ status: e.target.value })}
            >
              <option value="">Every outcome</option>
              <option value="unconfirmed">No recorded open</option>
              <option value="read">Seen</option>
              <option value="accepted_any">All sent messages (including delivered / seen)</option>
              <option value="delivered">Delivered</option>
              <option value="accepted">Sent / in ACTIV</option>
              <option value="marked_read">Marked as read</option>
              <option value="failed">Failed</option>
              <option value="queued">Waiting to send</option>
              <option value="skipped">Not sent</option>
              <option value="mock">Not sent — setup needed</option>
            </select>
          </div>
          <div className="space-y-3">
            <button type="button" className={ADMIN_SECONDARY_BTN}
              disabled={busy || !!retryBusy || !summary?.failed}
              onClick={() => void reviewRetry()}>
              {retryBusy === "review" ? "Reviewing failures…" : "Review failed deliveries"}
            </button>
            <button type="button" className={`${ADMIN_SECONDARY_BTN} ml-0 sm:ml-2`}
              aria-label="Review failed deliveries on this page"
              disabled={busy || !!retryBusy || !(data?.rows || []).some(canReviewResend)}
              onClick={() => void reviewRetry(undefined, true)}>
              Review failures on this page
            </button>
            <p className="text-ui-caption text-slate-500">
              Use Resend beside a failed message to review it before sending again. We check that it can still be sent. No recorded open does not mean the message failed.
            </p>
            {retryBusy === "send" && <p role="status" className="text-ui-small text-blue-700">Resending the reviewed deliveries…</p>}
            {retryError && <p role="alert" className="text-ui-small text-rose-700">{retryError}</p>}
            {retryPreview && (
              <div role="region" aria-label="Review failed delivery resend" className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3 text-ui-small">
                <p className="font-semibold text-slate-900">Confirm resend</p>
                <p className="break-words text-slate-700">{retryLabel}</p>
                <p>{fmt(retryPreview.matched)} found · {fmt(retryPreview.eligible)} ready to resend · {fmt(retryPreview.skipped)} not sent</p>
                {(retryPreview.reasons || []).map((reason, index) => <p key={index} className="text-slate-600">{fmt(reason.count)} not sent: {notificationReason(reason.reason)}</p>)}
                {retryPreview.truncated && <p>{fmt(retryPreview.reviewed ?? (retryPreview.eligible + retryPreview.skipped))} reviewed, {fmt(retryPreview.remaining ?? Math.max(0, retryPreview.matched - retryPreview.eligible - retryPreview.skipped))} still to review. Batch review starts with the newest 100 failures. Select Failed, go through the pages of people and messages, then choose “Review failures on this page” for later deliveries.</p>}
                <p>Only the messages shown as ready will be sent again. We check each message again before sending.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={ADMIN_SECONDARY_BTN} disabled={!!retryBusy || !retryPreview.eligible || !retryPreview.ids?.length || !retryPreview.token} onClick={() => void confirmRetry()}>
                    {retryBusy === "send" ? "Resending…" : `Confirm resend (${fmt(retryPreview.eligible)})`}
                  </button>
                  <button type="button" className={ADMIN_SECONDARY_BTN} disabled={!!retryBusy} onClick={() => setRetryPreview(null)}>Cancel resend</button>
                </div>
              </div>
            )}
            {retryResult && (
              <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-ui-small">
                <p className="font-semibold">Resend result</p>
                {retryResult.processing ? <p>These messages are being sent again. Refresh the report to check their progress.</p> : <p>{fmt(retryResult.attempted)} tried · {fmt(retryResult.sent)} sent · {fmt(retryResult.queued)} waiting to send · {fmt(retryResult.failed)} failed · {fmt(retryResult.skipped)} not sent</p>}
                <p className="text-slate-500">Sent means the message was passed to the sending service. Arrival is not yet confirmed. Waiting to send means it is waiting or being sent now.</p>
                {(retryResult.reasons || []).map((reason, index) => <p key={index}>{fmt(reason.count)} messages: {notificationReason(reason.reason)}</p>)}
              </div>
            )}
          </div>
        </div>
        <div aria-hidden="true" className={`${recipientColumns} hidden sm:grid border-y border-slate-100 bg-slate-50 px-4 sm:px-6 py-3 text-ui-caption font-semibold text-slate-500`}>
          <span>Person / contact</span>
          <span>Notification</span>
          <span className="text-right pr-6">Outcome</span>
        </div>
        <div className="divide-y divide-slate-100">
          {busy && !data ? (
            <div className="p-10 text-center">
              <Loader2 className="w-5 h-5 animate-spin inline text-blue-600" />
            </div>
          ) : (
            data?.rows.map((row) => (
              <div key={row._id} data-delivery-id={row._id}>
                <button
                  type="button"
                  data-report-row
                  aria-expanded={expanded === row._id}
                  onClick={() =>
                    setExpanded(expanded === row._id ? "" : row._id)
                  }
                  className={`w-full ${recipientColumns} items-start px-4 sm:px-6 py-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500`}
                >
                  <span data-report-column="recipient" className="min-w-0">
                    <span className="block font-semibold text-ui-small text-slate-900 [overflow-wrap:anywhere]">
                      {row.recipientName}
                    </span>
                    <span className="block text-ui-caption text-slate-500 [overflow-wrap:anywhere]">
                      {row.recipient || "ACTIV notifications / device"}
                    </span>
                  </span>
                  <span data-report-column="notification" className="min-w-0">
                    <span className="block text-ui-small text-slate-700">
                      {CHANNEL_LABELS[row.channel]}
                    </span>
                    <span className="block text-ui-caption text-slate-500 [overflow-wrap:anywhere]">
                      {reportTitle(row)}
                    </span>
                    <span className="text-ui-caption text-slate-400">
                      {when(row.createdAt)}
                    </span>
                  </span>
                  <span data-report-column="outcome" className="grid min-w-0 grid-cols-[minmax(0,1fr)_1rem] items-center gap-2">
                    <span
                      className={`max-w-full justify-self-end rounded-full px-3 py-1 text-center text-ui-caption font-semibold [overflow-wrap:anywhere] ${
                        tones[row.status] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {statusLabel(row)}
                    </span>
                    {expanded === row._id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                </button>
                {row.status === "failed" && <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 sm:px-6">
                  <p className="min-w-0 flex-1 basis-48 text-ui-small text-rose-700 [overflow-wrap:anywhere]">
                    {row.channel === "in_app" ? "In-app entries cannot be resent." : notificationReason(row.error) || "This message could not be sent or delivered."}
                  </p>
                  {canReviewResend(row) && <button type="button" className={`${ADMIN_SECONDARY_BTN} min-h-11 shrink-0`} disabled={busy || !!retryBusy}
                    aria-label={`Resend ${CHANNEL_LABELS[row.channel]} message to ${row.recipientName || row.recipient || "this person"}`}
                    onClick={() => void reviewRetry(row)}><RotateCcw aria-hidden="true" className="h-4 w-4" />Resend</button>}
                </div>}
                {expanded === row._id && <Detail row={row} />}
              </div>
            ))
          )}
          {!busy && !data?.rows.length && (
            <p className="p-10 text-center text-ui-small text-slate-500">
              No messages match this result.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-slate-200">
          <p className="text-ui-caption text-slate-500">
            {fmt(data?.pagination.total)} delivery records
            {busy ? " · Refreshing…" : ""}
          </p>
          <div className="flex items-center gap-3">
            <button
              aria-label="Previous people and messages"
              className={ADMIN_SECONDARY_BTN}
              disabled={busy || (data?.pagination.page || 1) <= 1}
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  page: Math.max(1, (f.page || 1) - 1),
                }))
              }
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-ui-small">
              {data?.pagination.page || 1} / {data?.pagination.pages || 1}
            </span>
            <button
              aria-label="Next people and messages"
              className={ADMIN_SECONDARY_BTN}
              disabled={
                busy ||
                (data?.pagination.page || 1) >= (data?.pagination.pages || 1)
              }
              onClick={() =>
                setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))
              }
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
