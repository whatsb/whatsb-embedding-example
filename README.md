# WhatsBox White-Label Integration Demo

This project demonstrates how to white-label and embed the WhatsBox application into your own web application using an `<iframe>`. It serves as a reference implementation for handling authentication, message passing, and secure embedding.

---

## Table of Contents

- [Getting Started](#-getting-started)
- [Integration Architecture](#-integration-architecture)
- [Implementation Details](#-implementation-details)
- [Project Structure](#-project-structure)
- [Deployment](#-deployment)
- [Developer Guide](#-developer-guide)
- [Message Communication Reference](#-message-communication-reference)
- [Iframe Internal Logic Reference](#-reference-iframe-internal-logic)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher recommended)
- **NPM** (Node Package Manager)

### Installation

1. Clone this repository.

   > ⚠️ A `.gitignore` file is included. It excludes `node_modules`, `.env`, and other local artifacts – **do not commit your `.env` file to source control**.

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Copy the example env file and configure your values:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and set your configuration:
   ```dotenv
   # WhatsBox API endpoint
   WA_API_URL=https://whatsb-api-602145311578.asia-south1.run.app

   # Your secret API key (keep this safe!)
   WA_API_KEY=sk.your_api_key_here

   # (Optional) Comma-separated origins for CSP frame-src
   FRAME_ORIGINS=https://app.whatsbox.io,https://app.whatsbox.io

   # (Optional) Comma-separated origins for CSP connect-src
   CONNECT_ORIGINS=https://whatsb-api-602145311578.asia-south1.run.app
   ```

### Running the Application

**Development mode** (with auto-reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

Open your browser and navigate to: `http://localhost:7000/embed`

### Available Endpoints

| Method | Endpoint        | Description                    |
|--------|-----------------|--------------------------------|
| GET    | `/`             | Redirects to `/embed`          |
| GET    | `/embed`        | Main application               |
| GET    | `/health`       | Health check (returns JSON)    |
| POST   | `/get-wa-token` | Generate WhatsBox auth token   |

---

## 🧩 Integration Architecture

The integration consists of two main parts:

1. **Host App (Your Website)**:
   - Embeds the WhatsBox iframe
   - Manages user authentication
   - Communicates with the iframe via `postMessage`

2. **WhatsBox Iframe**:
   - The embedded chat interface
   - Receives authentication tokens from the Host App

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Application                         │
│  ┌─────────────┐    postMessage    ┌─────────────────────┐  │
│  │  Frontend   │ ←───────────────→ │  WhatsBox Iframe    │  │
│  │  (Vue.js)   │                   │  (Embedded App)     │  │
│  └──────┬──────┘                   └─────────────────────┘  │
│         │                                                    │
│         │ HTTP                                               │
│         ▼                                                    │
│  ┌─────────────┐                   ┌─────────────────────┐  │
│  │  Backend    │ ───────────────→  │  WhatsBox API       │  │
│  │  (Express)  │   x-api-key       │  (Token Generation) │  │
│  └─────────────┘                   └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Implementation Details

### 1. Iframe Configuration

The iframe must be configured with specific attributes for proper functionality.

**Key Attributes:**
- `src`: WhatsBox embedded URL (e.g., `https://app.whatsbox.io/embedded`)
- `allow`: Permissions for media and clipboard features
- `sandbox`: Security restrictions for iframe isolation

```html
<iframe 
    id="whatsboxIframe" 
    src="https://app.whatsbox.io/embedded" 
    frameborder="0"
    allow="camera; microphone; clipboard-read; clipboard-write"
    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation">
</iframe>
```

**Sandbox Permissions Explained:**
| Permission | Purpose |
|------------|---------|
| `allow-same-origin` | Required for local storage and cookies |
| `allow-scripts` | Required for JavaScript execution |
| `allow-forms` | Required for login and message sending |
| `allow-popups` | Required for OAuth flows or external links |
| `allow-popups-to-escape-sandbox` | Allows popups to bypass sandbox |
| `allow-top-navigation-by-user-activation` | Allows user-initiated navigation |

### 2. Authentication Flow

Users log in to *your* system, and your backend generates a WhatsBox token automatically.

#### The Process:

1. **Iframe Ready**: Iframe sends `EMBED_READY` message when loaded
2. **User Enters Credentials**: User fills in email, name, and role
3. **Token Request**: Frontend calls backend `/get-wa-token` endpoint
4. **Token Generation**: Backend calls WhatsBox API with your secret API key
5. **Login**: Token is sent to iframe via `postMessage`

#### Backend Implementation (server.js):

```javascript
app.post('/get-wa-token', async (req, res) => {
    try {
        const tokenEndpoint = `${process.env.WA_API_URL}/auth/generate-auth-token`;
        const response = await axios.post(tokenEndpoint, {
            email: req.body.email,
            name: req.body.name,
            role: req.body.role  // 'Admin' or 'User'
        }, {
            headers: { 'x-api-key': process.env.WA_API_KEY }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch WA token' });
    }
});
```

#### Frontend Implementation (app.js):

```javascript
// Listen for iframe messages
window.addEventListener('message', (event) => {
    const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    
    if (msg.type === 'EMBED_READY') {
        // Iframe is ready - acknowledge receipt
        sendMessage({ type: 'ack', receivedType: msg.type });
    }
});

// Request token and login
async function loadToken() {
    const response = await axios.post('/get-wa-token', userCredentials);
    sendMessage({ action: "login", data: { token: response.data.token } });
}

// Send message to iframe
function sendMessage(msg) {
    const iframe = document.getElementById('whatsboxIframe');
    iframe.contentWindow.postMessage(JSON.stringify(msg), "*");
}
```

---

## 📂 Project Structure

```
├── app.js                  # Vue.js frontend application
├── index.html              # Main HTML entry point with iframe
├── styles.css              # Application styles
├── server.js               # Express.js backend server
├── package.json            # Node.js dependencies and scripts
├── .env.example            # Environment variables template
├── .env                    # Your local environment config (not in git)
├── Dockerfile              # Docker container configuration
├── deploy.bat              # Google Cloud Run deployment script
├── OneSignalSDKWorker.js   # Push notification service worker
├── LICENSE                 # MIT License
└── README.md               # This documentation
```

---

## 🚀 Deployment

### Local Development

```bash
npm run dev    # Uses nodemon for auto-reload
```

### Docker

Build and run locally:
```bash
docker build -t whatsbox-embed .
docker run -p 8080:8080 --env-file .env whatsbox-embed
```

### Google Cloud Run

Use the included deployment script:
```bash
./deploy.bat
```

Or deploy manually:
```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Build and push image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/whatsbox-embed:latest .

# Deploy to Cloud Run
gcloud run deploy whatsbox-embed \
    --image gcr.io/YOUR_PROJECT_ID/whatsbox-embed:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --env-vars-file=.env
```

**Note:** The Dockerfile is configured to use port 8080 for Cloud Run compatibility.

---

## 👩‍💻 Developer Guide

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 7000, Docker: 8080) |
| `WA_API_URL` | Yes | WhatsBox API base URL |
| `WA_API_KEY` | Yes | Your secret API key |
| `FRAME_ORIGINS` | No | Comma-separated CSP frame-src origins |
| `CONNECT_ORIGINS` | No | Comma-separated CSP connect-src origins |

### Frontend Architecture (Vue.js)

The frontend uses Vue 3 with the Options API. Key data properties:

```javascript
data() {
    return {
        iframe: null,              // Iframe DOM reference
        iframeOrigin: null,        // Captured origin for postMessage
        userCredentials: {         // User login data
            email: '',
            name: '',
            role: 'User'           // 'User' or 'Admin'
        },
        messages: [],              // Console message log
        showLoading: true,         // Loading overlay state
        isAuthenticated: false,    // Authentication status
        sidebarCollapsed: false,   // Desktop sidebar state
        sidebarVisible: false,     // Mobile sidebar drawer state
        showConsole: true          // Console panel visibility
    };
}
```

### Key Methods

| Method | Description |
|--------|-------------|
| `loadToken()` | Fetches token from backend and sends login to iframe |
| `logout()` | Sends logout action to iframe |
| `sendMessage(msg)` | Posts a message to the iframe |
| `handleMessage(event)` | Processes incoming iframe messages |
| `logMessage(text, type)` | Adds entry to the message console |
| `toggleSidebar()` | Toggles sidebar (responsive behavior) |
| `toggleConsole()` | Shows/hides the message console |

### Security Headers

The server sets these security headers:

```javascript
// Iframe embedding policy
res.setHeader('X-Frame-Options', 'SAMEORIGIN');

// Content Security Policy (configurable via environment)
res.setHeader('Content-Security-Policy',
    `default-src 'self'; ` +
    `script-src 'self' 'unsafe-inline'; ` +
    `style-src 'self' 'unsafe-inline'; ` +
    `frame-src ${FRAME_ORIGINS.join(' ')}; ` +
    `connect-src 'self' ${CONNECT_ORIGINS.join(' ')}; ` +
    `img-src 'self' data: https:;`
);

// Additional security
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-XSS-Protection', '1; mode=block');
res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
```

### Adding Custom Features

To extend the integration:

1. **New iframe actions**: Add handler in `processMessage()` method
2. **New API endpoints**: Add routes in `server.js`
3. **UI modifications**: Edit `index.html` and `styles.css`

### Push Notifications (OneSignal)

The app includes OneSignal SDK integration. Configure in `index.html`:

```javascript
OneSignalDeferred.push(async function (OneSignal) {
    await OneSignal.init({
        appId: "[your-onesignal-app-id]",
    });
});
```

---

## 📡 Message Communication Reference

### Host App → Iframe (Actions)

| Action | Payload | Description |
|--------|---------|-------------|
| `login` | `{ action: "login", data: { token: "..." } }` | Authenticate user |
| `logout` | `{ action: "logout" }` | Log out user |
| `ack` | `{ type: "ack", receivedType: "..." }` | Acknowledge receipt |

### Iframe → Host App (Events)

| Type | Action | Status | Description |
|------|--------|--------|-------------|
| `EMBED_READY` | - | - | Iframe loaded and ready |
| `embed-login` | `login` | `init` | Login started |
| `embed-login` | `login` | `success` | Login successful |
| `embed-login` | `login` | `error` | Login failed |
| `embed-login` | `logout` | `init` | Logout started |
| `embed-login` | `logout` | `success` | Logout successful |
| `embed-login` | `logout` | `error` | Logout failed |

---

## 🔬 Reference: Iframe Internal Logic

This is the reference implementation running inside the WhatsBox iframe:

**Sending Messages (Iframe → Host):**
```typescript
function postResult(payload: Record<string, any>) {
    window.parent.postMessage({ type: "embed-login", ...payload }, "*");
}

async function loginEmbed(token: string) {
    try {
        await signInWithCustomToken($auth, token);
        postResult({ action: "login", status: "success" });
    } catch (err: any) {
        postResult({ action: "login", status: "error", message: err.message });
    }
}

async function logoutEmbed() {
    try {
        await $auth.signOut();
        postResult({ action: "logout", status: "success" });
    } catch (err: any) {
        postResult({ action: "logout", status: "error", message: err.message });
    }
}
```

**Receiving Messages (Host → Iframe):**
```typescript
async function postMessagesListener(event: MessageEvent) {
    try {
        const { action, data } = JSON.parse(event.data);
        if (action === "logout") {
            postResult({ action: "logout", status: "init" });
            await logoutEmbed();
        } else if (action === "login" && data.token) {
            postResult({ action: "login", status: "init" });
            await loginEmbed(data.token);
        }
    } catch (e) {
        postResult({ action: "login", status: "error", message: "invalid-message" });
    }
}

function startPostMessageListener() {
    window.addEventListener("message", postMessagesListener);
    window.parent.postMessage({ type: "EMBED_READY" }, "*");
}
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
