Social previews are read from the first HTML response; changing React metadata alone cannot update Facebook, LinkedIn or WhatsApp cards.

CMS offers Home, About us, Membership, Events, Gallery, News and Schemes, plus Central schemes, State schemes, published zones and published states. Onboarding uses Home's saved preview. Central and State schemes each have their own saved preview and canonical URL. Existing aliases remain valid links. Individual events, articles, galleries, states and zone sections use their published content automatically.

Deploy the backend and website changes together. For the Node website, build and run `node server.mjs` with `API_URL=https://api.activ.org.in/api/v1`. For Apache hosting, copy the website build and run `node deploy/merge-htaccess.mjs /path/to/public_html/.htaccess`; the site's existing `/api/v1` proxy must point to the backend. The preview rules must run before the SPA fallback. Copying `dist` alone does not install these rules.

After deployment, run:

```
node deploy/check-share-preview.mjs
node deploy/check-share-preview.mjs https://activ.org.in/regions/east https://activ.org.in/news/YOUR-PUBLISHED-ARTICLE
```

The first command checks all seven general pages. The second accepts any published public page, including events, zones and state sections. It compares the website's initial HTML with the current backend preview for browser and social-crawler requests, then checks image delivery. A failure here is a website routing/deployment/content problem, not evidence of a social platform's cached card. Once these checks pass, ask the platform to refresh previously cached links.
