import { showModal, hideModal } from './modal.js';
import { updateStatus, handleFetchError } from './status.js';
import { requestMeaterApiKey } from './api.js';

document.addEventListener("DOMContentLoaded", function() {
    const form = document.getElementById('settingsForm');
    const enableMeaterIntegrationButton = document.getElementById('enableMeaterIntegration');
    const meaterModal = document.getElementById('meaterModal');
    const closeModal = document.getElementsByClassName('close')[0];
    const meaterForm = document.getElementById('meaterForm');
    const meaterStatus = document.getElementById('meaterStatus');
    const messageContainer = document.getElementById('messageContainer'); // Add this line

    // Function to display messages
    function displayMessage(message, type) {
        messageContainer.innerHTML = `<div class="${type}">${message}</div>`;
        setTimeout(() => {
            messageContainer.innerHTML = '';
        }, 5000);
    }

    // Open the modal
    if (enableMeaterIntegrationButton) {
        enableMeaterIntegrationButton.addEventListener('click', function() {
            showModal(meaterModal);
        });
    }

    // Close the modal
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            hideModal(meaterModal, meaterStatus);
        });
    }

    // Close the modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target == meaterModal) {
            hideModal(meaterModal, meaterStatus);
        }
    });

    if (meaterForm) {
        meaterForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const email = document.getElementById('meater_email').value;
            const password = document.getElementById('meater_password').value;

            requestMeaterApiKey(email, password)
                .then(token => {
                    console.log('Meater API Key obtained:', token);
                    // Handle successful login, e.g., update UI or store token
                })
                .catch(error => {
                    console.error('Error requesting Meater API Key:', error);
                    // Handle error, e.g., show error message to user
                    displayMessage('Error requesting Meater API Key. Please check the console for details.', 'error'); // Display error message
                });
        });
    }

    if (form) {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            const formData = new FormData(form);

            // Ensure default values are included
            const deviceName = formData.get('device_name') || 'Default Device Name';
            const tempUnit = formData.get('temp_unit') || 'C'; // Assuming 'C' is the default unit

            formData.set('device_name', deviceName);
            formData.set('temp_unit', tempUnit);

            fetch('/save_settings', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error('Network response was not ok: ' + response.status + ' ' + response.statusText + ' - ' + text);
                    });
                }
                return response.json();  // Get response as JSON
            })
            .then(data => {
                console.log('Response data:', data); // Debugging line
                if (data.success) {
                    displayMessage('Settings saved successfully!', 'success'); // Display success message
                    // Update the device name on the page
                    const deviceNameElement = document.getElementById('deviceName');
                    if (deviceNameElement) {
                        console.log('Updating device name to:', deviceName); // Debugging line
                        deviceNameElement.textContent = deviceName;
                    }
                } else {
                    displayMessage('Failed to save settings.', 'error'); // Display error message
                }
            })
            .catch(error => {
                console.error('Error saving settings:', error);
                displayMessage('Error saving settings: ' + error.message, 'error'); // Display error message
            });
        });
    }

    const pidAutotuneButton = document.getElementById('pid_autotune');
    if (pidAutotuneButton) {
        pidAutotuneButton.addEventListener('click', function(event) {
            event.preventDefault();
            fetch('/pid_autotune', {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    displayMessage('PID Autotune started! Waiting for completion...', 'success'); // Display success message
                    checkAutotuneStatus();  // Call function to check autotune status
                } else {
                    displayMessage('Failed to start PID Autotune.', 'error'); // Display error message
                }
            })
            .catch(error => {
                console.error('Error starting PID Autotune:', error);
                displayMessage('Error starting PID Autotune: ' + error.message, 'error'); // Display error message
            });
        });
    }

    const tempUnitSelect = document.getElementById('temp_unit');
    if (tempUnitSelect) {
        tempUnitSelect.addEventListener('change', function(event) {
            // Fetch temperature data in the selected unit and update display
            fetchTemperatureData();
        });
    }

    function fetchTemperatureData() {
        fetch('/get_temperature')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                if (!data.temperatures) {  // Check for 'temperatures' instead of 'temperature'
                    throw new Error('Data format is incorrect');
                }

                let temperatures = data.temperatures;  // Adjust to match the returned data format
                const tempUnit = document.getElementById('temp_unit').value;

                if (tempUnit === 'F') {
                    temperatures = temperatures.map(celsiusToFahrenheit);
                }

                updateTemperatureDisplay(temperatures);  // Pass the array of temperatures
            })
            .catch(error => {
                console.error('Error fetching temperature data:', error);
            });
    }

    // Save Device Settings
document.getElementById('saveDevices').addEventListener('click', function() {
    const formData = new FormData();
    formData.append('enable_max31865', document.getElementById('enable_max31865').checked);
    formData.append('enable_max31855', document.getElementById('enable_max31855').checked);
    formData.append('enable_ads1115', document.getElementById('enable_ads1115').checked);
    
    fetch('/save_device_settings', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const messageContainer = document.getElementById('messageContainer');
            messageContainer.textContent = 'Device settings saved successfully!';
        } else {
            const messageContainer = document.getElementById('messageContainer');
            messageContainer.textContent = 'Failed to save device settings.';
        }
    })
    .catch(error => {
        console.error('Error saving device settings:', error);
        const messageContainer = document.getElementById('messageContainer');
        messageContainer.textContent = 'Error saving device settings: ' + error.message;
    });
});

    function fetchMeaterTemperature() {
        fetch('/get_meater_temperature')
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`Network response was not ok: ${response.status} ${response.statusText} - ${text}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.temperature !== undefined) {
                    document.getElementById('meater-temp').textContent = data.temperature + ' °C';
                } else {
                    console.error('Error fetching Meater temperature:', data.error);
                    displayMessage('Error fetching Meater temperature: ' + data.error, 'error'); // Display error message
                }
            })
            .catch(error => {
                console.error('Error fetching Meater temperature:', error);
                displayMessage('Error fetching Meater temperature: ' + error.message, 'error'); // Display error message
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
                    displayMessage(`PID Autotune completed successfully:\nKp: ${results.Kp}, Ki: ${results.Ki}, Kd: ${results.Kd}`, 'success'); // Display success message
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
                const tempUnitElement = document.getElementById('temp_unit');
                if (tempUnitElement) {
                    const tempUnit = tempUnitElement.value;
                    let temperature = data.temperature;
                    if (tempUnit === 'F') {
                        temperature = celsiusToFahrenheit(temperature);
                    }
                    const currentTempElement = document.getElementById('current-temp');
                    if (currentTempElement) {
                        currentTempElement.textContent = temperature.toFixed(2) + ` °${tempUnit}`;
                    } else {
                        console.error('Element with id "current-temp" not found.');
                    }
                } else {
                    console.error('Element with id "temp_unit" not found.');
                }
                const fanStatusElement = document.getElementById('fan-status');
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
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                const meaterStatusElement = document.getElementById('meaterStatus');
                if (meaterStatusElement) {
                    if (data.connected) {
                        meaterStatusElement.textContent = 'Meater is connected';
                        meaterStatusElement.style.color = 'green';
                    } else {
                        meaterStatusElement.textContent = 'Meater is not connected';
                        meaterStatusElement.style.color = 'red';
                    }
                } else {
                    console.error('Element with id "meaterStatus" not found.');
                }
            })
            .catch(error => {
                console.error('Error fetching Meater status:', error);
                const meaterStatusElement = document.getElementById('meaterStatus');
                if (meaterStatusElement) {
                    meaterStatusElement.textContent = 'Error fetching Meater status';
                    meaterStatusElement.style.color = 'red';
                } else {
                    console.error('Element with id "meaterStatus" not found.');
                }
            });
    }

    function updateFanStatus() {
        fetch('/api/fan-status')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                const fanStatusElement = document.getElementById('fan-status');
                if (fanStatusElement) {
                    fanStatusElement.textContent = `Fan status: ${data.status}`;
                } else {
                    console.error('Element with ID "fan-status" not found.');
                }
            })
            .catch(error => {
                console.error('Error fetching fan status:', error);
                const fanStatusElement = document.getElementById('fan-status');
                if (fanStatusElement) {
                    fanStatusElement.textContent = 'Error fetching fan status';
                } else {
                    console.error('Element with ID "fan-status" not found.');
                }
            });
    }

    // Initialize Database Modal
    const initDbButton = document.getElementById('initDbButton');
    const initDbModal = document.getElementById('initDbModal');
    const initDbStatus = document.getElementById('initDbStatus');

    if (initDbButton) { // Check if initDbButton exists
        initDbButton.addEventListener('click', function() {
            initDbModal.style.display = 'block';
            initDatabase();
        });
    }

    window.addEventListener('click', function(event) {
        if (event.target == initDbModal) {
            initDbModal.style.display = 'none';
        }
    });

    function initDatabase() {
        fetch('/init_db', { method: 'POST' })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'success') {
                    initDbStatus.textContent = 'Database initialized successfully.';
                } else {
                    initDbStatus.textContent = 'Error initializing database: ' + data.message;
                }
            })
            .catch(error => {
                initDbStatus.textContent = 'Error initializing database: ' + error.message;
            });
    }

    // Ensure fetchStatus is called after the DOM is fully loaded
    fetchMeaterStatus();
    fetchSettings();
    fetchStatus();
    fetchMeaterTemperature();
    setInterval(fetchStatus, 3000); // Update status every 15 seconds

    const saveIntegrationsButton = document.getElementById('saveIntegrations');
    if (saveIntegrationsButton) {
        saveIntegrationsButton.addEventListener('click', function(event) {
            event.preventDefault();
            saveIntegrationSettings();
        });
    }

    function saveIntegrationSettings() {
        const meaterEnabled = document.getElementById('meater_integration').checked;
        const meaterUsername = document.getElementById('meater_email').value;
        const meaterPassword = document.getElementById('meater_password').value;

        const formData = new FormData();
        formData.append('meater_enabled', meaterEnabled);
        formData.append('meater_username', meaterUsername);
        formData.append('meater_password', meaterPassword);

        fetch('/save_integration_settings', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayMessage('Integration settings saved successfully', 'success');
            } else {
                displayMessage('Error saving integration settings: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error saving integration settings:', error);
            displayMessage('Error saving integration settings: ' + error.message, 'error');
        });
    }
});