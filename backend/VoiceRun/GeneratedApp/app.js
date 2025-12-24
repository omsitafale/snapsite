let display = document.getElementById('result');

function appendToDisplay(value) {
    if (display.value === 'Error' || display.value === '0') {
        display.value = value;
    } else {
        display.value += value;
    }
}

function clearDisplay() {
    display.value = '0';
}

function calculate() {
    try {
        display.value = eval(display.value);
    } catch (error) {
        display.value = 'Error';
    }
}

// Initialize display
clearDisplay();