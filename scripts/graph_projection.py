from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
GRAPH_PATH = ROOT / "projects" / "parkpal" / "data" / "graph.json"


def load_graph(path: Path = GRAPH_PATH) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        graph = json.load(handle)

    required = {"project", "nodes", "edges"}
    missing = required - graph.keys()
    if missing:
        raise ValueError(f"Missing required keys in graph.json: {', '.join(sorted(missing))}")

    return graph


def build_parent_map(edges: list[dict[str, Any]]) -> dict[str, str]:
    return {
        str(edge["target"]): str(edge["source"])
        for edge in edges
        if isinstance(edge.get("source"), str) and isinstance(edge.get("target"), str)
    }


def project_graph(graph: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    project_id = str(graph["project"].get("id", ""))
    parent_map = build_parent_map(graph["edges"])

    audiences: list[dict[str, Any]] = []
    problems: list[dict[str, Any]] = []
    outreach: list[dict[str, Any]] = []
    content: list[dict[str, Any]] = []
    feedback: list[dict[str, Any]] = []

    for node in graph["nodes"]:
        node_type = node.get("type")
        data = node.get("data", {})
        if not isinstance(data, dict):
            continue

        if node_type == "audience":
            audiences.append(
                {
                    "id": node.get("id", ""),
                    "project": project_id,
                    "parent_id": parent_map.get(str(node.get("id", "")), ""),
                    "name": data.get("name", ""),
                    "relevance_why": data.get("relevanceWhy", ""),
                    "confidence_level": data.get("confidenceLevel", ""),
                    "status": data.get("status", ""),
                    "notes": data.get("notes", ""),
                    "tags": ", ".join(data.get("tags", [])),
                }
            )
        elif node_type == "problem":
            problems.append(
                {
                    "id": node.get("id", ""),
                    "project": project_id,
                    "parent_audience_id": parent_map.get(str(node.get("id", "")), ""),
                    "name": data.get("name", ""),
                    "confidence_level": data.get("confidenceLevel", ""),
                    "status": data.get("status", ""),
                    "notes": data.get("notes", ""),
                    "tags": ", ".join(data.get("tags", [])),
                }
            )

    for entry in graph.get("outreach", []):
        if not isinstance(entry, dict):
            continue

        outreach.append(
            {
                "id": entry.get("id", ""),
                "project": entry.get("project", project_id),
                "audience_id": entry.get("audienceId", ""),
                "channel": entry.get("channel", ""),
                "community": entry.get("community", ""),
                "url": entry.get("url", ""),
                "angle": entry.get("angle", ""),
                "status": entry.get("status", ""),
                "notes": entry.get("notes", ""),
            }
        )

    for entry in graph.get("content", []):
        if not isinstance(entry, dict):
            continue

        content.append(
            {
                "id": entry.get("id", ""),
                "project": entry.get("project", project_id),
                "audience_id": entry.get("audienceId", ""),
                "outreach_id": entry.get("outreachId", ""),
                "platform": entry.get("platform", ""),
                "title": entry.get("title", ""),
                "body": entry.get("body", ""),
                "doc_link": entry.get("docLink", ""),
                "status": entry.get("status", ""),
                "sent_at": entry.get("sentAt", ""),
                "posted_channel": entry.get("postedChannel", ""),
                "post_url": entry.get("postUrl", ""),
            }
        )

    for entry in graph.get("feedback", []):
        if not isinstance(entry, dict):
            continue

        feedback.append(
            {
                "id": entry.get("id", ""),
                "project": entry.get("project", project_id),
                "audience_id": entry.get("audienceId", ""),
                "content_id": entry.get("contentId", ""),
                "outreach_id": entry.get("outreachId", ""),
                "source": entry.get("source", ""),
                "summary": entry.get("summary", ""),
                "next_step": entry.get("nextStep", ""),
                "status": entry.get("status", ""),
            }
        )

    return {"audiences": audiences, "problems": problems, "outreach": outreach, "content": content, "feedback": feedback}
