export function showModal(modal) {
    modal.style.display = "block";
}

export function hideModal(modal, statusElement) {
    modal.style.display = "none";
    if (statusElement) {
        statusElement.textContent = ''; // Clear status on close
    }
}