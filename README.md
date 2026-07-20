# RE Toolkit
     git clone https://github.com/iusedevuanbtw/RE-FIREFOX-TOOLKIT/   
Browser extension for reverse engineering web applications. Captures network requests, records user interactions, generates automation scripts.

## Installation

1. Clone or download this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" → "Load Temporary Add-on"
4. Select `manifest.json` from the extension directory

## Features

### Recorder
Records all user interactions on the page with millisecond timestamps:
- Clicks with CSS selectors and coordinates
- Text input with values
- Form submissions with field data
- XHR and Fetch requests
- WebSocket connections and messages
- Navigation events (pushState, popstate, hashchange)
- Script loads and DOM mutations

### API Capture
Intercepts all HTTP requests made by the page:
- Request method, URL, status code
- Request and response headers
- Request body with gzip/deflate/brotli decoding
- Filter by URL pattern
- Export as HAR (HTTP Archive) format
- Toggle request blocking (intercept mode)

### Playwright Generator
Generates Python scripts for browser automation:
- Scans page for interactive elements
- Builds CSS selectors (id, name, aria-label, data-testid)
- Creates async Playwright script with clicks and text input
- One-click copy to clipboard

### WebSocket Monitor
Captures WebSocket traffic:
- Connection URLs
- Sent and received messages
- Payload inspection

## Usage

### Recording a session
1. Open the target website
2. Click extension icon → **rec** tab
3. Press **rec** button
4. Interact with the page (clicks, typing, navigation)
5. Press **stop** to finish recording
6. View timeline with all actions and timestamps
7. Export as JSON or generate Playwright script

### Capturing API requests
1. Open the target website
2. Click extension icon → **api** tab
3. Press **capture** to view intercepted requests
4. Use filter to find specific endpoints
5. Toggle **intercept** to enable live logging in DevTools
6. Export as HAR for analysis in other tools

### Generating automation
1. Navigate to the page you want to automate
2. Click extension icon → **pw** tab
3. Press **generate**
4. Copy the Python script
5. Install dependencies: `pip install playwright && playwright install chromium`
6. Run the script

### Extracting HAR
1. Click extension icon → **har** tab
2. Press **export har** to download
3. Open in Chrome DevTools Network tab or any HAR viewer

## Configuration

Create `config/auth.json`:
```json
{
    "token": "Bearer token from captured requests",
    "cookie": "ds_session_id=...",
    "chat_session_id": "from URL"
}
```

## Files

```
reverse-engineering-toolkit/
├── manifest.json          Extension manifest (Firefox)
├── background.js          Background service worker
├── popup.html             Extension popup UI
├── popup.js               Popup logic
├── devtools.html          DevTools panel
├── devtools.js            DevTools panel logic
└── config/
    └── auth.example.json  Configuration template
```

## Permissions

- webRequest` / `webRequestBlocking` — intercept HTTP requests
- storage` / `unlimitedStorage` — persist captured data
- clipboardWrite` — copy generated scripts
- activeTab` / `tabs` — access current page
- downloads` — export HAR files
- webNavigation` — track navigation events
- cookies` — capture authentication tokens

## Building from source

No build step required. The extension uses vanilla JavaScript and runs directly in Firefox.

For the C++ client (DeepSeek API integration), see the separate build script.

## Limitations

- Firefox only (Manifest V2)
- Request body capture limited to 5KB per request
- HAR entries capped at 1000
- WebSocket capture requires page refresh after enabling
