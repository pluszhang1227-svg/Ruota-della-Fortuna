# Remote MCP deployment

This fork adds a standard stateless Streamable HTTP MCP endpoint at `/mcp`.

## Render

1. In Render choose **New → Blueprint**.
2. Connect this repository: `pluszhang1227-svg/Ruota-della-Fortuna`.
3. Apply `render.yaml`.
4. After deployment, the MCP URL is:

   `https://<render-service-hostname>/mcp`

Health check: `https://<render-service-hostname>/health`

The endpoint exposes:

- `ero_slot_spin`
- `ero_slot_dimensions`

No credentials are required by this server. Add authentication before using it for private data; this project only serves public tag data and randomization.
