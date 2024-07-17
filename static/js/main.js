import { fetchStatus, updateTargetTemp, fetchTemperatureData } from './api.js';
import { Chart, registerables } from './node_modules/chart.js/dist/chart.js';
Chart.register(...registerables);

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

                if (data && data.temperatures) {
                    data = data.temperatures.map(item => ({
                        timestamp: item.time,
                        temperature: item.temp
                    }));
                }

                if (!Array.isArray(data)) {
                    throw new Error('Data format is incorrect');
                }

                data.forEach(item => {
                    if (typeof item.timestamp === 'undefined' || typeof item.temperature === 'undefined') {
                        throw new Error('Data item format is incorrect');
                    }
                });

                return data;
            });
    }

    function updateChart() {
        fetchTemperatureData()
            .then(data => {
                console.log('Fetched temperature data:', data);

                if (!Array.isArray(data)) {
                    throw new Error('Data format is incorrect');
                }

                let transformedData = data.map(item => {
                    if (!item.timestamp || !item.temperature) {
                        throw new Error('Data item format is incorrect');
                    }
                    return [item.timestamp, item.temperature];
                });

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

    updateChart();
    setInterval(updateChart, 5000);
    updateStatus();
    setInterval(updateStatus, 5000);
});