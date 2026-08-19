const { createApp } = Vue;

createApp({
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
            showConsole: true
        };
    },

    mounted() {
        this.init();
    },

    methods: {
        init() {
            this.iframe = document.getElementById('whatsboxIframe');
            this.setupMessageListener();
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
            if (msg.type === 'embed-login' && msg.action === 'login' && msg.status === 'success') {
                this.hideLoading();
                this.isAuthenticated = true;
                this.logMessage('Login successful', 'received');
                return;
            }

            // Fallbacks for other possible status/type messages
            const msgTypeOrStatus = msg.status || msg.type;
            switch (msgTypeOrStatus) {
                case 'auth_request':
                    this.sendMessage({
                        type: 'user_credentials',
                        credentials: { ...this.userCredentials },
                        timestamp: new Date().toISOString()
                    });
                    break;
                case 'auth_success':
                    this.isAuthenticated = true;
                    this.hideLoading();
                    this.logMessage('Authenticated', 'received');
                    break;
                case 'auth_failure':
                    this.hideLoading();
                    this.logMessage(`Auth failed: ${msg.reason || 'Unknown'}`, 'error');
                    break;
                case 'ready':
                    this.hideLoading();
                    break;
                case 'success':
                    this.hideLoading();
                    this.logMessage('Success', 'received');
                    break;
                case 'error':
                    this.hideLoading();
                    this.logMessage(`Error: ${msg.message || msg.error}`, 'error');
                    break;
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
            const vm=this;
            vm.logMessage(`Load error: ${error ? (error.message || 'Iframe load failed') : 'Unknown error'}`, 'error');
            vm.hideLoading();
        },

        sendMessage(msg) {
            if (this.iframe?.contentWindow) {
                const targetOrigin = this.iframeOrigin || new URL(this.iframe.src).origin;
                this.iframe.contentWindow.postMessage(JSON.stringify(msg), "*");
                this.logMessage(`Sent: ${JSON.stringify(msg)}`, 'sent');
            }
        },

        hideLoading() {
            const vm=this;
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
            const vm=this;
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
            const vm=this;
            vm.showConsole = !vm.showConsole;
        },

        logout() {
            const vm=this;
            vm.sendMessage({ action: 'logout' });
            vm.logMessage('Logout request sent', 'sent');
        }
    }
}).mount('#app');
