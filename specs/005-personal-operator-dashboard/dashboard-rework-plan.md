# Dashboard Rework Plan

**Feature**: `005-personal-operator-dashboard`  
**Date**: 2026-03-18  
**Purpose**: Turn the current functional dashboard MVP into the product described by the spec.

## Goal

Raise the home dashboard from a basic widget page to a real day-first command center with:

- stronger information hierarchy
- fewer but better modules
- more intentional premium visual design
- clearer behavior shaping around avoided work

## Problems In The Current Dashboard

The current dashboard works technically, but misses the product goal in five ways:

1. The hierarchy is too flat.
2. The widgets feel like generic blocks instead of meaningful modules.
3. The visual language is still too basic and product-generic.
4. The dashboard does not yet shape behavior strongly enough around outreach and follow-up.
5. The board rail and summary strip take space without adding enough product value.

## Target Home Dashboard

The home dashboard should answer these questions within a few seconds:

1. What must I finish today?
2. What is already in motion?
3. What am I avoiding or should follow up on?
4. What larger direction am I working toward?
5. How is the week going?

## Default Modules

The first serious home dashboard should use these modules:

### 1. Today Focus

Primary module. This should dominate the layout.

Contents:

- today's most important work items
- quick add
- direct actions per item
- clear importance and friction signals
- carry-over surfaced inside the same module

### 2. In Motion

Secondary module.

Contents:

- current in-progress work
- short status view
- one-click complete

### 3. Follow-ups

Secondary module and important behavior-shaping area.

Contents:

- follow-up and outreach-heavy work items
- direct draft action
- explicit overdue or avoided visibility

### 4. Current Direction

Context module.

Contents:

- 1-3 active goals
- short description
- relation to current work

### 5. Momentum

Compact feedback module.

Contents:

- completed today
- completed this week
- carry-over
- one subtle consistency signal

## Modules To Remove Or Downgrade From The Current Home Dashboard

These should not dominate the next dashboard iteration:

- generic `Quick Actions` as a top-level equal widget
- broad board rail as a major section
- flat metric strip as a primary visual element

They can remain, but should either:

- move lower in hierarchy
- become utility/navigation elements
- or be folded into more meaningful modules

## Layout Direction

The next dashboard should not use an even widget grid.

Recommended layout:

- large hero area for `Today Focus`
- right-side support column for `Follow-ups` and `Current Direction`
- lower row for `In Motion` and `Momentum`
- lightweight navigation for boards, not a large rail

## Visual Direction

The next pass should aim for a clearer premium workbench look:

- warmer light-mode surfaces
- stronger typography hierarchy
- less generic rounded-card sameness
- more intentional spacing and module proportions
- better distinction between primary, secondary, and utility elements

Avoid:

- overusing identical cards
- equal visual weight everywhere
- generic SaaS dashboard composition

## Interaction Direction

The next pass should strengthen directness:

- item actions should be visible without clutter
- drag/drop should feel real on boards
- home dashboard should support quick focus changes without feeling noisy
- follow-up tasks should be easier to act on than to avoid

## Implementation Order

### Step 1: Rework Dashboard Structure

Refactor [OperatorDashboardPage.tsx](/home/sajden/github/operator-hub/app/src/pages/OperatorDashboardPage.tsx) so the page is built around:

- `Today Focus`
- `In Motion`
- `Follow-ups`
- `Current Direction`
- `Momentum`

### Step 2: Replace Weak Modules

Replace or reduce:

- current summary strip
- current board rail
- current `Quick Actions` prominence

### Step 3: Add Follow-up Module

Introduce a real dashboard module for follow-up/outreach-heavy items instead of leaving that concern implicit.

### Step 4: Redesign Visual System

Refine [theme.css](/home/sajden/github/operator-hub/app/src/styles/theme.css) so the dashboard feels more intentional and less like a first-pass prototype.

### Step 5: Tighten Widget Language

Update widget wrappers and internals so each module has:

- stronger title treatment
- clearer status/KPI treatment
- more useful item cards
- less repetitive eyebrow/meta text

### Step 6: Reassess Board Entry Points

Keep board navigation, but reduce its dominance on the home screen. Boards should feel like deeper workspaces, not the main content of the dashboard.

## Success Check For This Rework

This pass is successful when:

- the dashboard feels clearly day-first
- the user can immediately identify today's focus
- follow-up work is more visible than before
- the page feels more premium and less generic
- the system feels more like one command center and less like disconnected widgets

## What This Plan Does Not Cover Yet

This plan does not yet redesign:

- the full board experience
- Parkpal integration depth
- provider-backed actions
- CRM-light data model
- TV-view polish

Those come after the home dashboard reaches the intended level.
