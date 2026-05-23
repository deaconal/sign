const canvas = document.getElementById('signCanvas');
const ctx = canvas.getContext('2d');

// UI Controls
const textInput = document.getElementById('textInput');
const fontSelect = document.getElementById('fontSelect');
const colorPicker = document.getElementById('colorPicker');
const fontSizeSlider = document.getElementById('fontSizeSlider');
const bgSelect = document.getElementById('bgSelect');
const signSelect = document.getElementById('signSelect');
const downloadBtn = document.getElementById('downloadBtn');

// --- ALIGNMENT CONFIGURATION ---
const ALIGNMENT_CONFIG = {
    centerX: 0.50,      
    centerY: 0.34,      
    maxWidth: 0.40,     
    baseFontSize: 0.035, // Base size (3.5% of image height)
    lineHeight: 1.2     
};

// Image asset combinations mapping
const IMAGE_MAP = {
    'white_white': 'man_white_bg_white_sign.png',
    'white_cardboard': 'man_white_bg_cardboard_sign.png',
    'transparent_white': 'man_transparent_bg_white_sign.png',
    'transparent_cardboard': 'man_transparent_bg_cardboard_sign.png'
};

const img = new Image();

// Function to determine which image to load based on selectors
function updateImageSource() {
    const bgKey = bgSelect.value;     // 'white' or 'transparent'
    const signKey = signSelect.value; // 'white' or 'cardboard'
    const mapKey = `${bgKey}_${signKey}`;
    
    img.src = IMAGE_MAP[mapKey];
}

// When the newly selected image variant finishes loading, redraw everything
img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    updateCanvas();
};

// Event listeners for UI updates
textInput.addEventListener('input', updateCanvas);
fontSelect.addEventListener('change', updateCanvas);
colorPicker.addEventListener('change', updateCanvas);
fontSizeSlider.addEventListener('input', updateCanvas);

// Asset swapping listeners
bgSelect.addEventListener('change', updateImageSource);
signSelect.addEventListener('change', updateImageSource);

function updateCanvas() {
    // Clear and draw the active base image variant
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const text = textInput.value;
    if (!text) return; 

    // Apply the font size slider multiplier to the base size calculation
    const sizeMultiplier = parseFloat(fontSizeSlider.value);
    const fontSize = canvas.height * ALIGNMENT_CONFIG.baseFontSize * sizeMultiplier;

    const x = canvas.width * ALIGNMENT_CONFIG.centerX;
    const y = canvas.height * ALIGNMENT_CONFIG.centerY;
    const maxTextWidth = canvas.width * ALIGNMENT_CONFIG.maxWidth;

    // Set styling
    ctx.fillStyle = colorPicker.value;
    ctx.font = `bold ${fontSize}px ${fontSelect.value}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Wrap and draw text
    wrapText(ctx, text, x, y, maxTextWidth, fontSize * ALIGNMENT_CONFIG.lineHeight);
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
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

    let totalHeight = lines.length * lineHeight;
    let startY = y - (totalHeight / 2) + (lineHeight / 2);

    for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i], x, startY + (i * lineHeight));
    }
}

// Handle image downloading
downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `custom-sign-${signSelect.value}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
});

// Initialize the app with the starting image combination
updateImageSource();
