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

Keep the old settings until the corresponding templates are APPROVED.
Do not change their defaults to a pending template. Existing sending chains
remain available for failures and the sender can handle old and new template
contracts together.

Paid-booking verification uses `node tests/booking-delivery.test.js`: a
successful payment webhook, payer return, reconciliation, and recorded
offline payment each dispatch one confirmation. Concurrent callbacks and
retries do not duplicate that confirmation, and an underpayment is refused.
These checks use fake provider/model methods and send no messages. They
verify application behaviour, not a new live payment's handset delivery.
