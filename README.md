# Reachmark BrowserSpace

A privacy-first desktop browser workspace for managing separate, persistent browser profiles with optional per-profile proxy settings.

> BrowserSpace borrows useful product patterns from the four supplied proxy/profile-management references; it does not merge their code blindly. It is an independent implementation, and any future code reuse must respect each source repository's license.

## Product principles

- **Real profile isolation:** each profile owns a persistent browser session, cookies, local storage, cache, bookmarks and settings.
- **Honest privacy controls:** profile separation and proxy routing are explicit; BrowserSpace does not promise anonymity or bypass website security controls.
- **Per-profile proxies:** HTTP, HTTPS and SOCKS5 settings, with optional authentication; credentials must be encrypted at rest and never returned by list/detail APIs.
- **Useful profile operations:** create, rename, launch, stop, archive and delete profiles; notes, tags and last-used metadata.
- **Proxy management:** add/edit/remove proxies, assign them to profiles, import/export non-secret configuration, and show real connection-test results only when a test actually ran.
- **Local-first desktop:** browser profile data stays on the user's device unless a future, clearly disclosed sync feature is explicitly configured.
- **Security by default:** context isolation, no renderer Node.js access, validated IPC, strict ownership checks for any remote API, no secrets in logs or committed files.

## Reference repositories

- [Proxy-Private](https://github.com/mtliou/Proxy-Private) — proxy/profile orchestration and preflight-validation ideas.
- [9proxy-gologin-proxies](https://github.com/ipkznw71/9proxy-gologin-proxies) — proxy credential formats, provider differences and configuration guidance.
- [Gologin_Profile_Manager](https://github.com/txlam97/Gologin_Profile_Manager) — profile table, lifecycle controls and persistent metadata patterns.
- [gologin-pro](https://github.com/nttrung9x/gologin-pro) — reviewed for product/workflow context only; no unlicensed binaries, copied fingerprint-spoofing logic, bundled keys, or unsafe remote updater will be imported.

## Planned architecture

- **Desktop shell:** Electron + TypeScript; isolated persistent sessions keyed by profile ID and a profile window per profile.
- **Dashboard:** Next.js + TypeScript for profile/proxy management.
- **Service layer:** Fastify + schema validation; authentication and ownership checks if/when remote accounts are enabled.
- **Data:** Prisma/PostgreSQL for remote account metadata when required; encrypted local storage for desktop-only secrets.
- **Tests:** proxy validation, credential redaction, profile ownership, assignment/deletion behavior, session persistence, IPC allowlists and failure states.

## Development status

This repository is being initialized. Features must be described as implemented only after their code and tests are present. A green UI or saved proxy record does not prove that the desktop browser is routing traffic through that proxy.

## Security notes

- Never commit .env, API tokens, proxy passwords, profile cookies or browser storage.
- Keep proxy credentials out of logs and UI responses.
- Use supported Chromium/Electron proxy APIs; do not silently rewrite browser fingerprints.
- A proxy test should report the actual outcome, timestamp and error category; never fabricate an IP, location, latency or “connected” status.
- Profile deletion must require confirmation and clearly explain that local session data will be removed.

## License

The initial BrowserSpace implementation is independent. Add an explicit project license before distributing builds or accepting external contributions.
