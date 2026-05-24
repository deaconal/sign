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
    baseFontSize: 0.035, 
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

function updateImageSource() {
    const bgKey = bgSelect.value;     
    const signKey = signSelect.value; 
    const mapKey = `${bgKey}_${signKey}`;
    
    img.src = IMAGE_MAP[mapKey];
}

img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    updateCanvas();
};

textInput.addEventListener('input', updateCanvas);
fontSelect.addEventListener('change', updateCanvas);
colorPicker.addEventListener('change', updateCanvas);
fontSizeSlider.addEventListener('input', updateCanvas);

bgSelect.addEventListener('change', updateImageSource);
signSelect.addEventListener('change', updateImageSource);

function updateCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // .trim() removes the leading and trailing spaces that ruin the centering
    const text = textInput.value.trim();
    if (!text) return; 

    const sizeMultiplier = parseFloat(fontSizeSlider.value);
    const fontSize = canvas.height * ALIGNMENT_CONFIG.baseFontSize * sizeMultiplier;

    const x = canvas.width * ALIGNMENT_CONFIG.centerX;
    const y = canvas.height * ALIGNMENT_CONFIG.centerY;
    const maxTextWidth = canvas.width * ALIGNMENT_CONFIG.maxWidth;

    ctx.fillStyle = colorPicker.value;
    ctx.font = `bold ${fontSize}px ${fontSelect.value}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

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
                lines.push(currentLine.trim()); // Trim individual lines too
                currentLine = words[n] + ' ';
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine.trim());
    }

    let totalHeight = lines.length * lineHeight;
    let startY = y - (totalHeight / 2) + (lineHeight / 2);

    for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i], x, startY + (i * lineHeight));
    }
}

downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `custom-sign-${signSelect.value}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
});

updateImageSource();
