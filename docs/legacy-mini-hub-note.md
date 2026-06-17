# Legacy Mini-Hub Note

Date: 2026-04-17

## Current conclusion

The service exposed on `http://localhost:8787/` is the legacy `operator-hub mini-hub` / hub-only surface.

This is **not** the same UI as the Operator Hub view embedded in Home Assistant.

## Intended product surface

The Home Assistant Operator Hub view is the surface that should be treated as the primary user-facing Operator Hub experience.

## Cleanup direction

The legacy mini-hub should likely be removed, replaced, or clearly marked as internal-only to avoid confusion.

At minimum, future work should avoid assuming that:

- `http://localhost:8787/` is the main Operator Hub UI
- the mini-hub landing page is the correct end-user product surface

## Follow-up

Before removing anything, verify:

- what parts of the current bg-remover / watcher / Microsoft auth flow still depend on the hub-only surface
- what HA expects as its backend URL / hostname
- whether the legacy mini-hub is still needed as an internal API service even if its UI should disappear
