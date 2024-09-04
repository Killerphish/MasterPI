import { fetchTemperatureData } from './api.js';

let charts = [];

document.addEventListener('DOMContentLoaded', function() {
    const probeCharts = document.getElementById('probe-charts');
    const canvases = probeCharts.querySelectorAll('canvas');
    
    canvases.forEach((canvas, index) => {
        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: `Probe ${index + 1}`,
                    data: [],
                    borderColor: `hsl(${index * 137.5 % 360}, 70%, 50%)`,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
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
        charts.push(chart);
    });

    updateCharts();
});

function updateCharts() {
    const timeRange = document.getElementById('time-range').value;
    fetchTemperatureData(timeRange)
        .then(data => {
            charts.forEach((chart, index) => {
                const probeData = data.filter(item => item.probe_id === index);
                chart.data.datasets[0].data = probeData.map(item => ({
                    x: new Date(item.timestamp),
                    y: item.temperature
                }));
                chart.update();
            });
        })
        .catch(error => {
            console.error('Error fetching temperature data:', error);
        });
}

document.getElementById('time-range').addEventListener('change', updateCharts);

// Update charts every 5 seconds
setInterval(updateCharts, 5000);