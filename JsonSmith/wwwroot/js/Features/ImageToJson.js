document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previewImage = document.getElementById('previewImage');
    const convertBtn = document.getElementById('convertBtn');
    const statusText = document.getElementById('statusText');
    const jsonOutput = document.getElementById('jsonOutput');

    if (!dropZone) return;

    let currentFile = null;

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-indigo-500');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-indigo-500');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-indigo-500');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    function handleFile(file) {
        if (!file) return;

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

    convertBtn.addEventListener('click', async () => {
        if (!currentFile) {
            showToast('Please select an image first.', 'warning');
            return;
        }

        statusText.textContent = 'Uploading...';
        convertBtn.disabled = true;

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
            jsonOutput.textContent = JSON.stringify(result, null, 2);
            statusText.textContent = 'Upload successful!';
            showToast('Image converted to JSON successfully.', 'success');
        } catch (error) {
            console.error(error);
            const message = error.message || 'Error during upload.';
            statusText.textContent = 'Error during upload.';
            jsonOutput.textContent = JSON.stringify({ error: message }, null, 2);
            showToast(message, 'error', 6000);
        } finally {
            convertBtn.disabled = false;
        }
    });
});
