const canvas = document.getElementById('signCanvas');
const ctx = canvas.getContext('2d');

const textInput = document.getElementById('textInput');
const fontSelect = document.getElementById('fontSelect');
const colorPicker = document.getElementById('colorPicker');
const downloadBtn = document.getElementById('downloadBtn');

// --- ALIGNMENT CONFIGURATION ---
// Tweak these percentages (decimals) to perfectly align the text on the sign.
// 0.5 is 50% (the middle). 
const ALIGNMENT_CONFIG = {
    centerX: 0.50,      // X-axis center of the sign (50% of image width)
    centerY: 0.34,      // Y-axis center of the sign (approx 34% down from top)
    maxWidth: 0.40,     // Max width of the text block (40% of image width)
    fontSize: 0.035,    // Font size relative to image height (3.5%)
    lineHeight: 1.2     // Spacing between multiple lines of text
};

const img = new Image();
// Ensure the image file is in the same folder and named exactly like this
img.src = 'Smiling Man holding sign.png'; 

img.onload = () => {
    // Set canvas to the exact pixel dimensions of the uploaded image
    canvas.width = img.width;
    canvas.height = img.height;
    updateCanvas();
};

// Event listeners to redraw when user changes anything
textInput.addEventListener('input', updateCanvas);
fontSelect.addEventListener('change', updateCanvas);
colorPicker.addEventListener('change', updateCanvas);

function updateCanvas() {
    // Clear and draw the base image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const text = textInput.value;
    if (!text) return; // Don't draw anything if input is empty

    // Calculate exact pixel values based on the config percentages
    const x = canvas.width * ALIGNMENT_CONFIG.centerX;
    const y = canvas.height * ALIGNMENT_CONFIG.centerY;
    const maxTextWidth = canvas.width * ALIGNMENT_CONFIG.maxWidth;
    const fontSize = canvas.height * ALIGNMENT_CONFIG.fontSize;

    // Set styling
    ctx.fillStyle = colorPicker.value;
    ctx.font = `bold ${fontSize}px ${fontSelect.value}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw the text with line wrapping
    wrapText(ctx, text, x, y, maxTextWidth, fontSize * ALIGNMENT_CONFIG.lineHeight);
}

// Function to handle multiline text so it doesn't spill off the sign
function wrapText(context, text, x, y, maxWidth, lineHeight) {
    // Split by manual line breaks first
    const paragraphs = text.split('\n'); 
    let lines = [];

    for (let p = 0; p < paragraphs.length; p++) {
        let words = paragraphs[p].split(' ');
        let currentLine = '';

        for (let n = 0; n < words.length; n++) {
            let testLine = currentLine + words[n] + ' ';
            let metrics = context.measureText(testLine);
            let testWidth = metrics.width;

            if (testWidth > maxWidth && n > 0) {
                lines.push(currentLine);
                currentLine = words[n] + ' ';
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);
    }

    // Calculate starting Y position so the whole block of text is vertically centered
    let totalHeight = lines.length * lineHeight;
    let startY = y - (totalHeight / 2) + (lineHeight / 2);

    for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i], x, startY + (i * lineHeight));
    }
}

// Handle the download
downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'custom-sign.png';
    // Convert canvas to a high-res data URL
    link.href = canvas.toDataURL('image/png');
    link.click();
});
