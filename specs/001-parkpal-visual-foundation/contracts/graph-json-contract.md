# Contract: Parkpal Graph JSON

## File Location

`projects/parkpal/data/graph.json`

## Purpose

Defines the canonical graph data consumed by both frontend visualization and Excel export script.

## Schema Contract (MVP)

```json
{
  "project": {
    "id": "parkpal",
    "name": "Parkpal",
    "summary": "Project for identifying audiences, problems, channels and outreach opportunities.",
    "strengths": [
      "Data about parking",
      "Data about EV charging locations"
    ]
  },
  "nodes": [
    {
      "id": "project-parkpal",
      "type": "project",
      "position": { "x": 0, "y": 0 },
      "data": {
        "name": "Parkpal",
        "summary": "Project for identifying audiences, problems, channels and outreach opportunities.",
        "strengths": [
          "Data about parking",
          "Data about EV charging locations"
        ]
      }
    }
  ],
  "edges": [
    {
      "id": "edge-project-audience",
      "source": "project-parkpal",
      "target": "audience-elbilister"
    }
  ]
}
```

## Required Rules

- Top-level keys: `project`, `nodes`, `edges`.
- Allowed node types in MVP: `project`, `audience`, `problem`.
- `confidenceLevel` for initial dataset is `hypotes` for audience/problem nodes.
- IDs must be unique and stable.
