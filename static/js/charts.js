import { fetchTemperatureData } from './api.js';

let charts = [];
let timezone = 'UTC';  // Default timezone

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');
    initializeCharts();
    updateCharts(); // Call this immediately after initialization
    setInterval(updateCharts, 5000); // Update charts every 5 seconds

    // Fetch settings to get the timezone
    fetch('/get_settings')
        .then(response => response.json())
        .then(settings => {
            timezone = settings.units.timezone;
        })
        .catch(error => {
            console.error('Error fetching settings:', error);
        });
});

function initializeCharts() {
    console.log('Initializing charts');
    const probeCharts = document.getElementById('probe-charts');
    console.log('probe-charts element:', probeCharts);
    const canvases = probeCharts.querySelectorAll('canvas');
    console.log('Number of canvas elements:', canvases.length);
    
    // Destroy existing charts
    charts.forEach(chart => {
        if (chart) {
            chart.destroy();
        }
    });
    charts = [];

    canvases.forEach((canvas, index) => {
        console.log(`Initializing chart for canvas: ${canvas.id}`);  // Log canvas ID
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
                            tooltipFormat: 'MMM d, yyyy, h:mm:ss a',  // Format for tooltip
                            displayFormats: {
                                minute: 'MMM d, yyyy, h:mm:ss a'
                            }
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
    console.log('Updating charts');
    const timeRange = document.getElementById('time-range').value;
    fetchTemperatureData(timeRange)
        .then(data => {
            console.log('Raw data received:', data);
            if (!data.data || !Array.isArray(data.data)) {
                console.error('Invalid data format received');
                return;
            }
            // ... rest of the function
        })
        .catch(error => {
            console.error('Error fetching temperature data:', error);
        });
}

// Export the functions to be used in other files if needed
export { initializeCharts, updateCharts };