(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const canvas = $('signCanvas');
    const ctx = canvas.getContext('2d');
    const stage = $('canvasStage');
    const textInput = $('textInput');
    const controls = {
        character: $('characterSelect'), font: $('fontSelect'), color: $('colorPicker'),
        size: $('fontSizeSlider'), background: $('bgSelect'), sign: $('signSelect'), bubble: $('bubbleSelect')
    };
    const exportButtons = [$('downloadBtn'), $('shareBtn'), $('copyBtn')];
    const STORAGE_KEY = 'sign-studio-draft-v1';
    const defaults = {
        character: 'deacon-al', message: '', font: 'Arial',
        color: '#202820', size: '1', background: 'white', sign: 'white', bubble: 'big'
    };
    const imagePaths = {
        'deacon-al': {
            white_white: 'man_white_bg_white_sign.png',
            white_cardboard: 'man_white_bg_cardboard_sign.png',
            transparent_white: 'man_transparent_bg_white_sign.png',
            transparent_cardboard: 'man_transparent_bg_cardboard_sign.png'
        },
        brina: {
            white_big: 'notdcnal/bigbubblewhitebg.png',
            white_small: 'notdcnal/smallbubblewhitebg.png',
            transparent_big: 'notdcnal/bigbubbletransbg.png',
            transparent_small: 'notdcnal/smallbubbletransbg.png'
        }
    };
    // Safe text areas, measured from the original artwork. Keep text clear of hands and borders.
    const textAreas = {
        'deacon-al': {
            white: { x: .495, y: .348, width: .30, height: .14, font: .045 },
            cardboard: { x: .49, y: .354, width: .31, height: .16, font: .045 }
        },
        brina: {
            big: { x: .713, y: .40, width: .44, height: .61, font: .065 },
            small: { x: .713, y: .214, width: .44, height: .29, font: .055 }
        }
    };
    const graphemeSegmenter = typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    let currentImage = null;
    let loading = true;
    let exporting = false;
    let loadVersion = 0;
    let renderFrame = 0;
    let saveTimer;
    let toastTimer;
    let previewUrl;
    const imageCache = new Map();

    function restoreDraft() {
        let draft = {};
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (stored && typeof stored === 'object') draft = stored;
        } catch (_) { /* Private browsing or a damaged draft must not block the editor. */ }
        for (const [key, control] of Object.entries(controls)) {
            const value = draft[key];
            if (control.tagName === 'SELECT') {
                control.value = Array.from(control.options).some((option) => option.value === value)
                    ? value : defaults[key];
            } else if (key === 'color') {
                control.value = typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : defaults.color;
            } else {
                control.value = typeof value === 'string' && value.trim() && Number.isFinite(Number(value))
                    ? String(Math.min(2, Math.max(.5, Number(value)))) : defaults.size;
            }
        }
        textInput.value = typeof draft.message === 'string' ? draft.message.slice(0, 500) : defaults.message;
        const selectedCharacter = new URLSearchParams(window.location.search).get('character');
        if (Object.hasOwn(imagePaths, selectedCharacter)) controls.character.value = selectedCharacter;
    }

    function persistDraft() {
        clearTimeout(saveTimer);
        try {
            const draft = { message: textInput.value };
            for (const [key, control] of Object.entries(controls)) draft[key] = control.value;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        } catch (_) { /* Editing and exports still work when storage is unavailable. */ }
    }

    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(persistDraft, 200);
    }

    function syncControls() {
        const isBrina = controls.character.value === 'brina';
        $('signGroup').hidden = isBrina;
        $('bubbleGroup').hidden = !isBrina;
        stage.dataset.character = controls.character.value;
        stage.classList.toggle('is-transparent', controls.background.value === 'transparent');
        $('fontSizeValue').value = `${Math.round(Number(controls.size.value) * 100)}%`;
        controls.size.setAttribute('aria-valuetext', `${Math.round(Number(controls.size.value) * 100)} percent, automatically fitted`);
        $('characterCount').textContent = `${textInput.value.length} / 500`;
        $('clearBtn').disabled = !textInput.value;
    }

    function setExportAvailability() {
        for (const button of exportButtons) button.disabled = loading || exporting || !currentImage;
        $('expandBtn').disabled = loading || exporting || !currentImage;
    }

    function getImage(path) {
        if (!imageCache.has(path)) {
            const promise = new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Image unavailable'));
                img.src = path;
            });
            imageCache.set(path, promise);
            promise.catch(() => imageCache.delete(path));
        }
        return imageCache.get(path);
    }

    async function updateImageSource() {
        const version = ++loadVersion;
        const character = controls.character.value;
        const variant = character === 'brina' ? controls.bubble.value : controls.sign.value;
        const path = imagePaths[character][`${controls.background.value}_${variant}`];
        loading = true;
        syncControls();
        stage.classList.remove('has-error', 'is-switching');
        stage.setAttribute('aria-busy', 'true');
        $('previewStatus').hidden = false;
        $('previewStatus').textContent = 'Loading preview…';
        $('retryBtn').hidden = true;
        setExportAvailability();
        try {
            const img = await getImage(path);
            if (version !== loadVersion) return;
            currentImage = img;
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            loading = false;
            stage.setAttribute('aria-busy', 'false');
            $('previewStatus').hidden = true;
            renderCanvas();
            stage.classList.add('is-switching');
        } catch (_) {
            if (version !== loadVersion) return;
            loading = false;
            currentImage = null;
            stage.setAttribute('aria-busy', 'false');
            stage.classList.add('has-error');
            $('previewStatus').textContent = 'The image couldn’t load. Please try again.';
            $('retryBtn').hidden = false;
            canvas.setAttribute('aria-label', 'Preview unavailable. Use Try again to reload the image.');
        }
        setExportAvailability();
    }

    function splitCharacters(word) {
        return graphemeSegmenter
            ? Array.from(graphemeSegmenter.segment(word), (part) => part.segment) : Array.from(word);
    }

    function wrapLines(text, maxWidth) {
        const lines = [];
        for (const paragraph of text.split('\n')) {
            if (!paragraph.trim()) { lines.push(''); continue; }
            let line = '';
            for (const word of paragraph.trim().split(/\s+/u)) {
                const candidate = line ? `${line} ${word}` : word;
                if (ctx.measureText(candidate).width <= maxWidth) { line = candidate; continue; }
                if (line) { lines.push(line); line = ''; }
                if (ctx.measureText(word).width <= maxWidth) { line = word; continue; }
                // Wrap URLs and other unbroken words, including emoji, without spilling off the sign.
                for (const character of splitCharacters(word)) {
                    if (line && ctx.measureText(line + character).width > maxWidth) {
                        lines.push(line);
                        line = character;
                    } else line += character;
                }
            }
            lines.push(line);
        }
        return lines;
    }

    function fitText(text, area) {
        const maxWidth = canvas.width * area.width;
        const maxHeight = canvas.height * area.height;
        const desiredSize = canvas.height * area.font * Number(controls.size.value);
        const measure = (size) => {
            ctx.font = `700 ${size}px "${controls.font.value}", sans-serif`;
            const lines = wrapLines(text, maxWidth);
            const lineHeight = size * 1.2;
            const fitsInk = lines.every((line, index) => {
                const metrics = ctx.measureText(line);
                const y = (index - (lines.length - 1) / 2) * lineHeight;
                return metrics.width <= maxWidth
                    && metrics.actualBoundingBoxLeft <= maxWidth / 2
                    && metrics.actualBoundingBoxRight <= maxWidth / 2
                    && y - metrics.actualBoundingBoxAscent >= -maxHeight / 2
                    && y + metrics.actualBoundingBoxDescent <= maxHeight / 2;
            });
            return { size, lines, lineHeight, fits: lines.length * lineHeight <= maxHeight
                && fitsInk };
        };
        let layout = measure(desiredSize);
        if (layout.fits) return layout;
        let low = .1;
        let high = desiredSize;
        for (let i = 0; i < 13; i++) {
            const middle = (low + high) / 2;
            const attempt = measure(middle);
            if (attempt.fits) low = middle;
            else high = middle;
        }
        return measure(low);
    }

    function renderCanvas() {
        if (loading || !currentImage) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(currentImage, 0, 0);
        const text = textInput.value.trim();
        const characterName = controls.character.value === 'brina' ? 'Brina’s speech bubble' : 'Deacon Al’s sign';
        canvas.setAttribute('aria-label', text ? `${characterName}: ${text}` : `${characterName}, blank`);
        $('messageHint').textContent = '';
        if (!text) return;
        const variant = controls.character.value === 'brina' ? controls.bubble.value : controls.sign.value;
        const area = textAreas[controls.character.value][variant];
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const layout = fitText(text, area);
        ctx.font = `700 ${layout.size}px "${controls.font.value}", sans-serif`;
        ctx.fillStyle = controls.color.value;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const startY = canvas.height * area.y - (layout.lines.length - 1) * layout.lineHeight / 2;
        layout.lines.forEach((line, index) => ctx.fillText(line, canvas.width * area.x, startY + index * layout.lineHeight));
        if (layout.size < canvas.height * .016) $('messageHint').textContent = 'A shorter message will be easier to read.';
    }

    function updateText() {
        syncControls();
        cancelAnimationFrame(renderFrame);
        renderFrame = requestAnimationFrame(renderCanvas);
        scheduleSave();
    }

    function toast(message) {
        clearTimeout(toastTimer);
        $('toast').textContent = message;
        $('toast').classList.add('is-visible');
        toastTimer = setTimeout(() => $('toast').classList.remove('is-visible'), 4000);
    }

    function imageBlob() {
        // Flush any queued input paint so exports always match the latest message.
        renderCanvas();
        return new Promise((resolve, reject) => canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Could not create image'));
        }, 'image/png'));
    }

    function filename() {
        const variant = controls.character.value === 'brina' ? controls.bubble.value : controls.sign.value;
        return `${controls.character.value}-${variant}-${controls.background.value}.png`;
    }

    function downloadBlob(blob, name) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.append(link);
        link.click();
        link.remove();
        // Keep the URL alive long enough for mobile Safari to finish the download.
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    async function runExport(action) {
        if (loading || exporting || !currentImage) return;
        exporting = true;
        setExportAvailability();
        try { await action(); }
        catch (_) { toast('That didn’t work. Please try Save image again.'); }
        finally { exporting = false; setExportAvailability(); }
    }

    textInput.addEventListener('input', updateText);
    for (const key of ['font', 'color', 'size']) controls[key].addEventListener('input', updateText);
    for (const key of ['character', 'background', 'sign', 'bubble']) {
        controls[key].addEventListener('change', () => {
            if (key === 'character') {
                const url = new URL(window.location.href);
                url.searchParams.set('character', controls.character.value);
                try { history.replaceState(null, '', url); } catch (_) { /* file:// preview */ }
            }
            persistDraft();
            updateImageSource();
        });
    }
    $('clearBtn').addEventListener('click', () => {
        textInput.value = '';
        textInput.focus();
        updateText();
    });
    $('resetStyleBtn').addEventListener('click', () => {
        for (const key of ['font', 'color', 'size', 'background', 'sign', 'bubble']) controls[key].value = defaults[key];
        persistDraft();
        updateImageSource();
        toast('Style reset.');
    });
    $('retryBtn').addEventListener('click', updateImageSource);
    window.addEventListener('pagehide', persistDraft);
    document.addEventListener('visibilitychange', () => { if (document.hidden) persistDraft(); });

    $('downloadBtn').addEventListener('click', () => runExport(async () => {
        const name = filename();
        downloadBlob(await imageBlob(), name);
        toast('Image downloaded.');
    }));

    // Only offer file sharing when supported; sharing a page URL would lose the creation.
    let canShareImage = false;
    try {
        canShareImage = typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
            && navigator.canShare({ files: [new File([''], 'sign.png', { type: 'image/png' })] });
    } catch (_) { /* File sharing is unavailable in this browser. */ }
    $('shareBtn').hidden = !canShareImage;
    const canCopyImage = !!(window.isSecureContext && navigator.clipboard?.write && window.ClipboardItem
        && (typeof ClipboardItem.supports !== 'function' || ClipboardItem.supports('image/png')));
    $('copyBtn').hidden = !canCopyImage;

    $('shareBtn').addEventListener('click', () => runExport(async () => {
        const name = filename();
        const file = new File([await imageBlob()], name, { type: 'image/png' });
        try { await navigator.share({ files: [file] }); }
        catch (error) {
            if (error.name === 'AbortError') return;
            // If a browser rejects the share, keep the finished image one tap away.
            downloadBlob(file, name);
            toast('Sharing wasn’t available, so your image was downloaded.');
        }
    }));
    $('copyBtn').addEventListener('click', () => runExport(async () => {
        try {
            // Passing the promise immediately preserves Safari’s user activation.
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': imageBlob() })]);
            toast('Image copied.');
        } catch (_) { toast('Copy isn’t available here. Use Save image instead.'); }
    }));

    const dialog = $('previewDialog');
    $('expandBtn').addEventListener('click', async () => {
        if (loading || !currentImage) return;
        try {
            const blob = await imageBlob();
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = URL.createObjectURL(blob);
            $('fullPreview').src = previewUrl;
            $('fullPreview').alt = canvas.getAttribute('aria-label');
            document.querySelector('.dialog-image-wrap').classList.toggle('is-transparent', controls.background.value === 'transparent');
            dialog.showModal();
        } catch (_) { toast('The preview couldn’t open. Please try again.'); }
    });
    $('closePreviewBtn').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    });

    restoreDraft();
    syncControls();
    updateImageSource();
})();
