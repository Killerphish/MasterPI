import { fetchStatus, updateTargetTemp, fetchTemperatureData } from './api.js';
import { showModal, hideModal } from './modal.js';
import { initializeCharts, updateCharts } from './charts.js';

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
    console.log('DOM fully loaded');
    M.AutoInit();

    // Fetch and display status data
    fetchStatus()
        .then(status => {
            const fanStatusElement = document.getElementById('fan-status');
            if (fanStatusElement) {
                fanStatusElement.textContent = status.fan_on ? 'On' : 'Off';
            } else {
                console.error('Element with id "fan-status" not found.');
            }

            const targetTempElement = document.getElementById('current-target-temp');
            if (targetTempElement) {
                targetTempElement.textContent = status.target_temperature;
            } else {
                console.error('Element with id "current-target-temp" not found.');
            }

            // Display temperatures
            status.temperatures.forEach((temp, index) => {
                const probeElement = document.getElementById(`probe-${index}`);
                if (probeElement) {
                    probeElement.textContent = `${temp} °F`;
                } else {
                    console.error(`Element with id "probe-${index}" not found.`);
                }
            });
        })
        .catch(error => {
            console.error('Error fetching status:', error);
        });

    // Add event listener for time range change
    document.getElementById('time-range').addEventListener('change', () => {
        updateCharts();
    });

    // Add event listener for updating target temperature
    document.getElementById('update-temp-button').addEventListener('click', () => {
        const targetTemp = document.getElementById('target-temp-input').value;
        updateTargetTemp(targetTemp)
            .then(response => {
                if (response.success) {
                    M.toast({html: 'Target temperature updated successfully'});
                } else {
                    M.toast({html: `Error updating target temperature: ${response.error}`});
                }
            })
            .catch(error => {
                console.error('Error updating target temperature:', error);
                M.toast({html: 'Error updating target temperature'});
            });
    });

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

    // Fetch and apply settings on page load
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

    M.AutoInit();

    // Add event listener for time range change
    document.getElementById('time-range').addEventListener('change', () => {
        updateCharts();
    });
});