document.addEventListener("DOMContentLoaded", function() {
    const ctx = document.getElementById('tempChart').getContext('2d');
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
        fetch('/temp_data')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                if (!Array.isArray(data)) {
                    throw new Error('Data format is incorrect');
                }

                let labels = data.map(d => new Date(d[0]));
                let temperatures = data.map(d => d[1]);

                tempChart.data.labels = labels.reverse();
                tempChart.data.datasets[0].data = temperatures.reverse();
                tempChart.update();
            })
            .catch(error => {
                console.error('Error fetching temperature data:', error);
            });
    }

    function fetchStatus() {
        fetch('/get_status')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                document.getElementById('current-temp').textContent = data.temperature.toFixed(2) + ' °C';
                document.getElementById('fan-status').textContent = data.fan_on ? 'On' : 'Off';
            })
            .catch(error => {
                console.error('Error fetching status:', error);
            });
    }

    fetchTemperatureData(); // Initial fetch
    setInterval(fetchTemperatureData, 5000); // Fetch data every 5 seconds

    fetchStatus(); // Initial fetch
    setInterval(fetchStatus, 5000); // Fetch status every 5 seconds
});