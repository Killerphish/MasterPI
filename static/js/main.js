import { fetchStatus, updateTargetTemp, fetchTemperatureData } from './api.js';
//import { Chart, registerables } from 'chart.js';
// Chart.register(...registerables);

let tempUnit = 'C'; // Default unit

document.addEventListener("DOMContentLoaded", function() {
    function updateStatus() {
        fetchStatus()
            .then(data => {
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
                label: 'Temperature (°C)',
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
                const temperatures = data.map(point => point[1]);

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
            tempUnit = settings.temp_unit; // Set the global variable
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

    // Define the emergencyShutdown function
    function emergencyShutdown() {
        fetch('/emergency_shutdown', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                console.log('Emergency shutdown success:', data);
            })
            .catch(error => {
                console.error('Error during emergency shutdown:', error);
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
});