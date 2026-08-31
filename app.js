const { createApp } = Vue;

const app = createApp({
    data() {
        return {
            iframe: null,
            iframeOrigin: null,
            userCredentials: { email: '', name: '', role: 'User' },
            messages: [],
            messageIdCounter: 0,
            showLoading: false,
            loadingTimeout: null,
            isAuthenticated: false,
            sidebarCollapsed: false,
            sidebarVisible: false, // used for mobile drawer toggle
            showConsole: true,
            // flag for in-built inbox
            isInboxReady: false,
        };
    },

    mounted() {
        this.init();
    },

    methods: {
        init() {
            this.iframe = document.getElementById('whatsboxIframe');
            this.setupMessageListener();
            this.setupOneSignal();
            if (this.iframe) {
                this.iframe.addEventListener('error', (e) => this.onIframeError(e));
            }

            // hide mobile drawer when resizing back to desktop width
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768) {
                    this.sidebarVisible = false;
                }
            });
        },

        setupMessageListener() {
            window.addEventListener('message', (event) => this.handleMessage(event));
        },

        setupOneSignal() {
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            window.OneSignalDeferred.push((OneSignal) => {
                OneSignal.Notifications.addEventListener('click', (event) => {
                    const additionalData = event.notification?.additionalData;
                    this.handleNotificationClick(additionalData);
                });
            });
        },

        handleNotificationClick(additionalData) {
            if (this.isInboxReady) {
                this.sendMessage({ action: 'open-thread', data: additionalData });
            } else {
                sessionStorage.setItem('onesignalPushData', JSON.stringify(additionalData || {}));
                this.logMessage('Push notification saved to session (inbox not ready yet)', 'info');
            }
        },

        handleMessage(event) {
            if (!this.iframeOrigin && event.origin) this.iframeOrigin = event.origin;

            const allowedOrigins = ['whatsbox.io', 'localhost', '127.0.0.1'];
            if (event.origin && !allowedOrigins.some(origin => event.origin.includes(origin))) return;

            let msg = event.data;
            if (typeof msg === 'string') {
                try {
                    msg = JSON.parse(msg);
                } catch (error) {
                    // Raw string message or parse error
                }
            }

            this.logMessage(`Received: ${typeof msg === 'object' ? JSON.stringify(msg) : msg}`, 'received');

            if (msg) {
                if (typeof msg === 'object' && msg.type === 'EMBED_READY') {
                    this.sendMessage({ type: 'ack', receivedType: msg.type });
                }
                this.processMessage(msg);
            }
        },

        processMessage(msg) {
            if (!msg || typeof msg !== 'object') return;
            // Stop spinner when message {"type":"embed-login","action":"login","status":"success"} is received
            if (msg.action === 'login' && msg.status === 'success') {
                this.hideLoading();
                this.isAuthenticated = true;
                return;
            } else if (msg.action === 'login' && msg.status === 'error') {
                this.hideLoading();
                this.isAuthenticated = false;
                this.isInboxReady = false;
                return;
            } else if (msg.action === 'inbox' && msg.status === 'ready') {
                this.hideLoading();
                this.isInboxReady = true;

                // Check for pending push notification in sessionStorage
                const pendingPushData = sessionStorage.getItem('onesignalPushData');
                console.log(pendingPushData);
                if (pendingPushData) {
                    try {
                        const data = JSON.parse(pendingPushData);
                        this.sendMessage({ action: 'open-thread', data: data });
                    } catch (e) {
                        console.error('Failed to parse pending onesignalPushData', e);
                    }
                    sessionStorage.removeItem('onesignalPushData');
                }
                return;
            }

        },

        async loadToken() {
            this.showLoading = true;

            // Safety timeout in case response message is never received
            if (this.loadingTimeout) clearTimeout(this.loadingTimeout);
            this.loadingTimeout = setTimeout(() => {
                if (this.showLoading) {
                    this.hideLoading();
                    this.logMessage('Loading timed out', 'error');
                }
            }, 15000);

            try {
                const response = await axios.post('/get-wa-token', this.userCredentials);
                this.sendMessage({ action: "login", data: { token: response.data.token } });
            } catch (error) {
                this.logMessage(`Token error: ${error.message}`, 'error');
                this.hideLoading();
            }
        },

        onIframeError(error) {
            const vm = this;
            vm.logMessage(`Load error: ${error ? (error.message || 'Iframe load failed') : 'Unknown error'}`, 'error');
            vm.hideLoading();
        },

        sendMessage(msg) {
            if (this.iframe?.contentWindow) {
                const messageStr = typeof msg === 'object' ? JSON.stringify(msg) : msg;
                this.iframe.contentWindow.postMessage(messageStr, "*");
                this.logMessage(`Sent: ${messageStr}`, 'sent');
            }
        },

        hideLoading() {
            const vm = this;
            if (vm.loadingTimeout) {
                clearTimeout(vm.loadingTimeout);
                vm.loadingTimeout = null;
            }
            vm.showLoading = false;
        },

        logMessage(text, type = 'sent') {
            const timestamp = new Date().toLocaleTimeString();
            this.messages.push({ id: this.messageIdCounter++, text, type, timestamp });
            this.$nextTick(() => {
                const consoleEl = document.getElementById('messageConsole');
                if (consoleEl) consoleEl.scrollTop = consoleEl.scrollHeight;
            });
        },

        clearConsole() {
            this.messages = [];
        },

        toggleSidebar() {
            const vm = this;
            // On small screens the sidebar is a drawer controlled by `sidebarVisible`.
            // On large screens we just collapse the width.
            if (window.innerWidth <= 768) {
                // toggle the drawer visibility rather than always opening it
                vm.sidebarVisible = !vm.sidebarVisible;
                if (vm.sidebarVisible) {
                    // ensure full‑width when visible; avoid conflicting collapsed state
                    vm.sidebarCollapsed = false;
                }
            } else {
                vm.sidebarCollapsed = !vm.sidebarCollapsed;
            }
        },

        toggleConsole() {
            const vm = this;
            vm.showConsole = !vm.showConsole;
        },

        logout() {
            const vm = this;
            vm.sendMessage({ action: 'logout' });
            vm.logMessage('Logout request sent', 'sent');
        }
    }
});

window.app = app.mount('#app');

