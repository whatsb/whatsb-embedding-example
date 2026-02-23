# WhatsBox White-Label Integration Demo

This project demonstrates how to white-label and embed the WhatsBox application into your own web application using an `<iframe>`. It serves as a reference implementation for handling authentication, message passing, and secure embedding.

## 🚀 Getting Started

### Prerequisites

-   **Node.js** (v14 or higher)
-   **NPM** (Node Package Manager)

### Installation

1.  Clone this repository.

    > ⚠️ A `.gitignore` file has been added to the project. It already excludes `node_modules`, `.env`, and other local artifacts – **do not check your `.env` into source control**.

2.  Install the dependencies:
    ```bash
    npm install
    ```
    > 💡 **Tip:** this project now uses [dotenv](https://www.npmjs.com/package/dotenv) to load configuration from a `.env` file. It will be installed with the other packages above.

3.  Copy the example env file and fill in your own values:
    ```bash
    cp .env.example .env
    # then edit .env and add your API key / URLs
    ```


### Running the Application

1.  Start the development server:
    ```bash
    npm start
    ```
2.  Open your browser and navigate to:
    `http://localhost:7000/embed`

---

## 🧩 Integration Architecture

The integration consists of two main parts:
1.  **Host App (Your Website)**:
    -   Embeds the WhatsBox iframe.
    -   Manages user authentication.
    -   Communicates with the iframe via `postMessage`.
2.  **WhatsBox Iframe**:
    -   The embedded chat interface.
    -   Receives authentication tokens from the Host App.

---

## 🛠️ Implementation Details

### 1. Iframe Configuration

The core of the integration is the `<iframe>` element. It must be configured with specific attributes to function correctly.

**Key Attributes:**
-   `src`: The URL of the WhatsBox embedded application (e.g., `https://app-qa.whatsbox.io/embedded`).
-   `allow`: Permissions required for features like voice notes and copy/paste.
    -   `camera`, `microphone`: For capturing media.
    -   `clipboard-read`, `clipboard-write`: For copying and pasting text.
-   `sandbox`: Security restrictions that allow the iframe to function as an independent app.
    -   `allow-same-origin`: Essential for local storage and cookies.
    -   `allow-scripts`: Required for JavaScript execution.
    -   `allow-forms`: Required for login and message sending.
    -   `allow-popups`: Required for OAuth flows or external links.

```html
<!-- Example from index.html -->
<iframe 
    id="whatsboxIframe" 
    src="https://app-qa.whatsbox.io/embedded" 
    frameborder="0"
    allow="camera; microphone; clipboard-read; clipboard-write"
    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation">
</iframe>
```

### 2. Authentication Flow (API Calls)

The most critical part of the white-label integration is the seamless authentication process. Users log in to *your* system, and your system logs them into WhatsBox automatically without them seeing a second login screen.

#### The Process:

1.  **Iframe Load**: When the iframe loads, it sends an `EMBED_READY` message to the parent window (your app).
2.  **Login Initiation**: Upon receiving `EMBED_READY`, your application should check if the user is authenticated and, if so, automatically initiate the login process.
3.  **Token Generation (Backend)**:
    -   Your frontend receives the request and calls your own backend API (e.g., `/get-wa-token`).
    -   **Your backend** makes a secure server-to-server call to the WhatsBox API using your secret API Key.
    -   WhatsBox returns a temporary session token.
4.  **Login**: Your frontend receives the token and sends it back to the iframe via `postMessage` with the action `login`.

#### Code Example:

**A. Backend (Node.js/Express):**
Securely generate a token. This happens on your server so your API Key is never exposed.

```javascript
// server.js (using env vars)
require('dotenv').config();

app.post('/get-wa-token', async (req, res) => {
    try {
        // Call WhatsBox API to generate a session token for the user
        const tokenEndpoint = `${process.env.WA_API_URL}/auth/generate-auth-token`;
        const response = await axios.post(tokenEndpoint, {
            email: req.body.email,
            name: req.body.name,
            role: req.body.role // Optional: 'Admin' or 'User' (default)
        }, {
            // YOUR SECRET API KEY - Keep this safe on the server!
            headers: { 'x-api-key': process.env.WA_API_KEY }
        });
        res.json(response.data); // Return the token to the frontend
    } catch (error) {
        res.status(500).send('Error generating token');
    }
});
```

**B. Frontend (Client-side JS):**
Listen for requests from the iframe and respond with the token.

```javascript
// app.js

// 1. Listen for messages from the iframe
window.addEventListener('message', (event) => {
    // Verify origin for security in production!
    const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

    if (msg.type === "EMBED_READY") {
        // Iframe is ready, you can now start the login process if the user is authenticated in your app
        fetchTokenAndLogin();
    } else if (msg.type === "embed-login") {
        // Handle login status updates
        console.log(`Action: ${msg.action}, Status: ${msg.status}`);
        if (msg.status === 'error') {
            console.error("Error:", msg.message);
        }
    }
});

async function fetchTokenAndLogin() {
    // 2. Get token from our backend
    const response = await axios.post('/get-wa-token', userCredentials);
    const token = response.data.token;

    // 3. Send token to iframe
    const iframe = document.getElementById('whatsboxIframe');
    iframe.contentWindow.postMessage(
        JSON.stringify({ 
            action: "login", 
            data: { token: token } 
        }), 
        "*" 
    );
}
```

### 3. Message Communication Reference

The communication between the Host App and the Iframe relies on `window.postMessage`.

#### From Host App → Iframe (Actions)

| Action | Payload Structure | Description |
| :--- | :--- | :--- |
| `login` | `{ action: "login", data: { token: "..." } }` | Authenticates the user with the provided token. |
| `logout` | `{ action: "logout" }` | Logs the user out of the embedded session. |

#### From Iframe → Host App (Events)

| Message Type (`type`) | Action (`action`) | Status (`status`) | Description |
| :--- | :--- | :--- | :--- |
| `EMBED_READY` | - | - | Iframe has loaded and listener is bound. |
| `embed-login` | `login` | `init` | Login process has started. |
| `embed-login` | `login` | `success` | Login was successful. |
| `embed-login` | `login` | `error` | Login failed (check `message` property). |
| `embed-login` | `logout` | `init` | Logout process has started. |
| `embed-login` | `logout` | `success` | Logout was successful. |
| `embed-login` | `logout` | `error` | Logout failed (check `message` property). |

---

## 📂 Project Structure

- **`index.html`**: The main entry point containing the iframe and layout.
- **`app.js`**: Client-side logic for message handling and API calls to the local backend.
- **`server.js`**: A Node.js Express server that proxies API requests to WhatsBox and serves the application.
- **`.env` / `.env.example`**: Environment configuration used by `dotenv`.
- **`.gitignore`**: Lists files not to commit (including `.env` & `node_modules`).

---

## 🔬 Reference: Iframe Internal Logic

To better understand what happens inside the iframe, here is the reference implementation of our message listener and sender. This is the code running on the WhatsBox side.

**Sending Messages (Iframe to Host):**
```typescript
function postResult(payload: Record<string, any>) {
    window.parent.postMessage({ type: "embed-login", ...payload }, "*");
}

async function loginEmbed(token: string) {
    try {
        const router = useRouter();
        await signInWithCustomToken($auth, token);
        postResult({ action: "login", status: "success" });
        await router.push("/loggedin");
    } catch (err: any) {
        console.error("Login failed:", err);
        postResult({ action: "login", status: "error", message: err.message });
        return;
    }
}

async function logoutEmbed() {
    try {
        const router = useRouter();
        await $auth.signOut();
        postResult({ action: "logout", status: "success" });
        await router.push("/");
    } catch (err: any) {
        console.error("Logout failed:", err);
        postResult({ action: "logout", status: "error", message: err.message });
        return;
    }
}
```

**Receiving Messages (Host to Iframe):**
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
        console.error("Invalid message format:", e);
        postResult({ action: "login", status: "error", message: "invalid-message" });
    }
}

function startPostMessageListener() {
    console.debug("Binding message listener for embed page");
    window.addEventListener("message", postMessagesListener);
    window.parent.postMessage({ type: "EMBED_READY" }, "*");
}
```
