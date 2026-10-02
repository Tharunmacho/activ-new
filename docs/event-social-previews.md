# Deploy event social previews

The public event response must contain the event's metadata before JavaScript
runs. A browser preview extension alone cannot verify what Facebook receives.

## Dokploy website deployment

Deploy the website application from `/website` in the monorepo, or `/` when
using the standalone `activ-new` repository. Use Nixpacks with **Publish
Directory left empty** so `nixpacks.toml` starts `node server.mjs` rather than
a static Nginx server. Route the website domain to container port `8080`.
The build writes the public API/site URLs into `dist/site-config.json` so
the server and browser share the same API configuration. Override with
`API_URL=https://api.activ.org.in/api/v1`, `SITE_URL=https://activ.org.in`, and
`PORT=8080` when needed. Set `META_APP_ID` on this website application too if
using its Node server to generate previews. No Apache rules are needed when
the domain routes directly to this Node server.

The repository's existing `website/.github/workflows/deploy.yml` instead
deploys to ScalaHosting `public_html` over SSH. For that setup, use the
Apache steps below as well as deploying the backend through Dokploy.

## Existing Apache website deployment

1. Deploy the backend with Dokploy Build Path `/backend`.
2. Set `FRONTEND_URL=https://activ.org.in` in the backend. The event renderer
   fetches the website's root HTML as its SPA shell, cached for 60 seconds.
3. Set `META_APP_ID` to the numeric **App ID** from the Meta application's
   Basic settings, then redeploy. It is public metadata; never use the WABA ID,
   access token, app secret, or Meta Pixel ID in its place. Without an App ID
   the warning remains, but event image/title previews still work.
4. Build and upload the website files. Merge `website/deploy/share-previews.htaccess`
   into the **Apache host's** `public_html/.htaccess` before the SPA fallback:

   ```sh
   node website/deploy/merge-htaccess.mjs /path/to/public_html/.htaccess
   ```

   The merger preserves the existing API proxy and saves a backup. If using
   cPanel/FTP without Node, replace the marked ACTIV share-preview block with
   the contents of that file, keeping it above the fallback. Do not replace
   existing API proxy rules. Deploying Dokploy alone does not update Apache.
5. Verify the live response for browser, Facebook, Meta, WhatsApp, X, and LinkedIn:

   ```sh
   cd website
   node deploy/check-share-preview.mjs https://activ.org.in/events/scst-economic-liberty-conference-2026-10-10
   ```

6. In Facebook Sharing Debugger, scrape the exact URL again. Its canonical and
   `og:url` must be the event URL. Start a fresh post after re-scraping.

Public events receive `{Event_Name} on {event_date} at {event_venue}`, the
description, and banner in initial HTML for every user agent. The React app is
preserved at the original event/book address. If the website shell cannot be
fetched, the backend still returns the correct preview and an ordinary visitor
can continue to the app via `ref=share`. Other preview routes retain their
existing crawler routing. Draft/member-only events retain the public API's
visibility rules.

New or replaced uploaded event banners are copied to
`/uploads/events/<content-version>/<event-slug>.<extension>`. The original is
kept and the durable copy is created before updating the URL. If storage is
unavailable, the original URL is preserved. External image URLs stay as supplied.
Changing an event title/date preserves its established slug and shared links.

For existing uploaded banners, run inside the deployed backend:

```sh
node scripts/name-event-banners.js
node scripts/name-event-banners.js --confirm
```

The first command previews changes. The second creates durable named copies
and updates only rows whose source URL has not changed since reading them.
It does not delete original images.
