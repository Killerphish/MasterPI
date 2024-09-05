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
                            unit: 'minute',
                            tooltipFormat: 'MMM d, yyyy, h:mm:ss a'  // Format for tooltip
                        },
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Temperature (°F)'
                        }
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
            console.log('Updating charts with data:', data); // Log the data for debugging
            charts.forEach((chart, index) => {
                if (chart && chart.data && chart.data.datasets) {
                    const probeData = data.data;  // Use the data directly
                    console.log(`Updating chart ${index} with data:`, probeData); // Log the data for each chart
                    chart.data.datasets[0].data = probeData.map(item => ({
                        x: new Date(item.timestamp),
                        y: item.temperature  // Temperature is already in Fahrenheit and rounded to 2 decimal places
                    }));
                    chart.update();
                }
            });
        })
        .catch(error => {
            console.error('Error fetching temperature data:', error);
        });
}

// Export the functions to be used in other files if needed
export { initializeCharts, updateCharts };