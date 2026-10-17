# BrowserSpace Desktop Runtime

This Electron workspace is an early runtime foundation and is not yet connected to the Next.js dashboard.

## Current behavior

- Stores profile metadata in Electron's user-data directory.
- Uses a distinct persistent Chromium session for each profile.
- Supports system/direct proxy mode and unauthenticated HTTP, HTTPS or SOCKS5 proxy routing at profile launch.
- Exposes an allowlisted IPC API through the preload bridge.
- Keeps renderer Node.js access disabled and context isolation enabled.

## Known gaps

- The dashboard does not yet use the IPC bridge.
- Proxy authentication and encrypted credential storage are not implemented. Do not use authenticated proxies with this version.
- Proxy connectivity checks, external-IP checks and latency measurements are not implemented.
- Profile deletion preserves Chromium session data; explicit data erasure is not implemented.
- The desktop status window is temporary, not the finished browser UI.
- No fingerprint spoofing or stealth patches are included.

Build from the repository root with npm install, then npm run build --workspace @browserspace/desktop. Launch with npm start --workspace @browserspace/desktop after building.
