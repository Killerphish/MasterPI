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

    // Initialize Materialize components
    M.AutoInit();

    // Initialize dropdown
    const dropdownElems = document.querySelectorAll('.dropdown-trigger');
    M.Dropdown.init(dropdownElems, { constrainWidth: false });

    // Event listener for Power Options
    document.getElementById('power-options').addEventListener('click', () => {
        // Open a modal for power options
        showModal('Power Options', `
            <button id="restart-app" class="btn">Restart App</button>
            <button id="restart-device" class="btn">Restart Device</button>
            <button id="shutdown" class="btn red">Shut Down</button>
        `);

        // Add event listeners for power options
        document.getElementById('restart-app').addEventListener('click', () => {
            fetchWithCsrf('/power_options', { method: 'POST', body: JSON.stringify({ action: 'restart_app' }) });
        });

        document.getElementById('restart-device').addEventListener('click', () => {
            fetchWithCsrf('/power_options', { method: 'POST', body: JSON.stringify({ action: 'restart_rpi' }) });
        });

        document.getElementById('shutdown').addEventListener('click', () => {
            fetchWithCsrf('/power_options', { method: 'POST', body: JSON.stringify({ action: 'shutdown' }) });
        });
    });

    // Event listener for Emergency Stop
    document.getElementById('emergency-shutdown').addEventListener('click', () => {
        fetch('/emergency_shutdown', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                M.toast({html: 'Emergency shutdown successful.'});
            } else {
                M.toast({html: `Error: ${data.message}`});
            }
        })
        .catch(error => {
            console.error('Error during emergency shutdown:', error);
        });
    });

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
            if (status.temperatures && Array.isArray(status.temperatures)) {
                status.temperatures.forEach((temp, index) => {
                    const probeElement = document.getElementById(`probe-${index}`);
                    if (probeElement) {
                        probeElement.textContent = `${temp} °F`;
                    } else {
                        console.error(`Element with id "probe-${index}" not found.`);
                    }
                });
            } else {
                console.error('Invalid or missing temperatures data in status');
            }
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