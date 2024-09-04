import { fetchStatus, updateTargetTemp, fetchTemperatureData } from './api.js';
import { showModal, hideModal } from './modal.js'; // Ensure this import is correct

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
});