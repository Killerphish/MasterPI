export function updateStatus(element, message, color) {
    element.textContent = message;
    element.style.color = color;
    element.style.display = 'block';
}

export function handleFetchError(error, statusElement, message) {
    console.error(message, error);
    if (statusElement) {
        updateStatus(statusElement, message, 'red');
    }
}