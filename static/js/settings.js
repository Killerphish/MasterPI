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
    const closeModalButton = document.getElementById('closeModalButton');

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

    if (closeModalButton) {
        closeModalButton.addEventListener('click', function() {
            hideModal(meaterModal, meaterStatus);
            closeModalButton.style.display = 'none'; // Hide close button
        });
    } else {
        console.error('Element with id "closeModalButton" not found.');
    }

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
                    alert('Error requesting Meater API Key. Please check the console for details.');
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
                return response.text();  // Get response as text
            })
            .then(text => {
                try {
                    const data = JSON.parse(text);  // Attempt to parse JSON
                    if (data.success) {
                        alert('Settings saved successfully!');
                        if (document.getElementById('deviceName')) {
                            document.getElementById('deviceName').textContent = deviceName ? deviceName : "MasterPi Smoker";
                        }
                    } else {
                        alert('Failed to save settings.');
                    }
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                    alert('Error saving settings. Please check the console for details.');
                }
            })
            .catch(error => {
                console.error('Error saving settings:', error);
                alert('Error saving settings: ' + error.message);
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
                    alert('PID Autotune started! Waiting for completion...');
                    checkAutotuneStatus();  // Call function to check autotune status
                } else {
                    alert('Failed to start PID Autotune.');
                }
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
                    alert('Error fetching Meater temperature: ' + data.error);  // Display error to user
                }
            })
            .catch(error => {
                console.error('Error fetching Meater temperature:', error);
                alert('Error fetching Meater temperature: ' + error.message);  // Display error to user
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
    const closeInitDbModalButton = document.getElementById('closeInitDbModalButton');
    const initDbStatus = document.getElementById('initDbStatus');

    initDbButton.addEventListener('click', function() {
        initDbModal.style.display = 'block';
        initDatabase();
    });

    closeInitDbModalButton.addEventListener('click', function() {
        initDbModal.style.display = 'none';
    });

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
});