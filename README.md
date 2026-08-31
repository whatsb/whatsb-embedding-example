# WhatsBox Embed Starter Kit

A starter kit demonstrating how to white-label and embed the **WhatsBox** chat application into your web application via an `<iframe>` with secure server-side token generation.

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js** (v18+) & **npm**

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Copy `.env.example` to `.env` and set your WhatsBox API credentials:
```bash
cp .env.example .env
```

```dotenv
# WhatsBox API endpoint
WB_API_URL=https://api.whatsbox.io

# Secret API key (from your WhatsBox admin console)
WB_API_KEY=sk.your_api_key_here

# (Optional) Server port (defaults to 7000)
PORT=7000
```

### 4. Run the Application
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```
Open **`http://localhost:7000/embed`** in your browser.

---

## ⚙️ Configuration

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `WB_API_URL` | **Yes** | `https://api.whatsbox.io` | WhatsBox API base URL |
| `WB_API_KEY` | **Yes** | — | Secret API key passed via `x-api-key` header |
| `PORT` | No | `7000` | Port for the Express server (Docker uses `8080`) |
| `FRAME_ORIGINS` | No | — | Optional comma-separated additional CSP `frame-src` origins |

---

## 🧩 Integration Guide

Integrating WhatsBox into your existing application involves three parts:

### 1. Backend Token Generation (`server.js`)
Your backend calls the WhatsBox API using your private `WB_API_KEY` to issue a token for the user:

```javascript
app.post('/get-wa-token', async (req, res) => {
    try {
        const response = await axios.post(`${process.env.WB_API_URL}/auth/generate-auth-token`, {
            email: req.body.email,
            name: req.body.name,
            role: req.body.role // 'Admin' or 'User'
        }, {
            headers: { 'x-api-key': process.env.WB_API_KEY }
        });
        
        res.json(response.data); // { token: "..." }
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate token' });
    }
});
```

### 2. Embed the Iframe (`index.html`)
Add the iframe with media permissions and sandbox configurations:

```html
<iframe 
    id="whatsboxIframe" 
    src="https://app.whatsbox.io/embedded?theme=light" 
    frameborder="0"
    allow="microphone; clipboard-read; clipboard-write"
    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
    style="width: 100%; height: 100%; border: none;">
</iframe>
```
> **Tip:** Use `?theme=light`, `?theme=dark`, or `?theme=auto` in the iframe URL to match your app's theme.

### 3. Authenticate via PostMessage (`app.js`)
Send the authentication token to the embedded iframe:

```javascript
const iframe = document.getElementById('whatsboxIframe');

// 1. Request token from your backend
const { data } = await axios.post('/get-wa-token', {
    email: 'user@example.com',
    name: 'John Doe',
    role: 'User'
});

// 2. Post login token to the iframe
iframe.contentWindow.postMessage(
    JSON.stringify({ action: 'login', data: { token: data.token } }),
    '*'
);

// 3. Logout (when needed)
function logout() {
    iframe.contentWindow.postMessage(JSON.stringify({ action: 'logout' }), '*');
}
```

---

## 📡 Message Protocol

### Host → Iframe (Commands)

| Action | Payload | Purpose |
| :--- | :--- | :--- |
| `login` | `{"action": "login", "data": {"token": "<token>"}}` | Authenticate user into WhatsBox |
| `logout` | `{"action": "logout"}` | Log user out of WhatsBox |

### Iframe → Host (Events)

Listen for messages with `window.addEventListener('message', callback)`:

| Message Payload | Description |
| :--- | :--- |
| `{"type": "EMBED_READY"}` | Iframe has loaded and is ready to accept commands |
| `{"type": "embed-login", "action": "login", "status": "success"}` | Login was successful |
| `{"type": "embed-login", "action": "login", "status": "error"}` | Login failed |
| `{"type": "embed-login", "action": "logout", "status": "success"}` | Logout completed |

---

## 🔔 Push Notifications (Optional)

If you use OneSignal for web push notifications:
1. Create an app in [OneSignal](https://onesignal.com).
2. Set your `appId` in `index.html`:
   ```javascript
   OneSignalDeferred.push(async function (OneSignal) {
       await OneSignal.init({
           appId: "YOUR_ONESIGNAL_APP_ID",
       });
   });
   ```
3. Share your OneSignal App ID & REST API Key with WhatsBox support to enable push notifications for your workspace.
4. When a OneSignal notification arrives or is clicked, its payload data (`additionalData` / notification payload) is automatically forwarded via `postMessage` to the WhatsBox iframe.

---

## 🚀 Deployment

### Docker
```bash
docker build -t whatsbox-embed .
docker run -p 8080:8080 --env-file .env whatsbox-embed
```

### Google Cloud Run
Edit project ID in `deploy.bat` and run:
```bash
./deploy.bat
```

---

## 📂 Project Structure

```
├── server.js          # Express backend (/get-wa-token proxy & static serving)
├── index.html         # Main page with embedded iframe & console
├── app.js             # Vue 3 frontend logic (auth & postMessage)
├── styles.css         # UI styling
├── .env.example       # Environment variables template
├── Dockerfile         # Docker container configuration
└── deploy.bat         # Cloud Run deployment script
```

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
