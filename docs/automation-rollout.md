# Event and membership automation rollout

The `activ-new` main branch contains this monorepo. Dokploy can build from `/`
using the root `nixpacks.toml`, or from `/website` using that directory's
configuration. Both start the Node preview server on port 8080. Leave Publish
Directory empty and route the website domain to that server; serving only
`dist/index.html` bypasses event metadata. App ID 654787660325955 is included
in both preview renderers and can be overridden with `META_APP_ID`.

The backend repository uses its root as Build Path. Its public upload origin
is `https://api.activ.org.in`; `PUBLIC_MEDIA_URL` can override it. Event banners
are selected from the booked event, with the standard logo only when absent.
The Entrepreneurship Awareness Programme currently has no saved banner.

Event editors accept WhatsApp group invites and existing channel links in the
backward-compatible `whatsappChannelUrl` field. The approved readable
confirmation uses a dedicated aligned template when group/channel or video
links are present. Each link has a separate heading and line in the fixed Meta
template body. The original readable template remains the fallback while a new
template is awaiting approval. PDFs remain separate supporting messages.

Membership bot commands: MEMBERSHIP/STATUS/MEMBER, REGISTER, PAYMENT, RENEW,
UPI, PAID, HELP, EVENTS and MENU. Account state and the existing renewal window
control the answer. Direct UPI amounts come from the same eligible-plan price
lookup as checkout. Direct transfers need office verification; a message or
UTR does not mark a membership paid. The bot supplies the member reference and
asks the sender to email proof to member@activ.org.in. The paid plan is read
from the latest paid membership order.

In BotBee, forward inbound messages and button replies to:
`https://api.activ.org.in/api/v1/notifications/botbee/webhook`
(confirm the mount in backend routes). Disable the old static membership flow
when activating this receiver to avoid duplicate generic replies. Dokploy
deployment alone does not change BotBee-hosted flows.

## Membership email activation

Events use the existing EMAIL_* account. All other lifecycle, registration,
renewal, reset and admin mail uses `member@activ.org.in` as its From address,
through the same authenticated SMTP relay as events, as requested. No new
Dokploy secret is required for this shared-relay mode. The relay must recognize
the membership address as an authorized From alias.

If a separate mailbox transport is preferred later, set these privately in
Dokploy, never in Git:

```dotenv
MEMBER_EMAIL_TRANSPORT=separate
MEMBER_EMAIL_HOST=<mailbox provider SMTP host>
MEMBER_EMAIL_PORT=465
MEMBER_EMAIL_SECURE=true
MEMBER_EMAIL_USER=member@activ.org.in
MEMBER_EMAIL_PASS=<mailbox password>
```

Use the provider's actual port/TLS setting. The supplied membership credentials
were rejected when tried as a separate login against the Gmail SMTP host; they
are not used in shared-relay mode. Verify with
`node scripts/check-email-accounts.js`. `--send-test` sends only to the user's
test inbox.

After deployment, run `node website/deploy/check-share-preview.mjs` with the
event URL, and re-scrape that exact URL in Facebook Sharing Debugger. Existing
social cards can remain cached until the platform fetches the URL again.
