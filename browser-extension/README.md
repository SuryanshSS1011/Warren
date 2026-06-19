# Warren Live — browser extension

Streams your live Wikipedia browsing into an open Warren map.

## Setup
1. Set `WARREN_EXTENSION_TOKEN=<any random string>` in the app's `.env.local` and restart.
2. Load this folder as an unpacked extension (chrome://extensions → Developer mode → Load unpacked).
3. Click the extension icon → enter your Warren app URL (e.g. http://localhost:3000) and the
   same token → Save & connect (you'll be asked to grant permission for that URL).
4. Open Warren in a tab, then browse Wikipedia — each article hop grows your map.

## Security
- POST `/api/extension/hop` requires the token (`Authorization: Bearer …`) and validates the
  body; without a configured token the bridge is disabled.
- The extension only auto-runs on `*.wikipedia.org/wiki/*` and only talks to the URL you set.
