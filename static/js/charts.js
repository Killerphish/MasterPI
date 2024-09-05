import { fetchTemperatureData } from './api.js';

let charts = [];

document.addEventListener('DOMContentLoaded', function() {
    initializeCharts();
    setInterval(updateCharts, 5000); // Update charts every 5 seconds
});

function initializeCharts() {
    const probeCharts = document.getElementById('probe-charts');
    const canvases = probeCharts.querySelectorAll('canvas');
    
    // Destroy existing charts
    charts.forEach(chart => {
        if (chart) {
            chart.destroy();
        }
    });
    charts = [];

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
}

function updateCharts() {
    const timeRange = document.getElementById('time-range').value;
    fetchTemperatureData(timeRange)
        .then(data => {
            charts.forEach((chart, index) => {
                if (chart && chart.data && chart.data.datasets) {
                    const probeData = data.filter(item => item.probe_id === index);
                    chart.data.datasets[0].data = probeData.map(item => ({
                        x: new Date(item.timestamp),
                        y: item.temperature
                    }));
                    chart.update();
                }
            });
        })
        .catch(error => {
            console.error('Error fetching temperature data:', error);
        });
}

document.getElementById('time-range').addEventListener('change', () => {
    // Destroy existing charts
    charts.forEach(chart => chart.destroy());
    charts = [];

    // Reinitialize charts
    initializeCharts();
    updateCharts();
});

// Export the functions to be used in other files if needed
export { initializeCharts, updateCharts };