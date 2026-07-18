document.addEventListener('DOMContentLoaded', () => {
    const workspace = document.getElementById('jsonBuilderWorkspace');
    if (!workspace) return;

    const jsonOutput = document.getElementById('jsonOutput');
    const copyJsonBtn = document.getElementById('copyJsonBtn');
    const copyJsonBtnLabel = document.getElementById('copyJsonBtnLabel');
    const offlineBanner = document.getElementById('aiOfflineBanner');
    const offlineBannerMessage = document.getElementById('aiOfflineBannerMessage');

    const objectName = document.getElementById('objectName');
    const objectTarget = document.getElementById('objectTarget');
    const objectFrequency = document.getElementById('objectFrequency');
    const createObjectBtn = document.getElementById('createObjectBtn');

    const columnName = document.getElementById('columnName');
    const columnType = document.getElementById('columnType');
    const columnValue = document.getElementById('columnValue');
    const columnTarget = document.getElementById('columnTarget');
    const columnFrequency = document.getElementById('columnFrequency');
    const createColumnBtn = document.getElementById('createColumnBtn');
    const columnStatus = document.getElementById('columnStatus');
    const resetJsonBtn = document.getElementById('resetJsonBtn');

    let state = {};
    /** @type {string[]} */
    let objectPaths = [];
    let aiOnline = false;
    let lastCopyTimeout = null;

    function refreshPreview() {
        jsonOutput.textContent = JSON.stringify(state, null, 2);
    }

    function refreshTargetDropdowns() {
        const options = ['<option value="">(root)</option>']
            .concat(objectPaths.map((p) => `<option value="${escapeAttr(p)}">${escapeHtml(p)}</option>`))
            .join('');
        objectTarget.innerHTML = options;
        columnTarget.innerHTML = options;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/'/g, '&#39;');
    }

    function isPlainObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function getAtPath(root, path) {
        if (!path) return root;
        const parts = path.split('.');
        let current = root;
        for (const part of parts) {
            if (Array.isArray(current) && current.length > 0 && current.every(isPlainObject)) {
                if (!current.every((item) => part in item)) {
                    return undefined;
                }
                current = current.map((item) => item[part]);
                continue;
            }
            if (current == null || typeof current !== 'object' || !(part in current)) {
                return undefined;
            }
            current = current[part];
        }
        return current;
    }

    function ensureUniqueKey(container, key) {
        if (Array.isArray(container)) {
            return container.every((item) => !isPlainObject(item) || !(key in item));
        }
        return !(key in container);
    }

    function setProperty(container, key, value) {
        if (Array.isArray(container)) {
            container.forEach((item) => {
                if (isPlainObject(item)) {
                    item[key] = structuredClone(value);
                }
            });
            return;
        }
        container[key] = value;
    }

    function setPropertyFromValues(container, key, values) {
        if (Array.isArray(container)) {
            if (container.length === values.length && container.every(isPlainObject)) {
                container.forEach((item, index) => {
                    item[key] = values[index];
                });
                return;
            }
            // Mismatched lengths: store as array on each object
            container.forEach((item) => {
                if (isPlainObject(item)) {
                    item[key] = structuredClone(values);
                }
            });
            return;
        }

        container[key] = values.length === 1 ? values[0] : values;
    }

    function registerObjectPath(parentPath, key) {
        const full = parentPath ? `${parentPath}.${key}` : key;
        if (!objectPaths.includes(full)) {
            objectPaths.push(full);
            objectPaths.sort();
            refreshTargetDropdowns();
        }
    }

    function setAiOnline(enabled, message) {
        aiOnline = enabled;
        if (enabled) {
            offlineBanner?.classList.add('hidden');
        } else {
            offlineBanner?.classList.remove('hidden');
            if (offlineBannerMessage && message) {
                offlineBannerMessage.textContent = message;
            }
        }
    }

    window.addEventListener('jsonsmith-ai-status', (event) => {
        const { isOnline, message } = event.detail ?? {};
        setAiOnline(Boolean(isOnline), message);
    });

    const cached = window.getJsonSmithAIStatus?.();
    if (cached && cached.isOnline !== null) {
        setAiOnline(cached.isOnline, cached.message);
    }

    createObjectBtn.addEventListener('click', () => {
        const key = (objectName.value || '').trim();
        const frequency = Number(objectFrequency.value) || 1;
        const targetPath = objectTarget.value || '';

        if (!key) {
            showToast?.('Object name is required.', 'error');
            return;
        }
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
            showToast?.('Object name must be a valid identifier.', 'error');
            return;
        }
        if (frequency < 1 || frequency > 50) {
            showToast?.('Frequency must be between 1 and 50.', 'error');
            return;
        }

        const container = getAtPath(state, targetPath);
        if (container === undefined) {
            showToast?.('Target path not found.', 'error');
            return;
        }
        if (!isPlainObject(container) && !Array.isArray(container)) {
            showToast?.('Target must be an object or object array.', 'error');
            return;
        }
        if (!ensureUniqueKey(container, key)) {
            showToast?.(`Key "${key}" already exists at target.`, 'error');
            return;
        }

        const value = frequency === 1
            ? {}
            : Array.from({ length: frequency }, () => ({}));

        setProperty(container, key, value);
        registerObjectPath(targetPath, key);
        objectName.value = '';
        objectFrequency.value = '1';
        refreshPreview();
        showToast?.(`Object "${key}" created.`, 'success');
    });

    createColumnBtn.addEventListener('click', async () => {
        const key = (columnName.value || '').trim();
        const type = columnType.value;
        const frequency = Number(columnFrequency.value) || 1;
        const targetPath = columnTarget.value || '';
        const rawValue = columnValue.value;

        if (!key) {
            showToast?.('Column name is required.', 'error');
            return;
        }
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
            showToast?.('Column name must be a valid identifier.', 'error');
            return;
        }
        if (frequency < 1 || frequency > 50) {
            showToast?.('Frequency must be between 1 and 50.', 'error');
            return;
        }

        let seed;
        if (type === 'int') {
            const parsed = Number.parseInt(rawValue, 10);
            if (Number.isNaN(parsed)) {
                showToast?.('Value must be a valid integer.', 'error');
                return;
            }
            seed = parsed;
        } else {
            seed = rawValue;
        }

        const container = getAtPath(state, targetPath);
        if (container === undefined) {
            showToast?.('Target path not found.', 'error');
            return;
        }
        if (!isPlainObject(container) && !Array.isArray(container)) {
            showToast?.('Target must be an object or object array.', 'error');
            return;
        }
        if (!ensureUniqueKey(container, key)) {
            showToast?.(`Key "${key}" already exists at target.`, 'error');
            return;
        }

        if (frequency > 1 && !aiOnline) {
            showToast?.('JsonSmithAI is offline. Frequency > 1 requires AI samples.', 'error');
            return;
        }

        createColumnBtn.disabled = true;
        columnStatus.textContent = frequency > 1 ? 'Generating unique samples…' : '';

        try {
            let values;
            if (frequency === 1) {
                values = [seed];
            } else {
                const response = await fetch('/Home/GenerateSamples', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        key,
                        type,
                        seed,
                        frequency
                    })
                });

                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload.message || payload.detail || 'Failed to generate samples.');
                }
                if (!Array.isArray(payload.values) || payload.values.length === 0) {
                    throw new Error('AI returned no sample values.');
                }
                values = payload.values;
            }

            if (Array.isArray(container) && container.every(isPlainObject)) {
                if (frequency === 1) {
                    setProperty(container, key, seed);
                } else if (values.length >= container.length) {
                    setPropertyFromValues(container, key, values.slice(0, container.length));
                } else {
                    setProperty(container, key, values);
                }
            } else {
                setPropertyFromValues(container, key, values);
            }

            columnName.value = '';
            columnValue.value = '';
            columnFrequency.value = '1';
            refreshPreview();
            showToast?.(`Column "${key}" created.`, 'success');
        } catch (err) {
            showToast?.(err.message || 'Failed to create column.', 'error');
        } finally {
            createColumnBtn.disabled = false;
            columnStatus.textContent = '';
        }
    });

    resetJsonBtn.addEventListener('click', () => {
        state = {};
        objectPaths = [];
        refreshTargetDropdowns();
        refreshPreview();
        showToast?.('JSON reset to {}.', 'success');
    });

    copyJsonBtn.addEventListener('click', async () => {
        const text = jsonOutput.textContent || '{}';
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            copyJsonBtnLabel.textContent = 'Copied';
            if (lastCopyTimeout) clearTimeout(lastCopyTimeout);
            lastCopyTimeout = setTimeout(() => {
                copyJsonBtnLabel.textContent = 'Copy';
            }, 1500);
            showToast?.('JSON copied to clipboard.', 'success');
        } catch {
            showToast?.('Could not copy JSON.', 'error');
        }
    });

    refreshTargetDropdowns();
    refreshPreview();
});
