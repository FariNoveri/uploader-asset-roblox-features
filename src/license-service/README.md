# Fari Uploader license service

This Cloudflare Worker hosts the license API and the separate administration
website at `/admin`. D1 stores only a SHA-256 hash of each license key. The
plaintext key is shown once when an administrator creates it.

The client requires explicit consent for each launch before sending the license
key, a random installation UUID, the network IP observed by Cloudflare, and the
user-entered Roblox Creator ID and account/group type. On the first save, the
license becomes permanently bound to that Creator ID and type; using another
account requires a separate license. The Creator ID is an unverified user
claim, not proof of Roblox account identity. The Roblox API key is never
transmitted to or stored by this service. The installation UUID is not a
hardware fingerprint. Decide an appropriate retention period and delete records
when they are no longer needed.

## Create and deploy

The D1 database ID is already configured in `wrangler.toml`. Run these commands
from this directory after signing in to Cloudflare. Install Wrangler only if it
is not already available:

```powershell
npm install --global wrangler
wrangler login
```

For a brand-new D1 database, initialize the complete schema:

```powershell
wrangler d1 execute fari-uploader-licenses --remote --file=.\schema.sql
```

For an existing database, apply each migration that is not already present,
exactly once and in order. Migration 0002 adds account binding and migration
0003 adds maintenance/update controls:

```powershell
wrangler d1 execute fari-uploader-licenses --remote --file=.\migrations\0002_account_binding.sql
wrangler d1 execute fari-uploader-licenses --remote --file=.\migrations\0003_app_controls.sql
```

Set a strong, unique admin token as a Worker secret. Wrangler prompts for its
value; type it directly into the prompt. Do not paste it into chat, source code,
the manifest, or GitHub:

```powershell
wrangler secret put ADMIN_TOKEN
wrangler deploy
```

Use a randomly generated token with at least 32 characters. Keep it private and
never put it in Git, the HTML, or the EXE. After deployment, copy the Worker URL
`https://fari-uploader-license.cahayalunamaharani1.workers.dev` into the
`licenseApiUrl` field in the root `app-manifest.json` and publish that manifest
whenever changing Worker account/hostname. The launcher deliberately refuses
a non-HTTPS or non-Workers.dev license endpoint.

Deploy the updated Worker after applying the existing-database migration:

```powershell
wrangler deploy
```

Open `https://fari-uploader-license.cahayalunamaharani1.workers.dev/admin`,
enter the admin token, and create license keys. The
`https://fari-uploader-license.cahayalunamaharani1.workers.dev/admin/accounts`
page shows
the Creator ID and account/group type users bind to each license on their first
save. That binding cannot be changed to another account; issue another license
for another account. The Roblox API key is never sent to this service. Creator
ID remains an unverified user-provided value.

The Manajemen Lisensi page also controls application maintenance and EXE
updates. Maintenance blocks new launches and stops already-running version
1.4.0+ uploaders when they next poll the service (within 30 seconds); the
launcher stops its local web server immediately and closes after showing the
maintenance message. The already-open browser tab cannot make further requests
to the local uploader. Older already-running clients are not remotely stopped.
To publish an update,
first host the new Windows EXE at a public HTTPS URL. Enter its higher
`x.y.z` version, URL, and SHA-256 in the panel and save. Version 1.4.0 and
newer launchers automatically download the EXE, verify its SHA-256, and install
it by restarting. Earlier launcher releases must be manually replaced once
before they can self-update. Clear the update fields and save to stop offering
that update. Keep maintenance disabled unless the service should be unavailable.

Give each generated key to its intended user through a private channel.
Revoking a license blocks subsequent launches; an already open local application
remains active until it is closed. The panel can permanently delete a license
and its recorded activation details when they are no longer needed, or reset a
recorded device activation to release its device slot.
