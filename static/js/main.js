import { fetchStatus, updateTargetTemp, fetchTemperatureData } from './api.js';
//import { Chart, registerables } from 'chart.js';
// Chart.register(...registerables);

let tempUnit = 'F'; // Default unit changed to Fahrenheit

document.addEventListener("DOMContentLoaded", function() {
    function updateStatus() {
        fetchStatus()
            .then(data => {
                console.log('Status data:', data); // Debugging line
                const currentTempElement = document.getElementById('current-temp');
                const fanStatusElement = document.getElementById('fan-status');

                if (currentTempElement) {
                    let temperature = data.temperature;
                    if (tempUnit === 'F') {
                        temperature = (temperature * 9/5) + 32; // Convert to Fahrenheit
                    }
                    currentTempElement.textContent = temperature.toFixed(2) + ` °${tempUnit}`;
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

    fetch('/get_settings')
        .then(response => response.json())
        .then(settings => {
            const deviceNameElement = document.getElementById('deviceName');
            if (deviceNameElement) {
                deviceNameElement.textContent = settings.device_name;
            }

            // Update temperature unit
            tempUnit = settings.units.temperature; // Set the global variable
            updateTemperatureUnit(tempUnit);
        })
        .catch(error => {
            console.error('Error fetching settings:', error);
        });

    function updateTemperatureUnit(unit) {
        // Fetch the current temperature and update the display
        fetch('/get_temperature')
            .then(response => response.json())
            .then(data => {
                if (data.temperature !== undefined) {
                    let temperature = data.temperature;
                    if (unit === 'F') {
                        temperature = (temperature * 9/5) + 32; // Convert to Fahrenheit
                    }
                    document.getElementById('current-temp').textContent = `${temperature.toFixed(2)} °${unit}`;
                }
            })
            .catch(error => {
                console.error('Error fetching temperature:', error);
            });
    }

    // Function to get CSRF token
    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    }

    // Define the updateTargetTemp function
    function updateTargetTemp() {
        const targetTemp = document.getElementById('target-temp').value;
        fetch('/set_target_temperature', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()  // Include CSRF token
            },
            body: JSON.stringify({ target_temperature: targetTemp })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Target temperature updated:', data);
        })
        .catch(error => {
            console.error('Error updating target temperature:', error);
        });
    }

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
});