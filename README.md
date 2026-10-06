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
`licenseApiUrl` in `app-manifest.json` and rebuild the release EXE.

The EXE bundles the Python launcher/backend, webpage, manifest, and icon. A user
only needs `FariUploader.exe`; they do not need to prepare or keep `.py`, `.html`,
or configuration files beside it. The application creates its own persistent
settings, license data, playlists, logs, song folder, and upload queue under
`%LOCALAPPDATA%\FariUploader`. Those working files are kept locally so uploads
and settings persist between runs.

The launcher requires explicit consent before sending the license key, a random
installation ID, connection IP, and the Creator ID and account/group type
entered by the user to the license service. When the user first saves their
account, the license locks to that Creator ID and type; another account needs
a different license. Roblox API keys stay local and are never sent to the
license service. Creator ID is a user-provided value, not a Roblox-verified
identity.

Keep the desktop EXE open while using the uploader; closing it stops the local
service and website.

## Build the single-file Windows release

From the project root:

```powershell
magick -background none src\app-icon.svg -define icon:auto-resize=256,128,64,48,32,16 FariUploader.ico
pyinstaller --noconfirm --clean --onefile --windowed --distpath . --workpath src\build --specpath src --icon ..\FariUploader.ico --add-data "..\index.html;." --add-data "..\app-manifest.json;." --name FariUploader-1.3.0 src\launcher.py
```

`FariUploader-1.3.0.exe` is the only application file to distribute.
`--windowed` suppresses the developer console, and `--onefile` bundles Python
and its assets into the EXE. PyInstaller extracts its private runtime payload
to a temporary directory while the app is running; users do not need to manage
that directory.
