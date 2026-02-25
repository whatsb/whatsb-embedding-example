const { createApp } = Vue;

createApp({
    data() {
        return {
            iframe: null,
            iframeOrigin: null,
            userCredentials: { email: '', name: '', role: 'User' },
            messages: [],
            messageIdCounter: 0,
            showLoading: true,
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
            this.iframe.addEventListener('error', (e) => this.onIframeError(e));

            // hide mobile drawer when resizing back to desktop width
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768) {
                    this.sidebarVisible = false;
                }
            });

            // Fallback timeout
            setTimeout(() => this.hideLoading(), 10000);
        },

        setupMessageListener() {
            window.addEventListener('message', (event) => this.handleMessage(event));
        },

        handleMessage(event) {
            if (!this.iframeOrigin) this.iframeOrigin = event.origin;

            if (event.data.type == 'EMBED_READY') {
                this.sendMessage({ type: 'ack', receivedType: event.data.type });
            }

            const allowedOrigins = ['https://app-qa.whatsbox.io', 'https://app.whatsbox.io', 'http://localhost:3000'];
            if (!allowedOrigins.some(origin => event.origin.includes(origin.split('//')[1]))) return;

            this.logMessage(`Received: ${JSON.stringify(event.data)}`, 'received');

            try {
                const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                this.processMessage(msg);
            } catch (error) {
                this.logMessage(`Parse error: ${error.message}`, 'error');
            }
        },

        processMessage(msg) {
            switch (msg.status || msg.type) {
                case 'auth_request':
                    this.sendMessage({
                        type: 'user_credentials',
                        credentials: { ...this.userCredentials },
                        timestamp: new Date().toISOString()
                    });
                    break;
                case 'auth_success':
                    this.isAuthenticated = true;
                    this.logMessage('Authenticated', 'received');
                    break;
                case 'auth_failure':
                    this.logMessage(`Auth failed: ${msg.reason || 'Unknown'}`, 'error');
                    break;
                case 'ready':
                    this.hideLoading();
                    break;
                case 'success':
                    this.logMessage('Success', 'received');
                    break;
                case 'error':
                    this.logMessage(`Error: ${msg.message || msg.error}`, 'error');
                    break;
            }
        },

        async loadToken() {
            try {
                const response = await axios.post('/get-wa-token', this.userCredentials);
                this.sendMessage({ action: "login", data: { token: response.data.token } });
            } catch (error) {
                this.logMessage(`Token error: ${error.message}`, 'error');
            }
        },

        onIframeError(error) {
            const vm=this;
            vm.logMessage(`Load error: ${error.message}`, 'error');
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
