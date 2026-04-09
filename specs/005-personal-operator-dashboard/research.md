# Phase 0 Research: Personal Operator Dashboard

## Decision 1: Use a local SQLite database as the planner source of truth

- Decision: Store planner domain data in a local SQLite database managed by the existing hub.
- Rationale: Boards, work items, widget layouts, momentum signals, and action history need structured queries, stable identifiers, and event-friendly history that would become awkward in ad hoc JSON files or browser storage.
- Alternatives considered: Local JSON files per board (simple but weak for history and cross-view queries), browser-only local storage (too fragile and device-bound), a remote database (breaks local-first direction).

## Decision 2: Keep `operator-hub` as one app shell with multiple routes and workspaces

- Decision: Expand the current app into a route-based shell with a default operator dashboard, planner board views, TV view, and the existing Parkpal page as a specialized workspace.
- Rationale: The user wants one coherent system with several boards, not a set of separate apps. Routing also gives a clean path for a TV-only surface without duplicating the whole frontend.
- Alternatives considered: Keep one giant page and add more panels (would become cluttered quickly), create a separate planner repo (would fragment the product and duplicate shared capability logic).

## Decision 3: Model the dashboard as widget definitions plus widget instances

- Decision: Use a registry of supported widget types and persist per-view widget instances with placement and configuration.
- Rationale: The product vision depends on modular widgets and fast customization. A widget registry preserves consistency while still allowing the dashboard to evolve.
- Alternatives considered: Hard-code a single dashboard layout (too rigid), store arbitrary free-form widget JSON without typed widget classes (too hard to validate and extend cleanly).

## Decision 4: Introduce an action-capability-provider layering for integrated helpers

- Decision: Represent user-triggered helpers as stable product actions that resolve through capabilities and provider adapters behind the hub.
- Rationale: The system is expected to grow many MCP and API integrations. A stable action layer lets the product add providers without exposing raw provider logic to widgets and boards.
- Alternatives considered: Let widgets call providers directly (fast at first but brittle), build a full automatic rules engine now (too early before the core daily workflow is proven).

## Decision 5: Keep v1 actions user-triggered only

- Decision: Limit the first release to direct, user-triggered actions from widgets and work items.
- Rationale: This keeps the system understandable and avoids hidden automation before the dashboard, board model, and action contracts have proven value.
- Alternatives considered: Immediate automatic rules by board or column (high complexity and hard to reason about), no actions at all (misses the product's core promise to reduce friction).

## Decision 6: Treat TV mode as a dedicated read-only wallboard route

- Decision: Build a separate TV-oriented route that reads the same planner data but uses a reduced widget set and larger presentation rules.
- Rationale: A desktop dashboard squeezed onto a television will be unreadable. A dedicated wallboard route keeps the information useful at distance while preserving the same underlying planner model.
- Alternatives considered: Cast the normal desktop view as-is (poor readability), build a separate TV app with separate data rules (duplicates logic).

## Decision 7: Preserve Parkpal outreach as a specialized board, not the root data model

- Decision: Keep Parkpal graph and outreach workflows intact, but place them inside the larger operator shell as one specialized workspace.
- Rationale: The user already has useful Parkpal-specific work underway. The broader planner should absorb it without forcing all personal planning into the current graph model.
- Alternatives considered: Rebuild everything on top of the Parkpal graph model (too domain-specific), ignore Parkpal in v1 (would disconnect current work from the new product).

## Decision 8: Use a premium light-first design system with semantic theme tokens

- Decision: Define a light-first premium visual system with semantic tokens for surface, focus, progress, blocker, and completion states, then mirror the same language in dark mode.
- Rationale: The user wants something that feels high-tech and motivating, but not childish or sci-fi gimmicky. Semantic tokens also make widget and TV views consistent.
- Alternatives considered: Generic SaaS styling (too bland), neon sci-fi dashboard styling (likely to harm readability and wear out quickly), one-off page-level styling (would not scale across widgets).

## Decision 9: Start CRM behavior through linked work items and follow-ups, not a full CRM suite

- Decision: Let work items attach contacts, notes, files, and follow-up context in v1 without forcing a full standalone contact and campaign product immediately.
- Rationale: The user's immediate pain is daily execution and outreach avoidance. Lightweight CRM linkage supports that pain without overcommitting to a full sales platform too early.
- Alternatives considered: Full CRM from day one (too broad), no contact or follow-up linkage at all (would miss one of the user's most important avoided workflows).

## Clarification Resolution Summary

All planning-phase uncertainties are resolved for this feature:
- Storage model: local SQLite owned by the hub
- Frontend shell: route-based operator dashboard plus specialized boards
- Widget model: registry plus persisted widget instances
- Action strategy: user-triggered action layer with provider abstraction
- TV mode: dedicated read-only wallboard route
- Design direction: premium light-first workbench with dark parity
