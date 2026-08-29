# 内界 CAVE Cloudflare Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the verified static website to Cloudflare Pages at `https://neijiecave.com` with stable redirects and protected domain settings.

**Architecture:** Cloudflare Pages builds the existing monorepo from GitHub and serves `apps/web/dist`. Cloudflare Registrar remains authoritative for DNS; Pages owns only the website records, while Zoho later owns mail records. All credential entry and account approvals stay inside official dashboards.

**Tech Stack:** Cloudflare Registrar, Cloudflare DNS, Cloudflare Pages Git integration, GitHub, Astro static output

---

## Guided-execution rule

When this plan is carried out with the user, present exactly one manual Dashboard action at a time and wait for the user to confirm it before presenting the next action. Read-only agent checks may run in parallel, but never combine several account, DNS, GitHub-authorization, or deployment actions into one instruction. Never ask the user to paste a password, API token, recovery code, payment detail, or other secret into chat.

### Task 1: Verify the domain control plane

- [ ] Confirm `neijiecave.com` shows Active in Cloudflare Registrar.
- [ ] Confirm registrant email verification has no pending warning.
- [ ] Confirm auto-renew is enabled and the payment method is valid; do not copy billing details into chat or repository.
- [ ] Confirm Registrar Lock is enabled.
- [ ] Open DNS > Settings and confirm DNSSEC is Active. If it is Pending, wait rather than toggling it repeatedly.
- [ ] Export or note the current DNS record names/types without recording private billing or authentication data. Do not delete unknown records.

Expected: domain Active, auto-renew and lock enabled, DNSSEC Active or in one stable Pending state.

### Task 2: Prepare the GitHub production source

- [ ] Confirm the website implementation commits are present on the intended production branch.
- [ ] Confirm `pnpm --filter @cave/web test` passes from a clean checkout.
- [ ] Push the approved branch to GitHub using the repository's normal review/merge flow.
- [ ] Do not authorize Cloudflare to unrelated repositories; choose only the `内界 CAVE` repository when GitHub offers repository selection.

Expected: GitHub contains `apps/web`, the production build is reproducible, and no secrets were added.

### Task 3: Create the Pages project

- [ ] In Cloudflare, open Workers & Pages > Create application > Pages > Connect to Git.
- [ ] Select the approved GitHub repository and production branch.
- [ ] Set project name to `neijie-cave-web`.
- [ ] Set build command to `pnpm --filter @cave/web build`.
- [ ] Set build output directory to `apps/web/dist`.
- [ ] Keep repository root as `/` so pnpm workspace dependencies resolve.
- [ ] Set `NODE_VERSION=22` and `PNPM_VERSION=10.34.5`; add no API keys or application secrets.
- [ ] Start the first deployment and wait for Success.
- [ ] Open the generated `*.pages.dev` address and verify `/`, `/privacy`, `/support`, `/safety`, and `/sources` return 200.
- [ ] Request a clearly nonexistent path such as `/this-page-does-not-exist` and confirm it returns the site's custom `404.html` with HTTP 404 rather than rendering the homepage. Cloudflare Pages uses a top-level `404.html` for custom not-found responses; without one, it may apply SPA fallback behavior. See [Serving Pages: Not Found behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/#not-found-behavior).
- [ ] In the Pages project's Metrics area, leave Cloudflare Web Analytics disabled. Do not select **Enable**: Cloudflare documents that enabling it for Pages automatically adds a JavaScript snippet on the next deployment. See [Enabling Cloudflare Web Analytics: Pages projects](https://developers.cloudflare.com/web-analytics/get-started/#pages-projects).
- [ ] In the zone-level Web Analytics area, confirm there is no enabled automatic setup for `neijiecave.com`; if an existing site entry is present, set it to **Disable** so no JS snippet is injected.
- [ ] In Zaraz, configure no tools and confirm **Auto-inject script** is off. Cloudflare documents that this setting otherwise automatically injects the Zaraz script. See [Zaraz settings: Auto-inject script](https://developers.cloudflare.com/zaraz/reference/settings/#auto-inject-script).

Expected: one successful production deployment with the exact source commit visible in Pages, a real custom 404 response, and no client-side analytics or tag-management injection.

### Task 4: Bind production domains

- [ ] In the Pages project, open Custom domains and add `neijiecave.com` through the Pages workflow; do not manually invent an apex CNAME first.
- [ ] Wait until the apex domain status is Active and its certificate is issued.
- [ ] Do **not** add `www.neijiecave.com` as a second Pages custom domain. Follow Cloudflare's official [Redirecting www to domain apex](https://developers.cloudflare.com/pages/how-to/www-redirect/) topology instead: the apex is the Pages custom domain, while `www` exists only to enter Cloudflare's proxy and Bulk Redirect.
- [ ] In the account-level Cloudflare Dashboard, open Bulk Redirects and create a redirect list.
- [ ] Add one redirect entry and confirm each field before saving: source `www.neijiecave.com`, target `https://neijiecave.com`, and status `301`.
- [ ] Review the parameters shown in the current Dashboard and enable the options required by the current official guide, including `Preserve query string`, `Subpath matching`, `Preserve path suffix`, and `Include subdomains` when those labels are present. Do not invent an API payload, rule expression, or secret.
- [ ] Create and enable the account-level Bulk Redirect rule using that list.
- [ ] In DNS, create exactly one `A` record with name `www`, IPv4 address `192.0.2.1`, and proxy status **Proxied** (orange cloud), as prescribed by the official Pages guide. The documentation-only address is a placeholder that lets the request reach Cloudflare's proxy; it is not the Pages origin.
- [ ] Wait for DNS and HTTPS propagation, then verify `https://www.neijiecave.com/privacy?from=redirect-test` returns HTTP 301 with `Location: https://neijiecave.com/privacy?from=redirect-test`.
- [ ] Keep website records proxied as Pages creates them. Do not proxy MX, SPF, DKIM, or future DMARC records.

Expected: apex serves the site over HTTPS; the account-level Bulk Redirect returns 301 from `www` to apex while preserving path and query, without a redirect loop.

### Task 5: Production verification

- [ ] Request all five canonical URLs from an external network and confirm HTTP 200.
- [ ] Request a clearly nonexistent production URL and confirm HTTP 404 with the custom not-found page, not a 200 homepage fallback.
- [ ] Confirm the account-level Bulk Redirect makes `https://www.neijiecave.com/privacy` return 301 to `https://neijiecave.com/privacy`.
- [ ] Confirm a `www` URL containing both a nested path and query string returns 301 to the same apex path and query string.
- [ ] Inspect response headers for CSP, Referrer-Policy, X-Content-Type-Options, X-Frame-Options, and Permissions-Policy.
- [ ] Confirm page source contains the canonical production URL and no `pages.dev` canonical.
- [ ] Inspect the final HTML for all canonical pages and confirm there is no `<script>` element, `beacon.min.js`, `static.cloudflareinsights.com`, `/cdn-cgi/rum`, or Zaraz loader reference.
- [ ] With browser Developer Tools open and the Network panel cleared, reload every canonical page and confirm no JavaScript, `static.cloudflareinsights.com`, `/cdn-cgi/rum`, `/cdn-cgi/zaraz/`, or other analytics/tag-manager request is made. Cloudflare documents that the Web Analytics beacon loads from `https://static.cloudflareinsights.com/beacon.min.js` and reports through a RUM endpoint; see [Data origin and collection](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/).
- [ ] Confirm no Cookie banner appears because the deployed site sets no nonessential cookies or trackers. If any script or tracking request appears, stop and disable the injecting product before proceeding; do not merely add a banner.
- [ ] Record the Pages project name, production URL, deployment commit, verification date, and any Cloudflare-generated DNS record names. Do not record account IDs, tokens, invoices, or billing details.
- [ ] Send the production homepage, privacy URL, support URL, safety URL, and sources URL to the main App task for App Store metadata preparation.

Expected: production domain is ready for Apple metadata, unknown URLs return a true 404, the static site remains script-free and tracker-free after Cloudflare processing, and the mail plan can safely add independent DNS records.
