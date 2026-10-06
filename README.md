# Fari Uploader website

This repository contains the HTML page downloaded by the Fari Uploader launcher.
The page is intended to be served locally by the desktop application because it
uses the uploader's local API. Opening the page directly from GitHub Pages does
not start the uploader backend.

## Launcher configuration

The launcher fetches `app-manifest.json` from this repository's `main` branch.
The manifest contains the website version, minimum supported launcher version,
credit, license, download URL, and SHA-256 checksum. Update the checksum whenever
`index.html` changes.

## Build the Windows executable

From the project folder, install PyInstaller and build the launcher:

```powershell
py -m pip install pyinstaller
py -m PyInstaller --noconfirm --clean --onefile --windowed --name FariUploader launcher.py
```

The executable is created at `dist/FariUploader.exe`. The launcher downloads and
validates the website at startup, then starts the local uploader service and
opens it in the default browser.
