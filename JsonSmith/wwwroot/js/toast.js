(function () {
    const styles = {
        success: 'border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
        error: 'border-red-500/40 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100',
        warning: 'border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
        info: 'border-indigo-500/40 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100'
    };

    function ensureContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none';
            container.setAttribute('aria-live', 'polite');
            container.setAttribute('aria-atomic', 'true');
            document.body.appendChild(container);
        }
        return container;
    }

    window.showToast = function (message, type = 'info', duration = 4000) {
        const container = ensureContainer();
        const toast = document.createElement('div');
        toast.className = [
            'pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg',
            'transition-all duration-300 translate-x-0 opacity-100',
            styles[type] ?? styles.info
        ].join(' ');
        toast.setAttribute('role', 'alert');
        toast.textContent = message;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('animate-in');
        });

        const dismiss = () => {
            toast.classList.add('opacity-0', 'translate-x-2');
            setTimeout(() => toast.remove(), 300);
        };

        const timeoutId = setTimeout(dismiss, duration);
        toast.addEventListener('click', () => {
            clearTimeout(timeoutId);
            dismiss();
        });
    };
})();
