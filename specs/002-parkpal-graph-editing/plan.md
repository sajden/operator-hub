# Implementation Plan: Parkpal Graph Editing MVP

**Branch**: `002-parkpal-graph-editing` | **Date**: 2026-03-10 | **Spec**: [/home/sajden/github/operator-hub/specs/002-parkpal-graph-editing/spec.md](/home/sajden/github/operator-hub/specs/002-parkpal-graph-editing/spec.md)
**Input**: Feature specification from `/specs/002-parkpal-graph-editing/spec.md`

## Summary

Add a local-first editing workflow to the Parkpal React Flow page: edit existing nodes through an inspector, create new audience/problem nodes visually, and save the updated graph back to `projects/parkpal/data/graph.json` through a minimal local save endpoint in the Vite development server.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Python 3.11+ (export), Node.js 20+ (local save endpoint)  
**Primary Dependencies**: React 18, React Flow, Vite, openpyxl  
**Storage**: Local JSON graph file and generated `.xlsx` export  
**Testing**: Local manual validation with `npm run dev`, save flow, and Python export verification  
**Target Platform**: Local development via VS Code terminal on macOS/Linux  
**Project Type**: Web frontend with development-only local persistence endpoint  
**Performance Goals**: Save and reload cycles under 2 seconds for small local graphs  
**Constraints**: No full backend, no database, no Docker in this iteration, preserve simple file-based source of truth  
**Scale/Scope**: Parkpal only, `project`/`audience`/`problem` nodes, single save endpoint

## Constitution Check

- Constitution file remains a placeholder template with no active gates.
- Gate result: **PASS**.

## Project Structure

```text
operator-hub/
├── app/
│   └── src/
│       ├── components/
│       ├── data/
│       ├── pages/
│       └── types/
├── projects/
│   └── parkpal/
│       ├── data/
│       │   └── graph.json
│       └── exports/
├── scripts/
│   └── export_to_excel.py
└── specs/
    └── 002-parkpal-graph-editing/
```

**Structure Decision**: Keep persistence local and lightweight by extending the existing frontend and using a development-only save endpoint instead of introducing a standalone backend service.
