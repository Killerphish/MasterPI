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

    let temperatureHistory = [];

    function updateChart() {
        fetchTemperatureData()
            .then(data => {
                console.log('Fetched temperature data:', data);

                if (!Array.isArray(data)) {
                    throw new Error('Data format is incorrect');
                }

                let transformedData = data.map(item => {
                    if (!item.time || !item.temp) {
                        throw new Error('Data item format is incorrect');
                    }
                    let temperature = item.temp;
                    if (tempUnit === 'F') {
                        temperature = (temperature * 9/5) + 32; // Convert to Fahrenheit
                    }
                    return { time: new Date(item.time), temp: temperature };
                });

                // Add new data to the history
                temperatureHistory = temperatureHistory.concat(transformedData);

                // Keep only the last 2 minutes of data
                const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
                temperatureHistory = temperatureHistory.filter(item => item.time >= twoMinutesAgo);

                // Update the chart
                let labels = temperatureHistory.map(d => d.time);
                let temperatures = temperatureHistory.map(d => d.temp);
                tempChart.data.labels = labels;
                tempChart.data.datasets[0].data = temperatures;
                tempChart.data.datasets[0].label = `Temperature (°${tempUnit})`;
                tempChart.update();
                console.log('Chart updated with new data');
            })
            .catch(error => {
                console.error('Error fetching temperature data:', error);
            });
    }

    function fetchTemperatureData() {
        return fetch('http://masterpi.local/get_temperature')
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        throw new Error(`Network response was not ok: ${errorData.message}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log('Raw data fetched:', data);

                // Transform the data to the expected format
                if (data && typeof data.temperature !== 'undefined') {
                    data = [{
                        time: new Date().toISOString(), // Use the current time as the timestamp
                        temp: data.temperature
                    }];
                }

                if (!Array.isArray(data)) {
                    throw new Error('Data format is incorrect');
                }

                data.forEach(item => {
                    if (typeof item.time === 'undefined' || typeof item.temp === 'undefined') {
                        throw new Error('Data item format is incorrect');
                    }
                });

                return data;
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

    function updateTargetTemp() {
        const targetTempInput = document.getElementById('target-temp');
        const targetTemp = targetTempInput.value;

        fetch('/update_target_temperature', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ target_temp: targetTemp })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('Target temperature updated successfully!');
            } else {
                alert('Failed to update target temperature.');
            }
        })
        .catch(error => {
            console.error('Error updating target temperature:', error);
            alert('Error updating target temperature.');
        });
    }

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

    updateChart();
    setInterval(updateChart, 30000); // Update chart every 30 seconds
    updateStatus();
    setInterval(updateStatus, 5000);
});