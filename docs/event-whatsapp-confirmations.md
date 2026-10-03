# Event confirmation layout and activation

The readable confirmation template separates the event, date, time, venue,
seat count, payment, booking ID, entry reference, and booking link. Map,
language, organiser contact, and other event details are available through
the booking link rather than a crowded Details paragraph. The image-header
variant uses the event poster when available, with the existing default
image behaviour. A plain variant provides the existing no-image fallback.

Free registrations show `Free entry`. Confirmed online payments show the
actual amount and payment label; offline payments show the organiser's
recorded payment. Participant messages identify who booked for them instead
of presenting the booker's payment as a bill.

The new templates require Meta approval. Their ten-variable contract cannot
be enabled on a deployment containing only the old seven-variable sender.
Deploy the updated backend, check approval, then set these Dokploy variables
and redeploy:

```dotenv
BOTBEE_TPL_BOOKING_FLEX=activ_evt_confirmed_readable_v1
BOTBEE_TPL_BOOKING_FLEX_PLAIN=activ_evt_confirmed_readable_plain_v1
BOTBEE_TPL_WEBINAR_FLEX=activ_evt_online_readable_v1
BOTBEE_TPL_WEBINAR_FLEX_PLAIN=activ_evt_online_readable_plain_v1
```

Check approval from the backend:

```sh
node scripts/whatsapp-booking-templates.js --status --only=activ_evt_confirmed_readable_v1,activ_evt_confirmed_readable_plain_v1,activ_evt_online_readable_v1,activ_evt_online_readable_plain_v1
```

The four readable confirmation templates were verified APPROVED on 3 October
2026. They are now the defaults; explicit old flexible confirmation names are
also mapped to the readable replacements. Custom template names and `none`
remain respected. The event banner is the main confirmation's image header,
with a plain confirmation available if the image fails.

The event editor now has an optional `whatsappChannelUrl` field, validated as
`https://whatsapp.com/channel/...`. It is included in booking/reminder emails
and session text. The approved-template route sends the channel as a separate
event-information message after the main confirmation or reminder, to the
booker and each participant. PDFs remain optional supporting documents and
their names are displayed separately from the registered event's name.

Two new templates were submitted on 3 October 2026 and were still PENDING at
the last check. Enable these only after Meta marks them APPROVED:

```dotenv
BOTBEE_TPL_EVENT_CHANNEL=activ_event_channel_v1
BOTBEE_TPL_EVENT_DOCUMENT=activ_event_document_readable_v2
```

Check with:

```sh
node scripts/whatsapp-booking-templates.js --status --only=activ_event_channel_v1,activ_event_document_readable_v2
```

Uploads are served by the API host. Set this on the deployed backend when the
website and upload origins differ:

```dotenv
PUBLIC_MEDIA_URL=https://api.activ.org.in
```

Old absolute `/uploads/` URLs are re-anchored to this media origin (or the
configured public API origin when it is absent). WhatsApp document sends and
resends reject HTML responses instead of forwarding a web page as a PDF.

Deploy the backend and rebuild/deploy the website to expose the new editor
field and sending behavior. The mobile event editor supports the same field.
The public WhatsApp social link is stored in CMS Contact settings and the
footer social list, using the existing WhatsApp icon.

Paid-booking verification uses `node tests/booking-delivery.test.js`: a
successful payment webhook, payer return, reconciliation, and recorded
offline payment each dispatch one confirmation. Concurrent callbacks and
retries do not duplicate that confirmation, and an underpayment is refused.
These checks use fake provider/model methods and send no messages. They
verify application behaviour, not a new live payment's handset delivery.

Additional checks: `node tests/event-notification-content.test.js` verifies
event-specific context, channel rendering, media routing and HTML rejection;
`node tests/cms-field-survival.test.js` verifies that the new field survives
both create and edit.
