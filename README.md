# Fari Uploader website

This repository contains the website downloaded by the Fari Uploader desktop
application. The page is served locally by the application because it uses a
local uploader API; opening it directly on GitHub Pages does not start the
uploader service.

The `src/license-service` directory contains the separate Cloudflare Worker,
D1 schema, and protected administration panel. Follow its README to deploy the
license API and open the admin panel at `/admin`. The Worker admin token is a
Cloudflare secret and must never be committed.

Once the Worker is deployed, set its HTTPS `workers.dev` base URL as
`licenseApiUrl` in `app-manifest.json`. The desktop launcher checks the
license with that server before downloading the website. It requests explicit
consent before sending the license key, a random installation ID, connection
IP, and the Creator ID entered by the user. The Creator ID is not verified as
an account identity by Roblox.

Keep the desktop EXE open while using the uploader; closing it stops the local
service and website.
