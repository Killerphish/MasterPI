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
            .then(response => response.json())
            .then(data => {
                let labels = data.map(d => new Date(d[0]));
                let temperatures = data.map(d => d[1]);
                tempChart.data.labels = labels.reverse();
                tempChart.data.datasets[0].data = temperatures.reverse();
                tempChart.update();
            });
    }

    setInterval(fetchTemperatureData, 60000); // Fetch data every minute
    fetchTemperatureData(); // Initial fetch
});