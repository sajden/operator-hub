# Remotion MCP Setup

`@remotion/mcp` is now installed in [hub/package.json](/home/sajden/github/operator-hub/hub/package.json).

Important:
- the official `@remotion/mcp` package is a documentation MCP
- it helps an AI assistant search Remotion docs
- it is not the actual video renderer

## Installed version

- `@remotion/mcp@4.0.438`

## Run locally

From the hub folder:

```bash
cd /home/sajden/github/operator-hub/hub
npm run remotion:mcp
```

This starts the official Remotion MCP server over stdio.

## Verified upstream behavior

The installed package exposes one documentation-search tool:

- `remotion-documentation`

Its purpose is to help an AI client understand Remotion concepts and APIs.

## Example client config

Cursor / MCP-style config:

```json
{
  "mcpServers": {
    "remotion-documentation": {
      "command": "npx",
      "args": ["@remotion/mcp@4.0.438"]
    }
  }
}
```

If you want to use the locally installed package instead of `npx`, point your MCP client at:

- command: `npm`
- args: `["run", "remotion:mcp"]`
- working directory: `/home/sajden/github/operator-hub/hub`

## How this fits operator-hub

Inside `operator-hub` we now separate two concerns:

1. Documentation assistance
- provided by `@remotion/mcp`
- useful for autonomous agents to understand Remotion patterns

2. Local render preparation
- provided by `render_site_hero_motion`
- writes bounded local composition + job files under:
  - [`.local/renders/site-hero-motion/`](/home/sajden/github/operator-hub/.local/renders/site-hero-motion)

## Next runtime step

To get real MP4 rendering, add one of:
- a local Remotion render worker in this repo
- a dedicated render adapter that reads our `.composition.json` jobs
- later, a more direct execution bridge if Remotion publishes one meant for rendering rather than documentation search
