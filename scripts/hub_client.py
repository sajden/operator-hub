#!/usr/bin/env python3
"""Small CLI for talking to the local operator-hub from any repo."""

from __future__ import annotations

import argparse
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_HUB_URL = os.environ.get("OPERATOR_HUB_URL", "http://127.0.0.1:8787")


def request_json(method: str, path: str, payload: dict | None = None) -> dict:
    url = f"{DEFAULT_HUB_URL.rstrip('/')}{path}"
    body = None
    headers = {}

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(url, data=body, method=method, headers=headers)

    try:
        with urlopen(request, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Hub request failed ({error.code}): {detail}") from error
    except URLError as error:
        raise SystemExit(f"Could not reach hub at {DEFAULT_HUB_URL}: {error.reason}") from error


def parse_json_argument(raw: str | None) -> dict:
    if not raw:
        return {}

    try:
        value = json.loads(raw)
    except json.JSONDecodeError as error:
        raise SystemExit(f"Invalid JSON arguments: {error}") from error

    if not isinstance(value, dict):
        raise SystemExit("Arguments JSON must be an object")

    return value


def parse_json_array_argument(raw: str) -> list:
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as error:
        raise SystemExit(f"Invalid JSON values: {error}") from error

    if not isinstance(value, list):
        raise SystemExit("Values JSON must be an array")

    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Call the local operator-hub.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("health", help="Read hub health")
    subparsers.add_parser("projects", help="List discovered projects")
    subparsers.add_parser("tools", help="List MCP-like tools")
    subparsers.add_parser("skills", help="List skills")
    subparsers.add_parser("ms-status", help="Read Microsoft auth status")
    subparsers.add_parser("ms-me", help="Read Microsoft profile through the hub")
    excel_parser = subparsers.add_parser(
        "ms-excel-files", help="List Excel files through the Microsoft-authenticated hub"
    )
    excel_parser.add_argument("--query", help="Optional search term")
    excel_parser.add_argument("--limit", type=int, help="Maximum number of files to return")
    project_excel_parser = subparsers.add_parser(
        "project-excel-files",
        help="List Excel files from the Microsoft folder configured for a project",
    )
    project_excel_parser.add_argument("project_id", help="Project id, for example parkpal")
    project_excel_parser.add_argument("--limit", type=int, help="Maximum number of files to return")
    create_project_excel_parser = subparsers.add_parser(
        "create-project-excel-file",
        help="Create an Excel file in the Microsoft folder configured for a project",
    )
    create_project_excel_parser.add_argument("project_id", help="Project id, for example parkpal")
    create_project_excel_parser.add_argument("file_name", help="Target Excel file name")
    workbook_parser = subparsers.add_parser(
        "project-workbook-metadata",
        help="Read workbook metadata and worksheets for a file in the Microsoft folder configured for a project",
    )
    workbook_parser.add_argument("project_id", help="Project id, for example parkpal")
    workbook_parser.add_argument("file_id", help="Microsoft file id from project-excel-files output")
    range_parser = subparsers.add_parser(
        "project-workbook-range",
        help="Read a worksheet range for a file in the Microsoft folder configured for a project",
    )
    range_parser.add_argument("project_id", help="Project id, for example parkpal")
    range_parser.add_argument("file_id", help="Microsoft file id from project-excel-files output")
    range_parser.add_argument("worksheet_name", help="Worksheet name, for example Audiences")
    range_parser.add_argument("address", help="Excel address, for example A1:G5")
    write_range_parser = subparsers.add_parser(
        "write-project-workbook-range",
        help="Write a worksheet range for a file in the Microsoft folder configured for a project",
    )
    write_range_parser.add_argument("project_id", help="Project id, for example parkpal")
    write_range_parser.add_argument("file_id", help="Microsoft file id from project-excel-files output")
    write_range_parser.add_argument("worksheet_name", help="Worksheet name, for example Outreach")
    write_range_parser.add_argument("address", help="Excel address, for example A2:G2")
    write_range_parser.add_argument(
        "values_json",
        help='2D JSON array, for example \'[["lead-1","parkpal","audience-elbilister","linkedin","EV-angle","draft","note"]]\'',
    )

    tool_parser = subparsers.add_parser("call-tool", help="Call a hub tool")
    tool_parser.add_argument("tool", help="Tool name")
    tool_parser.add_argument(
        "--args",
        help='JSON object with tool arguments, for example \'{"projectId":"parkpal"}\'',
    )

    skill_parser = subparsers.add_parser("run-skill", help="Run a hub skill")
    skill_parser.add_argument("skill", help="Skill name")
    skill_parser.add_argument(
        "--args",
        help='JSON object with skill arguments, for example \'{"projectId":"parkpal"}\'',
    )

    community_parser = subparsers.add_parser(
        "find-communities",
        help="Build a community research plan for a project audience",
    )
    community_parser.add_argument("project_id", help="Project id, for example parkpal")
    community_parser.add_argument("audience_id", help="Audience id, for example audience-elbilister")
    community_parser.add_argument("--market", default="Sverige", help="Market hint, default Sverige")

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "health":
        result = request_json("GET", "/api/health")
    elif args.command == "projects":
        result = request_json("GET", "/api/projects")
    elif args.command == "tools":
        result = request_json("GET", "/api/mcp/tools")
    elif args.command == "skills":
        result = request_json("GET", "/api/skills")
    elif args.command == "ms-status":
        result = request_json("GET", "/api/auth/microsoft/status")
    elif args.command == "ms-me":
        result = request_json("GET", "/api/auth/microsoft/me")
    elif args.command == "ms-excel-files":
        query_params = {}
        if args.query:
            query_params["query"] = args.query
        if args.limit is not None:
            query_params["limit"] = args.limit
        suffix = f"?{urlencode(query_params)}" if query_params else ""
        result = request_json("GET", f"/api/auth/microsoft/excel-files{suffix}")
    elif args.command == "project-excel-files":
        query_params = {}
        if args.limit is not None:
            query_params["limit"] = args.limit
        suffix = f"?{urlencode(query_params)}" if query_params else ""
        result = request_json("GET", f"/api/projects/{args.project_id}/microsoft-excel-files{suffix}")
    elif args.command == "create-project-excel-file":
        result = request_json(
            "POST",
            f"/api/projects/{args.project_id}/microsoft-excel-files",
            {"fileName": args.file_name},
        )
    elif args.command == "project-workbook-metadata":
        result = request_json(
            "POST",
            f"/api/projects/{args.project_id}/microsoft-workbook",
            {"fileId": args.file_id},
        )
    elif args.command == "project-workbook-range":
        result = request_json(
            "POST",
            f"/api/projects/{args.project_id}/microsoft-range",
            {
                "fileId": args.file_id,
                "worksheetName": args.worksheet_name,
                "address": args.address,
            },
        )
    elif args.command == "write-project-workbook-range":
        result = request_json(
            "PATCH",
            f"/api/projects/{args.project_id}/microsoft-range",
            {
                "fileId": args.file_id,
                "worksheetName": args.worksheet_name,
                "address": args.address,
                "values": parse_json_array_argument(args.values_json),
            },
        )
    elif args.command == "call-tool":
        result = request_json(
            "POST",
            "/api/mcp/call",
            {"tool": args.tool, "arguments": parse_json_argument(args.args)},
        )
    elif args.command == "run-skill":
        result = request_json(
            "POST",
            "/api/skills/run",
            {"skill": args.skill, "arguments": parse_json_argument(args.args)},
        )
    elif args.command == "find-communities":
        result = request_json(
            "POST",
            "/api/skills/run",
            {
                "skill": "find_communities_for_audience",
                "arguments": {
                    "projectId": args.project_id,
                    "audienceId": args.audience_id,
                    "market": args.market,
                },
            },
        )
    else:
        parser.error(f"Unsupported command: {args.command}")
        return 2

    json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
