# Automatic message trace sync via Microsoft Graph

The dashboard can pull message trace data straight from Exchange Online instead
of waiting for someone to export a CSV and drop it in the file drawer.

Microsoft retired the Reporting Web Service message trace endpoints on
**6 April 2026**. The Graph API below is the supported replacement.

## What it does

A nightly Vercel cron job hits `/api/sync-graph`, which:

1. Gets an app-only token from Microsoft Entra.
2. Pulls message trace for the current month to date (walking the range in
   10-day chunks, which is Graph's per-query limit).
3. Collapses trace rows to one row per email, unioning recipients.
4. Writes one CSV per Santos calendar month to blob storage as
   `mails/graph-YYYY-MM.csv`.

The output is the same 8-column condensed format that
[`utils/prepareCsv.js`](../utils/prepareCsv.js) produces from a hand-uploaded
export, so parsing, dedup, the recipient index and the analytics are untouched.
Graph-synced and hand-uploaded files can be selected together — both key on the
internet message id, so overlapping data deduplicates correctly.

Files are **rewritten whole** each run, not appended to. That is what makes the
job safely repeatable: a run that half-finished, or a night Graph was slow, gets
corrected by the next run rather than leaving a gap nobody notices.

## This captures more than the manual exports did

The hand-made exports only ever covered outbound mail from a handful of
mailboxes — which is why five of the twenty-eight people in
[`utils/roster.js`](../utils/roster.js) show as active. Graph pulls the whole
tenant, both directions, so expect the staff list and the totals to grow once
the sync has been running a while. That is the sync working, not a bug.

Messages where no roster person is party — mail that only touches a shared role
mailbox like `trading@` or `info@`, which the analytics already exclude — are
dropped at write time so the files stay small. Mail addressed to both a role
mailbox and a real person is kept.

## Limits worth knowing

| Limit | Value | Consequence |
|---|---|---|
| Retention | 90 days | **Graph cannot backfill.** The 29 uploaded files stay as the historical archive. |
| Query span | 10 days | Wider ranges are chunked automatically. |
| Page size | 5,000 results | Paged via `@odata.nextLink`. |
| Throttling | 100 requests / 5 min / tenant | A normal run uses well under 20. |

The sync refuses to overwrite an existing month file when the 90-day floor has
cut into that month — older data does not come back, and a truncated file must
not replace a complete one. Pass `?force=1` to override.

## One-time setup

All of this is tenant-admin work in the Wolthers Microsoft 365 tenant.

### 1. Register an application

In the [Microsoft Entra admin center](https://entra.microsoft.com) →
**App registrations** → **New registration**. Name it something like
`mails-dashboard-graph-sync`. No redirect URI is needed — this app never signs a
user in.

Record the **Application (client) ID** and the **Directory (tenant) ID**.

### 2. Grant the permission

On the new app → **API permissions** → **Add a permission** → **Microsoft
Graph** → **Application permissions** → add:

```
ExchangeMessageTrace.Read.All
```

Then click **Grant admin consent**. It must be an *application* permission, not
delegated — the cron run has no signed-in user.

### 3. Create a client secret

**Certificates & secrets** → **New client secret**. Copy the value immediately;
it is only shown once. Note the expiry date and put a reminder in the calendar —
a silently expired secret is the most likely way this breaks.

> Microsoft recommends a certificate over a secret for production. A secret is
> fine to start; swapping to a certificate later only changes `getGraphToken()`
> in [`utils/graphTrace.js`](../utils/graphTrace.js).

### 4. Provision Microsoft's service principal

The message trace API needs a service principal for Microsoft's own app in the
tenant. Without it every call returns `401` with a "service principal-less
authentication failed" message.

In [Graph Explorer](https://aka.ms/ge), signed in as a tenant admin:

```http
POST https://graph.microsoft.com/v1.0/servicePrincipals
Content-Type: application/json

{ "appId": "8bd644d1-64a1-4d4b-ae52-2e0cbf64e373" }
```

Or with PowerShell:

```powershell
Connect-MgGraph -Scopes "Application.ReadWrite.All"
New-MgServicePrincipal -BodyParameter @{ appId = "8bd644d1-64a1-4d4b-ae52-2e0cbf64e373" }
```

**Provisioning can take several hours.** Calls return 401 until it finishes.
This is normal — do this step first and come back to it.

### 5. Set the environment variables

In Vercel → project → **Settings** → **Environment Variables**:

| Variable | Value |
|---|---|
| `GRAPH_TENANT_ID` | Directory (tenant) ID. Falls back to `AZURE_AD_TENANT_ID` if unset. |
| `GRAPH_CLIENT_ID` | Application (client) ID from step 1 |
| `GRAPH_CLIENT_SECRET` | Secret value from step 3 |
| `CRON_SECRET` | Any long random string. Vercel sends it as a bearer token so the endpoint cannot be triggered by strangers. |

Generate a cron secret with:

```bash
openssl rand -hex 32
```

Redeploy after adding them — environment variables are baked in at deploy time.

## Verifying it works

Sign in as an admin, open **Manage files**, and click **Sync now** under
"Automatic sync". A successful run reports the months written.

The cron entry lives in [`vercel.json`](../vercel.json) and runs at 06:00 UTC
(03:00 Santos) daily. On the Vercel Hobby plan cron jobs run once a day and the
schedule is approximate; Pro runs it on time.

Manual backfill of everything Graph still has:

```
POST /api/sync-graph?days=90
```

## Failure modes

| Symptom | Cause |
|---|---|
| `Missing: GRAPH_CLIENT_ID, …` | Env vars not set, or set but not redeployed. |
| `401` mentioning service principal | Step 4 not done, or still provisioning. Wait. |
| `403` from Graph | `ExchangeMessageTrace.Read.All` missing, delegated instead of application, or admin consent not granted. |
| `Graph token request failed (401)` | Client secret expired or mistyped. |
| Sync reports 0 emails | The range genuinely has no traffic, or the tenant has no trace data yet. |

## What this does not change

Manual upload keeps working exactly as before, and remains the only way to get
data older than 90 days into the dashboard. The two paths are designed to
coexist.
