document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('container');

    const palettes = {
        neon: ['#7400B8', '#6930C3', '#5E60CE', '#5390D9', '#4EA8DE', '#48BFE3', '#56CFE1', '#64DFDF', '#72EFDD', '#80FFDB'],
        ocean: ['#03045E', '#023E8A', '#0077B6', '#0096C7', '#00B4D8', '#48CAE4', '#90E0EF', '#ADE8F4', '#CAF0F8'],
        fire: ['#F94144', '#F3722C', '#F8961E', '#F9844A', '#F9C74F', '#90BE6D', '#43AA8B', '#4D908E', '#577590', '#277DA1'],
        rainbow: ['#ef5350', '#f48fb1', '#7e57c2', '#2196f3', '#26c6da', '#4caf50', '#eeff41', '#fdd835', '#ffa726', '#ff7043']
    };

    // --- State Variables ---
    let activePalette = 'neon';
    let drawMode = false;
    let overwriteMode = true;
    let rainbowMode = false;
    let clickMode = false;
    let rainbowColorIndex = 0;
    let lastTouchedSquare = null;

    // --- Get references to all controls ---
    const paletteButtons = document.querySelectorAll('.palette-btn');
    const drawButton = document.getElementById('draw-btn');
    const clearButton = document.getElementById('clear-btn');
    const overwriteButton = document.getElementById('overwrite-btn');
    const rainbowButton = document.getElementById('rainbow-btn');
    const clickButton = document.getElementById('click-btn');
    const sizeSlider = document.getElementById('size-slider');
    const sizeInput = document.getElementById('size-input');
    const trailSlider = document.getElementById('trail-slider');
    const trailInput = document.getElementById('trail-input');

    // --- Event Listeners for Controls ---
    paletteButtons.forEach(button => {
        button.addEventListener('click', () => {
            paletteButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            activePalette = button.dataset.palette;
        });
    });

    drawButton.addEventListener('click', () => {
        drawMode = !drawMode;
        drawButton.classList.toggle('active');
    });

    overwriteButton.addEventListener('click', () => {
        overwriteMode = !overwriteMode;
        overwriteButton.classList.toggle('active');
    });
    
    rainbowButton.addEventListener('click', () => {
        rainbowMode = !rainbowMode;
        rainbowButton.classList.toggle('active');
    });

    clickButton.addEventListener('click', () => {
        clickMode = !clickMode;
        clickButton.classList.toggle('active');
    });

    clearButton.addEventListener('click', () => {
        const squares = document.querySelectorAll('.square');
        squares.forEach(square => {
            removeColor(square);
            delete square.dataset.frozen;
        });
    });

    sizeSlider.addEventListener('input', (e) => {
        const newSize = e.target.value;
        sizeInput.value = newSize;
        generateGrid(newSize);
    });

    sizeInput.addEventListener('change', (e) => {
        let newSize = parseInt(e.target.value);
        if (isNaN(newSize) || newSize < 1) newSize = 1;
        if (newSize > 2000) newSize = 2000;
        e.target.value = newSize;
        sizeSlider.value = newSize;
        generateGrid(newSize);
    });

    trailSlider.addEventListener('input', (e) => {
        const duration = e.target.value;
        trailInput.value = parseFloat(duration).toFixed(1);
        document.documentElement.style.setProperty('--trail-duration', `${duration}s`);
    });

    trailInput.addEventListener('change', (e) => {
        let newDuration = parseFloat(e.target.value);
        if (isNaN(newDuration) || newDuration < 0.1) newDuration = 0.1;
        if (newDuration > 10) newDuration = 10;
        
        e.target.value = newDuration.toFixed(1);
        trailSlider.value = newDuration;
        document.documentElement.style.setProperty('--trail-duration', `${newDuration}s`);
    });

    // --- Touch Event Listeners ---
    container.addEventListener('touchstart', handleTouch, { passive: false });
    container.addEventListener('touchmove', handleTouch, { passive: false });
    container.addEventListener('touchend', () => {
        lastTouchedSquare = null;
    });

    function handleTouch(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);

        if (element && element.classList.contains('square') && element !== lastTouchedSquare) {
            setColor(element);
            lastTouchedSquare = element;
        }
    }
    
    // --- Keyboard Shortcut Listener ---
    window.addEventListener('keydown', (e) => {
        if (document.activeElement === sizeInput || document.activeElement === trailInput) {
            return;
        }
        switch (e.key.toLowerCase()) {
            case 'd': drawButton.click(); break;
            case 'o': overwriteButton.click(); break;
            case 'c': clickButton.click(); break;
            case 'y': clearButton.click(); break;
        }
    });

    // --- Main Functions ---
    function generateGrid(squareCount) {
        container.innerHTML = '';
        for (let i = 0; i < squareCount; i++) {
            const square = document.createElement('div');
            square.classList.add('square');

            square.addEventListener('mouseover', () => setColor(square));
            
            square.addEventListener('mouseout', () => {
                if (square.dataset.frozen === 'true') return;
                if (!drawMode) removeColor(square);
            });

            square.addEventListener('mousedown', (e) => {
                if (drawMode && e.button === 0) {
                     removeColor(square);
                     delete square.dataset.frozen;
                }
            });
            
            square.addEventListener('click', () => {
                if (clickMode) {
                    square.dataset.frozen = 'true';
                }
            });

            container.appendChild(square);
        }
    }
    
    function setColor(element) {
        if (element.dataset.frozen === 'true' && !overwriteMode) {
            return;
        }
        if (element.style.backgroundColor !== '' && element.style.backgroundColor !== 'rgb(29, 29, 29)' && !overwriteMode) {
            return;
        }
        
        const color = rainbowMode ? getNextRainbowColor() : getRandomColor();
        element.style.background = color;
        element.style.boxShadow = `0 0 2px ${color}, 0 0 10px ${color}`;

        if (drawMode) {
            element.dataset.frozen = 'true';
        }
    }

    function removeColor(element) {
        element.style.background = '#1d1d1d';
        element.style.boxShadow = '0 0 2px #000';
    }

    function getRandomColor() {
        const currentColors = palettes[activePalette];
        return currentColors[Math.floor(Math.random() * currentColors.length)];
    }

    function getNextRainbowColor() {
        const color = palettes.rainbow[rainbowColorIndex];
        rainbowColorIndex++;
        if (rainbowColorIndex >= palettes.rainbow.length) {
            rainbowColorIndex = 0;
        }
        return color;
    }

    // --- Initial Setup ---
    function initializeControls() {
        sizeInput.value = sizeSlider.value;
        trailInput.value = parseFloat(trailSlider.value).toFixed(1);
        document.documentElement.style.setProperty('--trail-duration', `${trailSlider.value}s`);
        generateGrid(sizeSlider.value);
    }

    initializeControls();
});