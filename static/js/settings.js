console.log('Script loaded')

document.addEventListener("DOMContentLoaded", function() {
    const form = document.getElementById('settingsForm');

    form.addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(form);

    // Log device_name from formData
    console.log('Device Name from Form Data:', formData.get('device_name'));

        fetch('/save_settings', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Settings saved successfully!');
                const deviceName = formData.get('device_name');
                // Update device name in index.html h1 element
                document.getElementById('deviceName').textContent = deviceName ? deviceName : "MasterPi Smoker";
            } else {
                alert('Failed to save settings.');
            }
        });
    });

    document.getElementById('pid_autotune').addEventListener('click', function(event) {
        event.preventDefault();
        fetch('/pid_autotune', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('PID Autotune started! Waiting for completion...');
                checkAutotuneStatus();  // Call function to check autotune status
            } else {
                alert('Failed to start PID Autotune.');
            }
        });
    });

    document.getElementById('temp_unit').addEventListener('change', function(event) {
        // Fetch temperature data in the selected unit and update display
        fetchTemperatureData();
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

                let temperatures = data.map(d => d[1]);
                const tempUnit = document.getElementById('temp_unit').value;

                if (tempUnit === 'F') {
                    temperatures = temperatures.map(celsiusToFahrenheit);
                }

                updateTemperatureDisplay(temperatures);
            })
            .catch(error => {
                console.error('Error fetching temperature data:', error);
            });
    }

    function checkAutotuneStatus() {
        fetch('/autotune_status')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    const results = data.results;
                    alert(`PID Autotune completed successfully:\nKp: ${results.Kp}, Ki: ${results.Ki}, Kd: ${results.Kd}`);
                } else {
                    setTimeout(checkAutotuneStatus, 3000); // Check again after 3 seconds
                }
            })
            .catch(error => {
                console.error('Error checking autotune status:', error);
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

    function celsiusToFahrenheit(celsius) {
        return (celsius * 9/5) + 32;
    }

    function updateTemperatureDisplay(temperatures) {
        const tempDisplay = document.getElementById('current-temp');
        if (temperatures.length > 0) {
            tempDisplay.textContent = temperatures.join(', ');  // Update based on your display logic
        } else {
            tempDisplay.textContent = 'No data available';
        }
    }
    fetchStatus();
    setInterval(fetchStatus, 3000); // Update status every 3 seconds
});