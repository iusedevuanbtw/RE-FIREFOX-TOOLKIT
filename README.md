# RE Toolkit

Minimalist reverse engineering and web automation toolkit for Firefox.  
Captures DOM interactions, network traffic, and responses in real-time, providing immediate export to cURL, HAR, or Playwright scripts.

## Features

- **rec**: Records DOM interactions (clicks, inputs, scrolls, keydowns, SPA navigation, dynamic script/iframe injection) with smart CSS selector generation.
- **api**: Captures full HTTP requests (headers, bodies) and **intercepts responses** (Fetch/XHR/SSE/WebSocket), revealing the complete client-server dialog.
- **curl**: One-click export of all captured requests into a ready-to-run bash replay script.
- **dec**: Recursive decoder. Automatically unwraps nested encoding layers (URL → JSON → HTML entities → Base64) and auto-detects/decodes JWTs with expiration analysis.
- **map**: Builds a collapsed endpoint tree (host → method + path), normalizing UUIDs and numbers into `:uuid`/`:num` for instant API surface mapping.
- **har**: Exports captured traffic to HAR 1.2 format for seamless import into Burp Suite, mitmproxy, or Chrome DevTools.
- **pw**: Generates ready-to-use Playwright (Python) automation scripts based on recorded DOM interactions.

## Installation (Local / Dev)

1. Clone or download this repository.
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…**.
4. Select the `manifest.json` file from this directory.
5. The extension icon will appear in your toolbar. Click it to open the popup.

*Note: This is a Manifest V2 extension optimized for local development and security research. It requires Firefox.*

## Usage Workflow

1. Open the target web application.
2. Open RE Toolkit popup and click **rec** to start recording.
3. Perform the actions you want to analyze (login, API calls, navigation).
4. Click **stop**.
5. Switch to the **api** tab and click **capture** to view requests/responses, or **curl** to get a replay script.
6. Use **dec** to decode any obfuscated tokens or payloads.
7. Use **map** to visualize the discovered API endpoints.

## Disclaimer

This tool is designed for educational purposes, authorized security research, bug bounty hunting, and reverse engineering of your own applications. Do not use this tool against systems you do not have explicit permission to test.

## License

MIT License. See [LICENSE](LICENSE) for details.
