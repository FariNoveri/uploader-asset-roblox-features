# Fari Uploader license service

This Cloudflare Worker hosts the license API and the separate administration
website at `/admin`. D1 stores only a SHA-256 hash of each license key. The
plaintext key is shown once when an administrator creates it.

The client requires explicit consent for each launch before sending the license
key, a random installation UUID, the network IP observed by Cloudflare, and the
user-entered Roblox Creator ID. The Creator ID is an unverified user claim, not
proof of Roblox account identity. This installation UUID is not a hardware
fingerprint. Decide an appropriate retention period and delete records when they
are no longer needed.

## Create and deploy

Run these commands from this directory. Install Wrangler and authenticate with
your Cloudflare account first. Create the D1 database outside this directory so
Wrangler does not try to validate the not-yet-filled ID in `wrangler.toml`:

```powershell
npm install --global wrangler
wrangler login
Push-Location $env:TEMP
wrangler d1 create fari-uploader-licenses
Pop-Location
```

Copy the returned database ID into `wrangler.toml`, replacing
`REPLACE_WITH_D1_DATABASE_ID`. Then initialize the database and set a strong,
unique admin token as a Worker secret:

```powershell
wrangler d1 execute fari-uploader-licenses --remote --file=./schema.sql
wrangler secret put ADMIN_TOKEN
wrangler deploy
```

Use a randomly generated token with at least 32 characters. Keep it private and
never put it in Git, the HTML, or the EXE. After deployment, copy the Worker URL
(for example `https://fari-uploader-license.<your-subdomain>.workers.dev`) to
the `licenseApiUrl` field in the root `app-manifest.json` and publish that
manifest. The launcher deliberately refuses a non-HTTPS or non-Workers.dev
license endpoint.

Open `https://<your-worker>.workers.dev/admin`, enter the admin token, and create
license keys. Give each generated key to its intended user through a private
channel. Revoking a license blocks subsequent launches; an already open local
application remains active until it is closed. The panel can permanently delete
a license and its recorded activation details when they are no longer needed,
or reset a recorded device activation to release its device slot.
