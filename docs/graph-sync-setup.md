# Turning on the Graph sync — setup checklist

Everything the dashboard needs in order to stop depending on hand-uploaded CSVs.
The code is already written and deployed; what follows is the configuration that
was never done. Work through it in order.

For how the sync actually works, see [graph-sync.md](graph-sync.md). This page is
only what to click.

**Legend:** 🟦 Microsoft Entra / Azure (needs tenant admin) · ▲ Vercel dashboard ·
💻 terminal

---

## Read this first: there is a clock running

Microsoft keeps message trace data for **90 days** and cannot backfill further.

- The uploaded archive ends **29 Aug 2025**.
- Graph today reaches back to roughly **28 May 2026**.
- **30 Aug 2025 – 27 May 2026 does not exist anywhere and never will.** No plan
  upgrade, no support ticket, no backfill recovers it. Those nine months are gone.

What is still recoverable is **June, July and August 2026**, and that window
shrinks by one day every day. July 2026 ages out around **29 Sep 2026**.

So: Step 0 today, and Step 7 the moment Step 0 finishes propagating.

---

## Step 0 — 🟦 Provision Microsoft's service principal · **DO THIS FIRST**

This one takes **several hours** to propagate and everything else is blocked
behind it. Start it now, then do steps 1–6 while it bakes.

The message trace API needs a service principal for *Microsoft's own* app to exist
in your tenant. Without it every call returns `401 Service principal-less
authentication failed`, no matter how correctly everything else is configured.

Open [Graph Explorer](https://aka.ms/ge), sign in as a tenant admin, and run:

```http
POST https://graph.microsoft.com/v1.0/servicePrincipals
Content-Type: application/json

{ "appId": "8bd644d1-64a1-4d4b-ae52-2e0cbf64e373" }
```

Or in PowerShell:

```powershell
Connect-MgGraph -Scopes "Application.ReadWrite.All"
New-MgServicePrincipal -BodyParameter @{ appId = "8bd644d1-64a1-4d4b-ae52-2e0cbf64e373" }
```

That GUID is Microsoft's, not yours — do not substitute anything for it.

You need the **Application Administrator** or **Cloud Application Administrator**
role (the `Application.ReadWrite.All` scope) to do this.

- [ ] Service principal created
- [ ] Date/time started: ______________ (expect a wait of a few hours)

---

## Step 1 — 🟦 Register the sync application

[Microsoft Entra admin center](https://entra.microsoft.com) → **App registrations**
→ **New registration**.

| Field | Value |
|---|---|
| Name | `mails-dashboard-graph-sync` |
| Supported account types | Single tenant (this organizational directory only) |
| Redirect URI | **Leave blank** — this app never signs a user in |

This is a *separate* app registration from the one the dashboard uses for sign-in.
Do not reuse `AZURE_AD_CLIENT_ID`.

Copy these two values off the app's Overview page — you need them in Step 4:

- [ ] **Application (client) ID**: ________________________________
- [ ] **Directory (tenant) ID**: ________________________________

---

## Step 2 — 🟦 Grant the API permission

On the new app → **API permissions** → **Add a permission** → **Microsoft Graph**
→ **Application permissions**.

Search for and add exactly:

```
ExchangeMessageTrace.Read.All
```

Then click **Grant admin consent for Wolthers & Associates**. The status column
must read *Granted*.

Two things people get wrong here:

- It must be under **Application permissions**, not Delegated. A delegated
  variant of this scope exists and looks identical in the search results — but the
  nightly cron has no signed-in user, so a delegated grant produces a `403` at
  3am with nobody watching.
- Admin consent is a separate click from adding the permission. Adding it alone
  does nothing.

No Exchange Online RBAC role assignment is needed on top of this. If someone tells
you to assign an Exchange admin role, they are thinking of a different API.

- [ ] Permission added as **Application**
- [ ] Admin consent granted, status shows *Granted*

---

## Step 3 — 🟦 Create a client secret

On the app → **Certificates & secrets** → **New client secret**.

Set the expiry as long as your policy allows. **Copy the Value immediately** — the
column is masked forever once you navigate away. (Copy the *Value*, not the
*Secret ID*; they sit next to each other and look equally plausible.)

An expired secret is the single most likely way this breaks in future, and it
fails quietly.

- [ ] Secret created and value copied
- [ ] **Expiry date**: ________________
- [ ] Calendar reminder set for one month before that date

> Microsoft prefers a certificate over a secret for production. A secret is fine
> to start. Switching later only changes `getGraphToken()` in
> [`utils/graphTrace.js`](../utils/graphTrace.js).

---

## Step 4 — 💻 Generate a cron secret

```bash
openssl rand -hex 32
```

Vercel does **not** create `CRON_SECRET` for you — it is an ordinary environment
variable that Vercel happens to send as `Authorization: Bearer <value>` when it
invokes a cron path. If it is missing, the cron request arrives with no
credentials at all, falls through to the "must be a signed-in admin" branch, and
returns 401 every single night.

That is exactly what has been happening since the sync shipped.

- [ ] Secret generated

---

## Step 5 — ▲ Set the environment variables

Vercel → the `mails-dashboard` project → **Settings** → **Environment Variables**.
Add all four to **Production**:

| Variable | Value | From |
|---|---|---|
| `GRAPH_TENANT_ID` | Directory (tenant) ID | Step 1 |
| `GRAPH_CLIENT_ID` | Application (client) ID | Step 1 |
| `GRAPH_CLIENT_SECRET` | The secret **Value** | Step 3 |
| `CRON_SECRET` | The random hex string | Step 4 |

Also confirm `BLOB_READ_WRITE_TOKEN` is already present — Vercel provides it
automatically when Blob storage is attached, and the sync writes nothing without
it.

- [ ] All four set on Production
- [ ] `BLOB_READ_WRITE_TOKEN` confirmed present

---

## Step 6 — ▲ Redeploy

Environment variables are baked in at deploy time. Adding them changes nothing
until the next deployment.

Deployments → the latest one → **⋯** → **Redeploy**.

- [ ] Redeployed after setting the variables

---

## Step 7 — 💻 Run the backfill · **do this the moment Step 0 propagates**

This is the step that rescues June and July 2026 before they age out. Every day
of delay costs a day of data permanently.

```bash
curl -X POST "https://mails.wolthers.com/api/sync-graph?days=90" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Expect a JSON summary listing the months written. A healthy first run looks
roughly like:

```json
{
  "ok": true,
  "from": "2026-05-28T...",
  "traceRows": 180000,
  "emails": 42000,
  "written": [
    { "month": "2026-06", "emails": 15200 },
    { "month": "2026-07", "emails": 16800 },
    { "month": "2026-08", "emails": 11400 }
  ],
  "skipped": [
    {
      "month": "2026-05",
      "reason": "retention floor cuts into 2026-05; it would only cover from 2026-05-28",
      "override": "?days=90&force=2026-05"
    }
  ]
}
```

**May 2026 being skipped is correct, not an error.** Retention only reaches into
the last few days of May, and writing four days of mail to a file called
`graph-2026-05.csv` would make a partial month permanently indistinguishable from
a complete one in the file drawer. If you want those few days anyway, re-run naming that month —
`&force=2026-05` — and know the file then starts on the 28th.

`force` deliberately takes a month rather than `1`: the month sitting on the
retention floor moves forward with the calendar, so a flag copied from an earlier
run would eventually overwrite a *complete* month with a few days' worth. Naming
the month makes a stale override harmless.

If this returns a `502` mentioning the service principal, Step 0 has not finished
propagating. Wait and retry; nothing else is wrong.

- [ ] Backfill run, months written confirmed
- [ ] Dashboard reloaded and the new months appear in **Manage files**

---

## Step 8 — ▲ Check deployment protection

Vercel → Settings → **Deployment Protection**.

If Standard Protection is enabled, the cron invokes a protected URL and Vercel
may reject it before your handler ever runs. Vercel's docs do not clearly state
whether cron is exempt, so verify rather than assume — Step 9 will show it.

If it turns out to be blocked, enable **Protection Bypass for Automation** and the
cron will carry the `x-vercel-protection-bypass` header automatically.

- [ ] Checked

---

## Step 9 — ▲ Confirm the nightly run

The cron is already declared in [`vercel.json`](../vercel.json): `0 6 * * *`,
which is 06:00 UTC / **03:00 Santos**.

The morning after Step 6, open Vercel → **Cron Jobs** → **View Logs** and confirm
the invocation returned `200`.

Every rejection path now logs a specific reason to the function log, so a failure
tells you which of the above steps is wrong instead of dying silently. That was
not true before — which is why nobody noticed for a year.

- [ ] First nightly run confirmed `200`
- [ ] Dashboard's "through" date has moved to yesterday

---

## Step 10 — ▲ Confirm the plan

Check whether this project is on Hobby or Pro. On **Hobby**:

- `maxDuration: 300` is exactly at the ceiling, with no headroom for a slow night.
- Cron fires anywhere within the 06:00–06:59 UTC hour rather than on time.
- More seriously: Hobby is licensed for **non-commercial, personal use only**. A
  company dashboard on Hobby is a policy risk, not just a performance one.

**Pro** is the right home for this. There, 300s is the default and the ceiling is
800s.

- [ ] Plan confirmed / upgraded

---

## What to expect once it is running

**The staff list will grow, and that is correct.** The hand-made exports only
captured outbound mail from about five mailboxes, which is why twelve people show
as active on four years of data. Graph pulls the whole tenant in both directions,
so all 28 people in [`utils/roster.js`](../utils/roster.js) should start appearing.

**Totals will jump.** Same reason. Received mail was largely invisible before.

**Do not read year-over-year or all-time rankings across the seam.** For the
foreseeable future the dashboard holds four years of outbound-only mail from five
mailboxes, a nine-month hole, and then a few months of complete tenant-wide data.
Any figure that spans that boundary — a share of total, a rank, a trend line — is
comparing two different kinds of measurement. Period views that sit wholly inside
one era are fine.

There are known UI issues with the gap that have not been fixed yet: the staleness
banner goes quiet once any fresh file lands even though nine months are missing,
and the year-comparison chart plots uncovered months as zero rather than as
"no data", which reads as a business collapse. Treat both as cosmetic-but-misleading
until addressed.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Cron does nothing, no error visible | `CRON_SECRET` unset or mismatched. Check the function log — it now names the reason. |
| `401` mentioning *service principal-less authentication* | Step 0 not done, or still propagating. Wait. |
| `403` from Graph | Permission added as Delegated instead of Application, or admin consent never granted (Step 2). |
| `Graph token request failed (401)` | Client secret expired or mistyped (Step 3). Check the Value/Secret ID mix-up. |
| `Graph sync is not configured. Missing: …` | Env vars absent, or set but not redeployed (Steps 5–6). |
| `405 Use POST to trigger a sync from a session` | You opened the URL in a browser. The button in **Manage files** sends a POST; a bare GET is refused on purpose. |
| Sync reports `ok: true` but 0 emails | The range genuinely has no traffic, or the tenant has no trace data yet. |
| Drawer says "Synced N emails" but numbers don't move | Should no longer happen — the loader is now keyed on file content. If it recurs, hard-reload. |

---

## Ongoing maintenance

- **The client secret expires.** It is the most likely future breakage and it is
  silent. Keep the calendar reminder from Step 3.
- **Nothing alerts on failure.** The dashboard's staleness banner is currently the
  only signal, and it has a known blind spot. If this job matters, add a failure
  notification — the endpoint logs enough to hang one off.
- **Manual upload still works** and remains the only way to get anything older
  than 90 days in. The two paths coexist by design and deduplicate against each
  other on internet message id.
