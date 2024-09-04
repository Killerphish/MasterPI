import { fetchStatus, updateTargetTemp, fetchTemperatureData } from './api.js';
import { showModal, hideModal } from './modal.js'; // Ensure this import is correct

// Define the getCsrfToken function
function getCsrfToken() {
    const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfTokenMeta) {
        return csrfTokenMeta.getAttribute('content');
    } else {
        console.error('CSRF token not found');
        return '';
    }
}

let tempUnit = 'F'; // Default unit changed to Fahrenheit
let charts = [];

document.addEventListener("DOMContentLoaded", function() {
    function updateStatus() {
        fetchStatus()
            .then(data => {
                console.log('Status data:', data); // Debugging line
                const fanStatusElement = document.getElementById('fan-status');
                const currentTargetTempElement = document.getElementById('current-target-temp');

                if (fanStatusElement) {
                    fanStatusElement.textContent = data.fan_on ? 'On' : 'Off';
                } else {
                    console.error('Element with id "fan-status" not found.');
                }

                if (currentTargetTempElement) {
                    if (data.target_temperature === 0) {
                        currentTargetTempElement.textContent = 'Off';
                    } else {
                        currentTargetTempElement.textContent = `${data.target_temperature} °${tempUnit}`;
                    }
                } else {
                    console.error('Element with id "current-target-temp" not found.');
                }

                // Update probe temperatures
                data.temperatures.forEach((temp, index) => {
                    const probeElement = document.getElementById(`probe-${index}`);
                    if (probeElement) {
                        probeElement.textContent = `${temp} °${tempUnit}`;
                    }
                });
            })
            .catch(error => {
                console.error('Error fetching status:', error);
            });
    }

    // Call updateStatus on page load
    updateStatus();
    // Set interval to update status every 5 seconds
    setInterval(updateStatus, 5000);

    // Initialize charts for each probe
    const probeCharts = document.querySelectorAll('[id^="tempChart-"]');
    probeCharts.forEach((chartElement, index) => {
        const ctx = chartElement.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: `Probe ${index + 1} Temperature (°${tempUnit})`, // Update label to reflect the default unit
                    data: [],
                    borderColor: `hsl(${index * 137.5 % 360}, 70%, 50%)`,
                    borderWidth: 1
                }]
            },
            options: {
                maintainAspectRatio: true,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'minute'
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        charts.push(chart);
    });

    function updateSensorTemperatures() {
        fetch('/get_temperature')
            .then(response => response.json())
            .then(data => {
                const temperatures = data.temperatures;
                temperatures.forEach((temp, index) => {
                    const probeElement = document.getElementById(`probe-${index}`);
                    if (probeElement) {
                        // Format the temperature to two decimal places
                        probeElement.textContent = temp !== null ? `${temp.toFixed(2)} °${tempUnit}` : 'Error reading temperature';
                    }
                });
            })
            .catch(error => {
                console.error('Error fetching temperatures:', error);
            });
    }

    // Initial temperature update
    updateSensorTemperatures();
    setInterval(updateSensorTemperatures, 5000); // Update temperatures every 5 seconds

    M.AutoInit();
    fetch('/get_settings')
        .then(response => response.json())
        .then(settings => {
            const deviceNameElement = document.querySelector('.brand-logo');
            if (deviceNameElement) {
                deviceNameElement.textContent = settings.device.name;
            }

            // Update temperature unit
            tempUnit = settings.units.temperature;

            // Apply personalization settings
            document.documentElement.style.setProperty('--nav-color', settings.personalization.navColor);
            document.documentElement.style.setProperty('--button-color', settings.personalization.buttonColor);
            document.documentElement.style.setProperty('--background-color', settings.personalization.backgroundColor);
        })
        .catch(error => {
            console.error('Error fetching settings:', error);
        });

    // Add event listener for the button to update target temperature
    const updateTempButton = document.getElementById('update-temp-button');
    if (updateTempButton) {
        updateTempButton.addEventListener('click', () => {
            const targetTempInput = document.getElementById('target-temp-input');
            if (targetTempInput) {
                let targetTemp = targetTempInput.value;
                if (targetTemp.toLowerCase() === 'off') {
                    targetTemp = 0;
                } else {
                    targetTemp = parseFloat(targetTemp);
                }
                if (!isNaN(targetTemp)) {
                    updateTargetTemp(targetTemp)
                        .then(response => {
                            console.log('Target temperature updated:', response);
                            updateStatus(); // Update the status immediately after setting the target temperature
                        })
                        .catch(error => {
                            console.error('Error updating target temperature:', error);
                        });
                } else {
                    console.error('Invalid target temperature value');
                }
            } else {
                console.error('Element with id "target-temp-input" not found.');
            }
        });
    } else {
        console.error('Element with id "update-temp-button" not found.');
    }

    // Add event listener for the emergency shutdown button
    const emergencyShutdownButton = document.getElementById('emergency-shutdown-button');
    if (emergencyShutdownButton) {
        emergencyShutdownButton.addEventListener('click', () => {
            console.log('Emergency shutdown button clicked'); // Log button click
            fetch('/emergency_shutdown', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()  // Include CSRF token
                }
            })
            .then(response => {
                console.log('Received response from /emergency_shutdown'); // Log response reception
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                console.log('Emergency shutdown response:', data);
                if (data.status === 'success') {
                    console.log('Emergency shutdown successful.');
                    updateStatus(); // Update the status immediately after emergency shutdown
                } else {
                    console.error('Emergency shutdown failed:', data.message);
                }
            })
            .catch(error => {
                console.error('Error during emergency shutdown:', error);
            });
        });
    } else {
        console.error('Element with id "emergency-shutdown-button" not found.');
    }
});