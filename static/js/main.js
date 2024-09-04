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

document.addEventListener("DOMContentLoaded", function() {
    function updateStatus() {
        fetchStatus()
            .then(data => {
                console.log('Status data:', data); // Debugging line
                const fanStatusElement = document.getElementById('fan-status');

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

    // Call updateStatus on page load
    updateStatus();
    // Set interval to update status every 5 seconds
    setInterval(updateStatus, 5000);

    const tempChartElement = document.getElementById('tempChart');
    if (!tempChartElement) {
        console.error('Element with id "tempChart" not found.');
        return;
    }

    const ctx = tempChartElement.getContext('2d');
    let tempChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: `Temperature (°${tempUnit})`, // Update label to reflect the default unit
                data: [],
                borderColor: 'rgba(75, 192, 192, 1)',
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
                const targetTemp = parseFloat(targetTempInput.value);
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