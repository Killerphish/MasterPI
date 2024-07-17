import { fetchStatus, updateTargetTemp } from './api.js';

document.addEventListener("DOMContentLoaded", function() {
    function updateStatus() {
        fetchStatus()
            .then(data => {
                const currentTempElement = document.getElementById('current-temp');
                const fanStatusElement = document.getElementById('fan-status');

                if (currentTempElement) {
                    currentTempElement.textContent = data.temperature.toFixed(2) + ' °C';
                } else {
                    console.error('Element with id "current-temp" not found.');
                }

                if (fanStatusElement) {
                    fanStatusElement.textContent = data.fan_on ? 'On' : 'Off';
                } else {
                    console.error('Element with id "fan-status" not found.');
                }
            })
            .catch(error => {
                console.error('Error fetching status:', error);
            });
    }

    document.getElementById('target-temp').addEventListener('change', function() {
        const targetTemp = this.value;
        updateTargetTemp(targetTemp)
            .then(data => {
                console.log('Success:', data);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    });

    // Initial fetch and interval for fetching status
    updateStatus(); // Initial fetch
    setInterval(updateStatus, 5000); // Fetch status every 5 seconds
});