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
} from "lucide-react";
import {
  ADMIN_CARD,
  ADMIN_SECONDARY_BTN,
  AdminStat,
} from "@/features/admin/components/AdminUI";
import { CARD_TITLE } from "@/components/layout/appTypography";
import {
  getDeliveryReport,
  CHANNEL_LABELS,
  statusLabel,
  type DeliveryReport,
  type ReportFilters,
  type ReportRow,
} from "@/services/deliveryReportApi";
import { errorMessage } from "@/services/activApi";

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
    <div className="grid gap-4 p-4 sm:p-5 bg-slate-50/70 text-ui-small sm:grid-cols-2">
      <div className="space-y-2">
        <p className="font-semibold text-slate-900">Recipient & delivery</p>
        <p>
          {row.recipientName} · {row.recipient || "Account inbox / device"}
        </p>
        <p className="text-slate-500">
          {[row.region?.state, row.region?.district, row.region?.block]
            .filter(Boolean)
            .join(" / ") || "Region not recorded"}
        </p>
        <p>
          Provider: {row.provider || "Not recorded"} · Attempts:{" "}
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
            {row.error}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <p className="font-semibold text-slate-900">Recorded timeline</p>
        <p>Created: {when(row.createdAt)}</p>
        {row.history?.map((event, i) => (
          <p key={i}>
            {human(event.status)}: {when(event.at)}
            {event.detail ? ` · ${event.detail}` : ""}
          </p>
        ))}
        {row.deliveredAt && <p>Delivered: {when(row.deliveredAt)}</p>}
        {row.openedAt && <p>Opened / tapped: {when(row.openedAt)}</p>}
        {row.readAt && <p>Marked read: {when(row.readAt)}</p>}
        {row.status === "queued" && row.nextAttemptAt && (
          <p>Next attempt: {when(row.nextAttemptAt)}</p>
        )}
        <p className="text-slate-500">
          Email opens are not measured. Push acceptance confirms Firebase
          accepted the request; a tap is recorded separately.
        </p>
      </div>
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
  const seq = useRef(0);
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
  }, [load, refreshKey]);
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
              Monitor publications and automated messages across every channel.
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
              <option value="publication">Publications & updates</option>
              <option value="automation">Automations & messages</option>
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
          Counts represent recipient-channel deliveries. One member can receive
          an update through several channels. A missing open receipt does not
          prove the message was unread.
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
        <AdminStat
          icon={<Users className="w-5 h-5" />}
          label="Recipient identities"
          value={fmt(summary?.recipients)}
          hint="Accounts and unregistered contacts"
          tone="blue"
          primary
        />
        <AdminStat
          icon={<Send className="w-5 h-5" />}
          label="Accepted / in inbox"
          value={fmt(summary?.accepted)}
          hint={`${fmt(summary?.records)} delivery records`}
          tone="emerald"
        />
        <AdminStat
          icon={<Eye className="w-5 h-5" />}
          label="Confirmed opens"
          value={fmt(summary?.opened)}
          hint="WhatsApp reads and recorded taps"
          tone="blue"
        />
        <AdminStat
          icon={<AlertCircle className="w-5 h-5" />}
          label="Failed"
          value={fmt(summary?.failed)}
          hint={`${fmt(summary?.queued)} queued · ${fmt(
            summary?.skipped
          )} skipped / not sent`}
          tone="rose"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(CHANNEL_LABELS).map(([key, label]) => {
          const channel = data?.channels.find((c) => c._id === key);
          const Icon = icons[key as keyof typeof icons];
          return (
            <section key={key} className={`${ADMIN_CARD} p-4 space-y-4`}>
              <h3 className="flex items-center gap-2 font-semibold text-ui-small text-slate-900">
                <Icon className="w-4 h-4 text-blue-600" />
                {label}
              </h3>
              <Ratio
                label={key === "in_app" ? "In inbox" : "Accepted"}
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
                      ? "Tapped / accepted"
                      : key === "whatsapp"
                      ? "Opened / delivered"
                      : "Opened"
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
                  Inbox delivery and email opens are not measured by the current
                  mail service.
                </p>
              )}
              <p className="text-ui-caption text-slate-500">
                {fmt(channel?.failed)} failed · {fmt(channel?.queued)} queued ·{" "}
                {fmt(channel?.skipped)} skipped
              </p>
            </section>
          );
        })}
      </div>
      <section className={`${ADMIN_CARD} p-4 sm:p-6 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={CARD_TITLE}>
            {filters.campaignKey
              ? selected?.title || "Selected report"
              : "Publications & automations"}
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
            . Each publication revision has its own report.
          </p>
        )}
        {selected?.publicationStatuses?.some((state) => state !== "done") && (
          <p className="text-ui-small text-amber-700">
            Recipient preparation:{" "}
            {selected.publicationStatuses.filter(Boolean).map(human).join(", ")}
            . Counts grow as eligible recipients are processed.
          </p>
        )}
        {selected?.publicationErrors?.filter(Boolean).map((reason, i) => (
          <p key={i} className="text-ui-small text-rose-700">
            {reason}
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
                    <span>{fmt(c.queued)} queued</span>
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
      <section className={`${ADMIN_CARD} overflow-hidden`}>
        <div className="p-4 sm:p-6 space-y-3">
          <h2 className={CARD_TITLE}>Recipient details</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <input
                aria-label="Search report recipients"
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
              <option value="unconfirmed">No confirmed open</option>
              <option value="read">Confirmed open / tap</option>
              <option value="delivered">Delivered</option>
              <option value="accepted">Provider accepted / in inbox</option>
              <option value="marked_read">Marked as read</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued</option>
              <option value="skipped">Skipped</option>
              <option value="mock">Not sent</option>
            </select>
          </div>
          <p className="text-ui-caption text-slate-500">
            Use “No confirmed open” to review follow-up candidates. Existing
            Automation controls manage eligible retries. Opening a report never
            sends a message.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {busy && !data ? (
            <div className="p-10 text-center">
              <Loader2 className="w-5 h-5 animate-spin inline text-blue-600" />
            </div>
          ) : (
            data?.rows.map((row) => (
              <div key={row._id}>
                <button
                  type="button"
                  aria-expanded={expanded === row._id}
                  onClick={() =>
                    setExpanded(expanded === row._id ? "" : row._id)
                  }
                  className="w-full grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start px-4 sm:px-6 py-4 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-ui-small text-slate-900 break-words">
                      {row.recipientName}
                    </span>
                    <span className="block text-ui-caption text-slate-500 break-all">
                      {row.recipient || "Account inbox / device"}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-ui-small text-slate-700">
                      {CHANNEL_LABELS[row.channel]}
                    </span>
                    <span className="block text-ui-caption text-slate-500 line-clamp-1">
                      {row.title}
                    </span>
                    <span className="text-ui-caption text-slate-400">
                      {when(row.createdAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-ui-caption font-semibold ${
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
                {expanded === row._id && <Detail row={row} />}
              </div>
            ))
          )}
          {!busy && !data?.rows.length && (
            <p className="p-10 text-center text-ui-small text-slate-500">
              No recipients match this outcome.
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
              aria-label="Previous recipients"
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
              aria-label="Next recipients"
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
