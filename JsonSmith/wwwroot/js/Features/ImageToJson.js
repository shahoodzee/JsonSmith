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

    const singleOutputPanel = document.getElementById('singleOutputPanel');
    const batchOutputPanel = document.getElementById('batchOutputPanel');
    const batchResultsList = document.getElementById('batchResultsList');
    const batchJsonViewer = document.getElementById('batchJsonViewer');
    const mergeAllBtn = document.getElementById('mergeAllBtn');

    let currentFile = null;
    let currentFiles = [];
    let aiOnline = false;
    let lastCopyTimeout = null;
    let batchResults = [];

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
            currentFiles = [];
            fileInput.value = '';
            previewImage.classList.add('hidden');
            previewImage.removeAttribute('src');
            singleOutputPanel?.classList.remove('hidden');
            batchOutputPanel?.classList.add('hidden');
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

    // Prevent the programmatic fileInput.click() from bubbling back up to
    // dropZone and triggering a second file-picker open (closes #2).
    fileInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFiles(e.target.files);
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
            handleFiles(e.dataTransfer.files);
        }
    });

    function handleFile(file) {
        if (!file || !aiOnline) return;
        handleFiles([file]);
    }

    function handleFiles(files) {
        if (!files || !files.length || !aiOnline) return;

        currentFiles = Array.from(files);
        currentFile = currentFiles[0];

        if (currentFiles.length === 1) {
            const reader = new FileReader();
            reader.onload = (event) => {
                previewImage.src = event.target.result;
                previewImage.classList.remove('hidden');
            };
            reader.readAsDataURL(currentFiles[0]);
            statusText.textContent = `Selected: ${currentFiles[0].name}`;
        } else {
            previewImage.classList.add('hidden');
            statusText.textContent = `${currentFiles.length} files selected`;
        }
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

    function showSinglePanel() {
        singleOutputPanel?.classList.remove('hidden');
        batchOutputPanel?.classList.add('hidden');
    }

    function showBatchPanel() {
        singleOutputPanel?.classList.add('hidden');
        batchOutputPanel?.classList.remove('hidden');
    }

    function renderBatchRow(result, index) {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between p-2 rounded';
        row.style.cssText = 'background:var(--bg-2,var(--bg));border:1px solid var(--border)';
        row.innerHTML = `
            <span class="text-xs truncate flex-1" style="color:var(--txt-1);max-width:60%" title="${result.fileName}">${result.fileName}</span>
            <div class="flex items-center gap-2 shrink-0">
                <span class="text-xs" style="color:${result.success ? 'var(--ok,#22c55e)' : 'var(--err)'}">${result.success ? 'OK' : 'Error'}</span>
                ${result.success ? `<button type="button" class="js-btn js-btn-ghost js-btn-sm view-batch-btn" data-index="${index}">View</button>` : ''}
            </div>`;
        return row;
    }

    mergeAllBtn?.addEventListener('click', () => {
        const successData = batchResults.filter(r => r.success).map(r => r.data);
        if (!successData.length) return;
        batchJsonViewer.textContent = JSON.stringify(successData, null, 2);
        batchJsonViewer.classList.remove('hidden');
    });

    convertBtn.addEventListener('click', async () => {
        if (!aiOnline) {
            showToast('JsonSmithAI is offline. Image to JSON is unavailable.', 'error', 6000);
            return;
        }

        if (!currentFiles.length) {
            showToast('Please select an image first.', 'warning');
            return;
        }

        convertBtn.disabled = true;
        setCopyEnabled(false);

        if (currentFiles.length === 1) {
            // Single-file path (unchanged)
            showSinglePanel();
            statusText.textContent = 'Uploading...';

            const formData = new FormData();
            formData.append('file', currentFiles[0]);

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
                convertBtn.disabled = !aiOnline || !currentFiles.length;
            }
        } else {
            // Batch path
            showBatchPanel();
            batchResults = [];
            batchResultsList.innerHTML = '';
            batchJsonViewer.classList.add('hidden');
            mergeAllBtn?.classList.add('hidden');
            statusText.textContent = `Processing ${currentFiles.length} files…`;

            const formData = new FormData();
            currentFiles.forEach(f => formData.append('files', f));

            try {
                const response = await fetch('/Home/UploadImages', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const serverMessage = await readErrorMessage(response);
                    throw new Error(serverMessage ?? `Batch upload failed (${response.status})`);
                }

                batchResults = await response.json();
                batchResultsList.innerHTML = '';
                batchResults.forEach((result, i) => {
                    const row = renderBatchRow(result, i);
                    batchResultsList.appendChild(row);
                });

                // Wire up view buttons
                batchResultsList.querySelectorAll('.view-batch-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const idx = Number(btn.dataset.index);
                        const r = batchResults[idx];
                        if (r?.data) {
                            batchJsonViewer.textContent = JSON.stringify(r.data, null, 2);
                            batchJsonViewer.classList.remove('hidden');
                        }
                    });
                });

                const successCount = batchResults.filter(r => r.success).length;
                statusText.textContent = `${successCount}/${batchResults.length} converted`;
                if (successCount > 1) mergeAllBtn?.classList.remove('hidden');
                showToast(`Batch complete: ${successCount}/${batchResults.length} succeeded.`,
                    successCount === batchResults.length ? 'success' : 'warning');
            } catch (error) {
                console.error(error);
                statusText.textContent = 'Batch error.';
                showToast(error.message || 'Batch upload failed.', 'error', 6000);
            } finally {
                convertBtn.disabled = !aiOnline || !currentFiles.length;
            }
        }
    });
});
