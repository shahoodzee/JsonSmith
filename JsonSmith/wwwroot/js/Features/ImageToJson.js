document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previewImage = document.getElementById('previewImage');
    const convertBtn = document.getElementById('convertBtn');
    const statusText = document.getElementById('statusText');
    const jsonOutput = document.getElementById('jsonOutput');
    const copyJsonBtn = document.getElementById('copyJsonBtn');
    const copyJsonBtnLabel = document.getElementById('copyJsonBtnLabel');
    const offlineBanner = document.getElementById('aiOfflineBanner');
    const offlineBannerMessage = document.getElementById('aiOfflineBannerMessage');
    const workspace = document.getElementById('imageToJsonWorkspace');

    if (!dropZone) return;

    let currentFile = null;
    let aiOnline = false;
    let lastCopyTimeout = null;

    const IDLE_JSON = '{\n  "status": "idle",\n  "message": "Upload an image to start"\n}';
    const OFFLINE_JSON = '{\n  "status": "unavailable",\n  "message": "JsonSmithAI is offline. Start the FastAPI service and try again."\n}';

    function setCopyEnabled(enabled) {
        if (copyJsonBtn) copyJsonBtn.disabled = !enabled;
    }

    function setJsonOutput(text, allowCopy) {
        jsonOutput.textContent = text;
        setCopyEnabled(allowCopy);
    }

    function setFeatureEnabled(enabled, message) {
        aiOnline = enabled;

        if (enabled) {
            offlineBanner?.classList.add('hidden');
            workspace?.classList.remove('opacity-50', 'pointer-events-none');
            dropZone.classList.remove('opacity-60', 'pointer-events-none', 'cursor-not-allowed');
            dropZone.classList.add('cursor-pointer');
            if (!currentFile) {
                convertBtn.disabled = true;
                statusText.textContent = message || 'Waiting for image';
            } else {
                convertBtn.disabled = false;
                statusText.textContent = message || `Selected: ${currentFile.name}`;
            }
            if (jsonOutput.textContent === OFFLINE_JSON) {
                setJsonOutput(IDLE_JSON, false);
            }
        } else {
            offlineBanner?.classList.remove('hidden');
            if (offlineBannerMessage && message) {
                offlineBannerMessage.textContent = message;
            }
            workspace?.classList.add('opacity-50', 'pointer-events-none');
            dropZone.classList.add('opacity-60', 'pointer-events-none', 'cursor-not-allowed');
            dropZone.classList.remove('cursor-pointer');
            convertBtn.disabled = true;
            statusText.textContent = 'AI service unavailable';
            setJsonOutput(OFFLINE_JSON, false);
            currentFile = null;
            fileInput.value = '';
            previewImage.classList.add('hidden');
            previewImage.removeAttribute('src');
        }
    }

    window.addEventListener('jsonsmith-ai-status', (event) => {
        const { isOnline, message } = event.detail ?? {};
        setFeatureEnabled(Boolean(isOnline), message);
    });

    const cached = window.getJsonSmithAIStatus?.();
    if (cached && cached.isOnline !== null) {
        setFeatureEnabled(cached.isOnline, cached.message);
    }

    dropZone.addEventListener('click', () => {
        if (aiOnline) fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        if (!aiOnline) return;
        e.preventDefault();
        dropZone.classList.add('border-indigo-500');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-indigo-500');
    });

    dropZone.addEventListener('drop', (e) => {
        if (!aiOnline) return;
        e.preventDefault();
        dropZone.classList.remove('border-indigo-500');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    function handleFile(file) {
        if (!file || !aiOnline) return;

        currentFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            previewImage.src = event.target.result;
            previewImage.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
        statusText.textContent = `Selected: ${file.name}`;
        convertBtn.disabled = false;
    }

    async function readErrorMessage(response) {
        try {
            const data = await response.json();
            return data.message ?? data.error ?? data.title ?? null;
        } catch {
            return null;
        }
    }

    async function copyToClipboard(text) {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    copyJsonBtn?.addEventListener('click', async () => {
        const text = jsonOutput.textContent?.trim();
        if (!text || copyJsonBtn.disabled) return;

        try {
            await copyToClipboard(text);
            if (copyJsonBtnLabel) copyJsonBtnLabel.textContent = 'Copied!';
            showToast('JSON copied to clipboard.', 'success');
            if (lastCopyTimeout) clearTimeout(lastCopyTimeout);
            lastCopyTimeout = setTimeout(() => {
                if (copyJsonBtnLabel) copyJsonBtnLabel.textContent = 'Copy';
            }, 2000);
        } catch {
            showToast('Could not copy to clipboard.', 'error');
        }
    });

    convertBtn.addEventListener('click', async () => {
        if (!aiOnline) {
            showToast('JsonSmithAI is offline. Image to JSON is unavailable.', 'error', 6000);
            return;
        }

        if (!currentFile) {
            showToast('Please select an image first.', 'warning');
            return;
        }

        statusText.textContent = 'Uploading...';
        convertBtn.disabled = true;
        setCopyEnabled(false);

        const formData = new FormData();
        formData.append('file', currentFile);

        try {
            const response = await fetch('/Home/UploadImage', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const serverMessage = await readErrorMessage(response);
                throw new Error(serverMessage ?? `Upload failed (${response.status})`);
            }

            const result = await response.json();
            setJsonOutput(JSON.stringify(result, null, 2), true);
            statusText.textContent = 'Conversion successful!';
            showToast('Image converted to JSON successfully.', 'success');
        } catch (error) {
            console.error(error);
            const message = error.message || 'Error during upload.';
            statusText.textContent = 'Error during conversion.';
            setJsonOutput(JSON.stringify({ error: message }, null, 2), true);
            showToast(message, 'error', 6000);
        } finally {
            if (aiOnline) convertBtn.disabled = false;
        }
    });
});
