import { fetchStatus, updateTargetTemp, fetchTemperatureData } from './api.js';
//import { Chart, registerables } from 'chart.js';
// Chart.register(...registerables);

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

    function updateChart(minutes) {
        fetch(`/get_temperature_data?minutes=${minutes}`)
            .then(response => response.json())
            .then(data => {
                const labels = data.map(point => new Date(point[0]));
                const temperatures = data.map(point => {
                    let temp = point[1];
                    if (tempUnit === 'F') {
                        temp = (temp * 9/5) + 32; // Convert to Fahrenheit
                    }
                    return temp;
                });

                tempChart.data.labels = labels;
                tempChart.data.datasets[0].data = temperatures;
                tempChart.update();
            })
            .catch(error => {
                console.error('Error fetching temperature data:', error);
            });
    }

    const timeRangeSelect = document.getElementById('time-range');
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener('change', function() {
            updateChart(this.value);
        });
    }

    // Initial chart update
    updateChart(timeRangeSelect.value);

    const targetTempInput = document.getElementById('target-temp');

    targetTempInput.addEventListener('input', function() {
        const targetTemp = this.value;
        updateTargetTemp(targetTemp)
            .then(data => {
                console.log('Success:', data);
                // Clear the input value after setting the target temperature
                this.value = '';
            })
            .catch(error => {
                console.error('Error:', error);
            });
    });

    targetTempInput.addEventListener('blur', function() {
        // Re-focus the input to allow for new selection
        this.focus();
    });

    // Define the updateTargetTemp function in the global scope
    window.updateTargetTemp = function(targetTemp) {
        return fetch('/set_target_temperature', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()  // Include CSRF token
            },
            body: JSON.stringify({ target_temperature: targetTemp })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Target temperature updated:', data);
        })
        .catch(error => {
            console.error('Error updating target temperature:', error);
        });
    }

    // Function to get CSRF token
    function getCsrfToken() {
        const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
        if (csrfTokenMeta) {
            return csrfTokenMeta.getAttribute('content');
        } else {
            console.error('CSRF token not found');
            return '';
        }
    }

    fetch('/get_settings')
        .then(response => response.json())
        .then(settings => {
            const deviceNameElement = document.getElementById('deviceName');
            const brandLogoElement = document.getElementById('brand-logo'); // Add this line

            if (deviceNameElement) {
                deviceNameElement.textContent = settings.device.name;  // Set default device name
            }

            if (brandLogoElement) {  // Add this block
                brandLogoElement.textContent = settings.device.name;
            }

            // Update temperature unit
            tempUnit = settings.units.temperature; // Set the global variable
        })
        .catch(error => {
            console.error('Error fetching settings:', error);
        });

    // Define the emergencyShutdown function
    function emergencyShutdown() {
        fetch('/emergency_shutdown', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCsrfToken()  // Include CSRF token
            }
        })
        .then(response => response.json())
        .then(data => {
            console.log('Emergency shutdown initiated:', data);
        })
        .catch(error => {
            console.error('Error initiating emergency shutdown:', error);
        });
    }

    // Attach the emergencyShutdown function to the button's onclick event
    const emergencyShutdownButton = document.getElementById('emergency-shutdown-button');
    if (emergencyShutdownButton) {
        emergencyShutdownButton.onclick = emergencyShutdown;
    } else {
        console.error('Element with id "emergency-shutdown-button" not found.');
    }

    updateChart(timeRangeSelect.value);
    setInterval(() => updateChart(timeRangeSelect.value), 30000); // Update chart every 30 seconds
    updateStatus();
    setInterval(updateStatus, 5000);

    const pidAutotuneButton = document.getElementById('pid_autotune');
    if (pidAutotuneButton) {
        pidAutotuneButton.addEventListener('click', function(event) {
            event.preventDefault();
            fetch('/pid_autotune', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCsrfToken()  // Include CSRF token
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    displayMessage('PID Autotune started! Waiting for completion...', 'success'); // Display success message
                    checkAutotuneStatus();  // Call function to check autotune status
                } else {
                    displayMessage('Failed to start PID Autotune.', 'error'); // Display error message
                }
            })
            .catch(error => {
                console.error('Error starting PID Autotune:', error);
                displayMessage('Error starting PID Autotune: ' + error.message, 'error'); // Display error message
            });
        });
    }

    // Function to complete the wizard
    function completeWizard() {
        const deviceName = document.getElementById('device_name').value;
        const tempUnit = document.getElementById('temp_unit').value;

        fetch('/complete_wizard', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()  // Include CSRF token
            },
            body: JSON.stringify({ device_name: deviceName, temp_unit: tempUnit })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Wizard completed:', data);
            window.location.href = '/';  // Redirect to the main page
        })
        .catch(error => {
            console.error('Error completing wizard:', error);
        });
    }

    // Attach the completeWizard function to the form's submit event
    const wizardForm = document.getElementById('wizard-form');
    if (wizardForm) {
        wizardForm.addEventListener('submit', function(event) {
            event.preventDefault();
            completeWizard();
        });
    } else {
        console.error('Element with id "wizard-form" not found.');
    }

    M.AutoInit();

    const removeForm = document.getElementById('removeSensorForm');
    const sensorList = document.getElementById('sensorList');
    const removeModal = document.getElementById('sensorRemoveModal');

    sensorList.addEventListener('click', function(event) {
        if (event.target.classList.contains('remove-sensor')) {
            const index = event.target.dataset.index;
            removeForm.elements.index.value = index;
            removeModal.style.display = 'block';
        }
    });

    removeForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(removeForm);

        fetch('/remove_sensor', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': getCsrfToken()  // Include CSRF token
            }
        }).then(response => {
            if (response.ok) {
                window.location.reload();
            } else {
                console.error('Failed to remove sensor');
            }
        }).catch(error => {
            console.error('Error:', error);
        });
    });
});