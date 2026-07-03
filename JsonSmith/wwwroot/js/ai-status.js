(function () {
    const POLL_INTERVAL_MS = 30000;
    const HEALTH_URL = '/Home/JsonSmithAIHealth';

    let pollTimer = null;
    let lastStatus = { isOnline: null, message: '' };

    const orbBtn = () => document.getElementById('aiStatusOrbBtn');
    const panel = () => document.getElementById('aiStatusPanel');
    const panelTitle = () => document.getElementById('aiStatusPanelTitle');
    const panelMessage = () => document.getElementById('aiStatusPanelMessage');
    const panelIcon = () => document.getElementById('aiStatusPanelIcon');
    const orbDot = () => document.getElementById('aiStatusOrbDot');
    const orbRing = () => document.getElementById('aiStatusOrbRing');
    const retryBtn = () => document.getElementById('aiStatusRetryBtn');

    function dispatchStatus(status) {
        lastStatus = status;
        window.dispatchEvent(new CustomEvent('jsonsmith-ai-status', { detail: status }));
        updateHomeCards(status);
    }

    function setVisualState(state, message) {
        const btn = orbBtn();
        const dot = orbDot();
        const ring = orbRing();
        const icon = panelIcon();
        if (!btn || !dot || !ring) return;

        btn.classList.remove('ai-float');
        ring.className = 'absolute inset-0 rounded-full border-2 border-transparent';

        if (state === 'checking') {
            btn.classList.add('ai-float');
            ring.classList.add('border-indigo-400', 'animate-ping');
            dot.className = 'absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-400 animate-pulse';
            if (panelTitle()) panelTitle().textContent = 'Checking JsonSmithAI…';
            if (panelMessage()) panelMessage().textContent = message || 'Verifying the AI service is reachable.';
            if (icon) icon.className = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-lg';
            return;
        }

        if (state === 'online') {
            btn.classList.add('ai-float');
            ring.classList.add('border-emerald-400/60');
            dot.className = 'absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]';
            if (panelTitle()) panelTitle().textContent = 'JsonSmithAI is online';
            if (panelMessage()) panelMessage().textContent = message || 'All AI-powered features are available.';
            if (icon) icon.className = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-lg';
            return;
        }

        // offline
        ring.classList.add('border-red-400/60');
        dot.className = 'absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]';
        if (panelTitle()) panelTitle().textContent = 'JsonSmithAI is offline';
        if (panelMessage()) panelMessage().textContent = message || 'AI features are unavailable until the service is back online.';
        if (icon) icon.className = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40 text-lg';
    }

    function updateHomeCards(status) {
        const onlineCard = document.getElementById('homeAiOnlineCard');
        const offlineCard = document.getElementById('homeAiOfflineCard');
        const imageToJsonLink = document.getElementById('homeImageToJsonLink');
        if (!onlineCard && !offlineCard) return;

        if (status.isOnline) {
            onlineCard?.classList.remove('hidden');
            offlineCard?.classList.add('hidden');
            if (imageToJsonLink) {
                imageToJsonLink.classList.remove('pointer-events-none', 'opacity-50');
            }
        } else {
            onlineCard?.classList.add('hidden');
            offlineCard?.classList.remove('hidden');
            if (imageToJsonLink) {
                imageToJsonLink.classList.add('pointer-events-none', 'opacity-50');
            }
        }
    }

    async function checkHealth() {
        setVisualState('checking');

        try {
            const response = await fetch(HEALTH_URL, {
                method: 'GET',
                headers: { accept: 'application/json' },
                cache: 'no-store'
            });

            const data = await response.json();
            const isOnline = Boolean(data.isOnline ?? data.IsOnline);
            const message = data.message ?? data.Message ?? '';

            if (isOnline) {
                setVisualState('online', message);
                dispatchStatus({ isOnline: true, message });
            } else {
                setVisualState('offline', message);
                dispatchStatus({ isOnline: false, message });
            }
        } catch {
            const message = 'Could not reach JsonSmith health endpoint.';
            setVisualState('offline', message);
            dispatchStatus({ isOnline: false, message });
        }
    }

    function togglePanel() {
        const p = panel();
        const btn = orbBtn();
        if (!p || !btn) return;

        const isVisible = p.classList.contains('ai-panel-visible');
        if (isVisible) {
            p.classList.remove('ai-panel-visible');
            btn.setAttribute('aria-expanded', 'false');
        } else {
            p.classList.remove('hidden');
            requestAnimationFrame(() => p.classList.add('ai-panel-visible'));
            btn.setAttribute('aria-expanded', 'true');
        }
    }

    function startPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(checkHealth, POLL_INTERVAL_MS);
    }

    document.addEventListener('DOMContentLoaded', () => {
        orbBtn()?.addEventListener('click', togglePanel);
        retryBtn()?.addEventListener('click', () => checkHealth());
        checkHealth();
        startPolling();
    });

    window.getJsonSmithAIStatus = () => lastStatus;
})();
