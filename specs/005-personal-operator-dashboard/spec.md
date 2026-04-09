# Feature Specification: Personal Operator Dashboard

**Feature Branch**: `005-personal-operator-dashboard`  
**Created**: 2026-03-17  
**Status**: Draft  
**Input**: User description: "Build a personal operator dashboard in operator-hub: widget-first, day-first, premium light-mode dashboard with multiple boards, gamified momentum, AI/MCP actions, TV wallboard support, and Parkpal outreach as one specialized board inside a broader personal planning system."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run The Day From One Dashboard (Priority: P1)

As the operator, I open one dashboard in the morning and immediately see what I should complete today, what is already in progress, what slipped, and what matters most right now.

**Why this priority**: Daily steering is the core job of the product. If the dashboard does not improve daily clarity and momentum, the rest of the system becomes decoration.

**Independent Test**: Create a handful of tasks with different states, open the dashboard, move work into today's focus, complete some items, and verify the dashboard reflects today's priorities and progress without leaving the main view.

**Acceptance Scenarios**:

1. **Given** the operator has tasks across inbox, planned work, and unfinished carry-over, **When** the dashboard opens, **Then** it shows a clear today-focused view with current priorities, in-progress work, and unfinished items that need attention.
2. **Given** a task is moved into today's active work, **When** the operator starts or completes it, **Then** the dashboard updates the relevant widgets and progress feedback immediately.
3. **Given** the operator ends the day with unfinished work, **When** the dashboard is opened again later, **Then** unfinished work is visible as carry-over rather than silently disappearing.

---

### User Story 2 - Work Across Multiple Boards Without Losing Context (Priority: P2)

As the operator, I can use different boards for different domains, such as daily execution and Parkpal outreach, while still feeling that I am working inside one coherent system.

**Why this priority**: The user has different modes of work. A single board is too narrow, but unrelated boards would fragment attention and reduce trust in the system.

**Independent Test**: Create at least two boards, including a general daily board and a Parkpal outreach board, navigate between them, and verify that each board has the right focus while the shared dashboard still surfaces the most relevant status.

**Acceptance Scenarios**:

1. **Given** the operator has a general planning board and a Parkpal outreach board, **When** they switch between them, **Then** each board preserves its own purpose, layout, and active work context.
2. **Given** the operator promotes an item from a specialized board into today's focus, **When** they return to the dashboard, **Then** the item appears in the day-focused widgets without duplicating the underlying work.
3. **Given** the operator wants to display progress on a television, **When** TV mode is opened for a board or dashboard view, **Then** the information is readable at a distance and remains visually consistent with the main product.

---

### User Story 3 - Use Actions To Reduce Friction On Avoided Work (Priority: P3)

As the operator, I can trigger useful actions directly from widgets and cards so the system helps me do difficult or repetitive work, especially outreach and follow-up, instead of just reminding me about it.

**Why this priority**: The product is intended to reduce friction around avoided tasks such as contacting people, not merely store lists. Integrated actions are the bridge from planning to execution.

**Independent Test**: Open a widget or task related to follow-up work, trigger an action such as drafting or preparing the next step, and verify that the action result stays connected to the same work item and reduces manual effort.

**Acceptance Scenarios**:

1. **Given** the operator has a task to contact someone, **When** they trigger a direct action from that task, **Then** the system provides a usable next-step output without forcing them into a separate tool first.
2. **Given** a widget shows overdue or due follow-ups, **When** the operator uses a direct action from that widget, **Then** the action applies to the selected work item and returns an outcome tied back to the same context.
3. **Given** external connected services are unavailable, **When** an action cannot be completed, **Then** the system preserves the work item and explains the failure without breaking the surrounding dashboard flow.

### Edge Cases

- What happens when the operator has no tasks or boards yet? The first-run experience should still feel purposeful, with starter structure instead of an empty control panel.
- What happens when too many widgets are added to the dashboard? The system should preserve readability and not allow the primary daily view to become unusable.
- What happens when a task belongs to a specialized board and today's focus at the same time? The system should represent a single work item with shared status, not duplicate copies.
- What happens when the operator leaves many tasks unfinished for several days? Carry-over should remain visible, measurable, and reviewable without overwhelming the main view.
- How does the system handle failed action calls or temporarily disconnected services? It should fail gracefully, keep user context, and make retrying understandable.
- How does TV mode behave when a desktop-heavy layout would become unreadable at distance? TV mode should simplify presentation instead of mirroring the full desktop layout one-to-one.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a primary dashboard whose first job is to help the operator steer the current day.
- **FR-002**: The dashboard MUST combine task visibility and command-center context rather than behaving as a plain list view.
- **FR-003**: The system MUST support multiple boards for different work domains while preserving one shared sense of progress across the product.
- **FR-004**: The system MUST include a general-purpose day or week execution board.
- **FR-005**: The system MUST support Parkpal outreach as a specialized board within the broader system rather than as a separate product.
- **FR-006**: The system MUST allow work items to move through states such as planned, in progress, complete, and unfinished carry-over.
- **FR-007**: The system MUST surface what is currently in progress and what was not completed as expected.
- **FR-008**: The system MUST provide measurable daily and weekly progress feedback for completed and unfinished work.
- **FR-009**: The dashboard MUST be composed of widgets that can be added, arranged, and removed without redefining the whole product.
- **FR-010**: Widgets MUST support direct actions, not just passive display.
- **FR-011**: The system MUST support a small set of quick actions that reduce friction on work items, especially outreach and follow-up tasks.
- **FR-012**: Action results MUST remain connected to the originating work item, widget, or board context.
- **FR-013**: The system MUST support linking work items to broader context such as projects, notes, contacts, goals, or external references when that context is available.
- **FR-014**: The system MUST provide a way to view current goals alongside today's work so the operator can connect daily execution to larger direction.
- **FR-015**: The product MUST include progress and momentum feedback that encourages completion and consistency without turning the product into a novelty game.
- **FR-016**: The product MUST reward completion of meaningful work more strongly than creation of new tasks.
- **FR-017**: The product MUST give unfinished or avoided work explicit visibility so the operator can review patterns rather than lose them in backlog noise.
- **FR-018**: The dashboard visual design MUST feel premium and intentional rather than generic productivity software.
- **FR-019**: The visual system MUST support both light and dark themes, with light theme treated as the primary design reference for the first release.
- **FR-020**: The default desktop experience MUST prioritize readability, strong hierarchy, and fast action access over decorative effects.
- **FR-021**: The system MUST provide a TV-oriented display mode that presents a simplified, readable wallboard view for at-a-distance viewing.
- **FR-022**: The TV-oriented view MUST preserve the same underlying board or dashboard context while reducing information density for readability.
- **FR-023**: The system MUST support connected external services and skills through a stable internal action model so the product does not have to be redesigned each time a new capability is added.
- **FR-024**: The product MUST remain useful even when no external services are configured.
- **FR-025**: The initial release MUST be optimized for one primary user and that user's personal planning workflow.

### Experience Principles

- The product should feel like a personal operator workbench: focused, high-agency, modular, and a little more special than a generic task manager.
- The dashboard should shape behavior, especially around avoided activities such as outreach, by making the next useful action obvious.
- Light mode should feel like a premium studio or workbench rather than a flat white SaaS interface.
- Dark mode should preserve the same design language rather than becoming a separate visual identity.
- Widgets should behave like meaningful modules with content, status, and actions, not as interchangeable empty boxes.
- Gamification should reinforce momentum, completion, and consistency, not raw activity volume.

### Key Entities *(include if feature involves data)*

- **Dashboard**: The operator's main command surface, composed of widgets that surface daily focus, progress, goals, and quick actions.
- **Board**: A focused workspace for a particular mode of work, such as daily execution or Parkpal outreach.
- **Widget**: A configurable dashboard module that presents information, actions, or progress within the main dashboard or a board context.
- **Work Item**: A unit of work the operator wants to plan, execute, review, or complete during a day or week.
- **Goal**: A higher-level objective that gives meaning to daily work and helps the operator connect tasks to direction.
- **Context Link**: A connection from a work item to related information such as a project, contact, note, or external resource.
- **Action**: A user-triggered helper that produces a useful outcome tied to a work item or widget context.
- **Momentum Signal**: A measurable indicator such as completion progress, carry-over, streaks, or consistency that helps the operator review behavior over time.

## Assumptions

- The first release is for a single primary user and does not need multi-user collaboration.
- The product should be valuable even before advanced connected services are configured.
- Parkpal outreach remains important, but it is one workspace inside a broader personal planning system rather than the overall home screen.
- Follow-up and contact work may begin as context attached to work items rather than as a full standalone CRM in the first release.
- The initial dashboard should emphasize today, in-progress work, goals, carry-over, and quick actions before expanding into additional widgets.
- Gamification should remain subtle and premium, with emphasis on momentum and completion rather than points for every interaction.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In manual first-use testing, the operator can identify today's top work items within 10 seconds of opening the dashboard.
- **SC-002**: The operator can move a task into active work and mark it complete from the dashboard flow without needing to navigate through more than one deeper workspace.
- **SC-003**: The product clearly shows both completed work and unfinished carry-over for the current week in a way the operator can explain after a short demo session.
- **SC-004**: At least three widgets in the default dashboard provide direct actions rather than passive display only.
- **SC-005**: A TV-oriented view remains readable from across a room and communicates current priorities without requiring desktop-style interaction.
- **SC-006**: The operator can switch between a general daily board and the Parkpal outreach board while preserving a shared sense of current progress and priorities.
- **SC-007**: In subjective review after one week of use, the operator reports that the system helps reduce friction around at least one previously avoided task type, such as outreach or follow-up.
