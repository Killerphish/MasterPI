console.log('Script loaded');

document.addEventListener("DOMContentLoaded", function() {
    const form = document.getElementById('settingsForm');
    const enableMeaterIntegrationButton = document.getElementById('enableMeaterIntegration');
    const meaterModal = document.getElementById('meaterModal');
    const closeModal = document.getElementsByClassName('close')[0];
    const meaterForm = document.getElementById('meaterForm');
    const meaterStatus = document.getElementById('meaterStatus');
    const closeModalButton = document.getElementById('closeModalButton');

    // Open the modal
    enableMeaterIntegrationButton.addEventListener('click', function() {
        meaterModal.style.display = "block";
    });

    // Close the modal
    closeModal.addEventListener('click', function() {
        meaterModal.style.display = "none";
        meaterStatus.textContent = ''; // Clear status on close
    });

    // Close the modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target == meaterModal) {
            meaterModal.style.display = "none";
            meaterStatus.textContent = ''; // Clear status on close
        }
    });

    closeModalButton.addEventListener('click', function() {
        meaterModal.style.display = "none";
        meaterStatus.textContent = ''; // Clear status on close
        closeModalButton.style.display = 'none'; // Hide close button
    });

    meaterForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const email = document.getElementById('meater_email').value;
        const password = document.getElementById('meater_password').value;

        fetch('/request_meater_api_key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                meaterStatus.textContent = 'Meater API Key requested successfully!';
                meaterStatus.style.color = 'green';
            } else {
                meaterStatus.textContent = 'Failed to request Meater API Key: ' + data.message;
                meaterStatus.style.color = 'red';
            }
            meaterStatus.style.display = 'block';
            closeModalButton.style.display = 'block'; // Show close button
        })
        .catch(error => {
            console.error('Error requesting Meater API Key:', error);
            meaterStatus.textContent = 'Error requesting Meater API Key.';
            meaterStatus.style.color = 'red';
            meaterStatus.style.display = 'block';
            closeModalButton.style.display = 'block'; // Show close button
        });
    });

    form.addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(form);

        fetch('/save_settings', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Settings saved successfully!');
                const deviceName = formData.get('device_name');
                if (document.getElementById('deviceName')) {
                    document.getElementById('deviceName').textContent = deviceName ? deviceName : "MasterPi Smoker";
                }
            } else {
                alert('Failed to save settings.');
            }
        })
        .catch(error => {
            console.error('Error saving settings:', error);
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
        fetch('/get_temperature')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                if (!data.temperature) {
                    throw new Error('Data format is incorrect');
                }

                let temperature = data.temperature;
                const tempUnit = document.getElementById('temp_unit').value;

                if (tempUnit === 'F') {
                    temperature = celsiusToFahrenheit(temperature);
                }

                updateTemperatureDisplay([temperature]); // Pass as an array with one element
            })
            .catch(error => {
                console.error('Error fetching temperature data:', error);
            });
    }

    function fetchMeaterTemperature() {
        fetch('/get_meater_temperature')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    console.error('Error fetching Meater temperature:', data.error);
                } else {
                    const temperature = data.temperature;
                    document.getElementById('meater-temp').textContent = temperature.toFixed(2) + ' °C';
                }
            })
            .catch(error => {
                console.error('Error fetching Meater temperature:', error);
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
                if (document.getElementById('current-temp')) {
                    const tempUnit = document.getElementById('temp_unit').value;
                    let temperature = data.temperature;
                    if (tempUnit === 'F') {
                        temperature = celsiusToFahrenheit(temperature);
                    }
                    document.getElementById('current-temp').textContent = temperature.toFixed(2) + ` °${tempUnit}`;
                }
                if (document.getElementById('fan-status')) {
                    document.getElementById('fan-status').textContent = data.fan_on ? 'On' : 'Off';
                }
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
        if (tempDisplay) {
            if (temperatures.length > 0) {
                tempDisplay.textContent = temperatures.join(', ');  // Update based on your display logic
            } else {
                tempDisplay.textContent = 'No data available';
            }
        }
    }

    function fetchSettings() {
        fetch('/get_settings')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(settings => {
                if (document.getElementById('device_name')) {
                    document.getElementById('device_name').value = settings.device_name;
                }
                if (document.getElementById('temp_unit')) {
                    document.getElementById('temp_unit').value = settings.temp_unit;
                }
            })
            .catch(error => {
                console.error('Error fetching settings:', error);
            });
    }
    function fetchMeaterStatus() {
        fetch('/get_meater_status')
            .then(response => response.json())
            .then(data => {
                const meaterStatusElement = document.getElementById('meaterStatus');
                if (data.connected) {
                    meaterStatusElement.textContent = 'Meater is connected';
                    meaterStatusElement.style.color = 'green';
                } else {
                    meaterStatusElement.textContent = 'Meater is not connected';
                    meaterStatusElement.style.color = 'red';
                }
            })
            .catch(error => {
                console.error('Error fetching Meater status:', error);
                const meaterStatusElement = document.getElementById('meaterStatus');
                meaterStatusElement.textContent = 'Error fetching Meater status';
                meaterStatusElement.style.color = 'red';
            });
    }
    fetchMeaterStatus();
    fetchSettings();
    fetchStatus();
    fetchMeaterTemperature();
    setInterval(fetchStatus, 3000); // Update status every 3 seconds
});