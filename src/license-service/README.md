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

For a brand-new D1 database, initialize the schema:

```powershell
wrangler d1 execute fari-uploader-licenses --remote --file=.\schema.sql
```

For the existing database configured in this project, apply the account-binding
migration exactly once instead:

```powershell
wrangler d1 execute fari-uploader-licenses --remote --file=.\migrations\0002_account_binding.sql
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

Give each generated key to its intended user through a private channel.
Revoking a license blocks subsequent launches; an already open local application
remains active until it is closed. The panel can permanently delete a license
and its recorded activation details when they are no longer needed, or reset a
recorded device activation to release its device slot.
