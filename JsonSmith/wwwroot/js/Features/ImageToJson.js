document.addEventListener("DOMContentLoaded", () => {

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previewImage = document.getElementById('previewImage');
    const convertBtn = document.getElementById('convertBtn');
    const statusText = document.getElementById('statusText');
    const jsonOutput = document.getElementById('jsonOutput');

    if (!dropZone) return; // safety guard

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('border-indigo-500');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-indigo-500');
    });

    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('border-indigo-500');
        handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', e => {
        handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        if (!file) return;

        previewImage.src = URL.createObjectURL(file);
        previewImage.classList.remove('hidden');

        statusText.textContent = 'Image ready';
        convertBtn.disabled = false;
    }

    convertBtn.addEventListener('click', () => {
        statusText.textContent = 'Processing...';
        convertBtn.disabled = true;

        jsonOutput.textContent = JSON.stringify({
            status: "processing",
            message: "AI model is generating JSON..."
        }, null, 2);

        // Mock AI delay
        setTimeout(() => {
            jsonOutput.textContent = JSON.stringify({
                status: "success",
                detectedObjects: [],
                confidence: "N/A"
            }, null, 2);

            statusText.textContent = 'Done';
        }, 2000);
    });

});
