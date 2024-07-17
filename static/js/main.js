import { fetchStatus, updateTargetTemp, fetchTemperatureData } from './api.js';

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
            maintainAspectRatio: true, // Maintain aspect ratio
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

    // Define fetchTemperatureData function
    function fetchTemperatureData() {
        return fetch('http://masterpi.local/get_temperature') // Updated URL
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        throw new Error(`Network response was not ok: ${errorData.message}`);
                    });
                }
                return response.json();
            });
    }

    function updateChart() {
        fetchTemperatureData()
            .then(data => {
                console.log('Fetched temperature data:', data); // Log the fetched data

                // Transform the data if necessary
                if (!Array.isArray(data)) {
                    throw new Error('Data format is incorrect');
                }

                // Assuming the data needs to be transformed from an object to an array of arrays
                let transformedData = data.map(item => [item.timestamp, item.temperature]);

                let labels = transformedData.map(d => new Date(d[0]));
                let temperatures = transformedData.map(d => d[1]);

                tempChart.data.labels = labels.reverse();
                tempChart.data.datasets[0].data = temperatures.reverse();
                tempChart.update();
            })
            .catch(error => {
                console.error('Error fetching temperature data:', error);
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

    // Initial fetches and intervals for fetching data
    updateChart(); // Initial fetch
    setInterval(updateChart, 5000); // Fetch data every 5 seconds
    updateStatus(); // Initial fetch
    setInterval(updateStatus, 5000); // Fetch status every 5 seconds
});