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
                    // Update the device name on the page
                    const deviceNameElement = document.getElementById('deviceName');
                    if (deviceNameElement) {
                        console.log('Updating device name to:', deviceName); // Debugging line
                        deviceNameElement.textContent = deviceName;
                    }
                } else {
                    // No need to display message here, as it will be handled server-side
                }
            })
            .catch(error => {
                console.error('Error saving settings:', error);
                // No need to display message here, as it will be handled server-side
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
                    checkAutotuneStatus();  // Call function to check autotune status
                } else {
                    // No need to display message here, as it will be handled server-side
                }
            })
            .catch(error => {
                console.error('Error starting PID Autotune:', error);
                // No need to display message here, as it will be handled server-side
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

    const sensorList = document.getElementById('sensorList');
    const addSensorButton = document.getElementById('addSensor');
    const tempOffsetInput = document.getElementById('temp_offset');
    const sensorTypeSelect = document.getElementById('sensor_type');
    const editModal = document.getElementById('sensorEditModal');
    const removeModal = document.getElementById('sensorRemoveModal');
    const editForm = document.getElementById('editSensorForm');
    const removeForm = document.getElementById('removeSensorForm');

    let sensors = [];

    function renderSensors() {
        sensorList.innerHTML = '';
        sensors.forEach((sensor, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                ${sensor.type} (Offset: ${sensor.temp_offset})
                <button class="editSensor" data-index="${index}">Edit</button>
                <form method="POST" action="/remove_sensor/${index}" style="display:inline;">
                    <button type="submit">Remove</button>
                </form>
            `;
            sensorList.appendChild(li);
        });
    }

    addSensorButton.addEventListener('click', function() {
        const sensor = {
            type: sensorTypeSelect.value,
            temp_offset: parseFloat(tempOffsetInput.value)
        };
        sensors.push(sensor);
        renderSensors();
    });

    sensorList.addEventListener('click', function(event) {
        if (event.target.classList.contains('editSensor')) {
            const index = event.target.getAttribute('data-index');
            const sensor = sensors[index];
            sensorTypeSelect.value = sensor.type;
            tempOffsetInput.value = sensor.temp_offset;
            sensors.splice(index, 1);
            renderSensors();
        }
    });

    document.getElementById('saveDevices').addEventListener('click', function() {
        const formData = new FormData();
        formData.append('sensors', JSON.stringify(sensors));

        fetch('/save_device_settings', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // No need to display message here, as it will be handled server-side
            } else {
                // No need to display message here, as it will be handled server-side
            }
        })
        .catch(error => {
            console.error('Error saving device settings:', error);
            // No need to display message here, as it will be handled server-side
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
                    // No need to display message here, as it will be handled server-side
                }
            })
            .catch(error => {
                console.error('Error fetching Meater temperature:', error);
                // No need to display message here, as it will be handled server-side
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
                    // No need to display message here, as it will be handled server-side
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
                // No need to display message here, as it will be handled server-side
            } else {
                // No need to display message here, as it will be handled server-side
            }
        })
        .catch(error => {
            console.error('Error saving integration settings:', error);
            // No need to display message here, as it will be handled server-side
        });
    }

    // Tab switching functionality
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const targetTab = this.getAttribute('data-tab');

            // Remove active class from all tab contents
            tabContents.forEach(content => {
                content.classList.remove('active');
            });

            // Add active class to the target tab content
            document.getElementById(targetTab).classList.add('active');
        });
    });

    const addSensorButton = document.getElementById('addSensor');
    const sensorList = document.getElementById('sensorList');
    const sensorTypeSelect = document.getElementById('sensor_type');
    const editModal = document.getElementById('sensorEditModal');
    const removeModal = document.getElementById('sensorRemoveModal');
    const editForm = document.getElementById('editSensorForm');
    const removeForm = document.getElementById('removeSensorForm');

    addSensorButton.addEventListener('click', function() {
        const sensorType = sensorTypeSelect.value;
        const form = new FormData();
        form.append('sensor_type', sensorType);
        form.append('count', 1);

        fetch('/save_device_settings', {
            method: 'POST',
            body: form
        }).then(() => {
            window.location.reload();
        });
    });

    sensorList.addEventListener('click', function(event) {
        if (event.target.classList.contains('edit-sensor')) {
            const index = event.target.dataset.index;
            editForm.elements.index.value = index;
            editModal.style.display = 'block';
        } else if (event.target.classList.contains('remove-sensor')) {
            const index = event.target.dataset.index;
            removeForm.elements.index.value = index;
            removeModal.style.display = 'block';
        }
    });

    editForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const index = this.elements.index.value;
        const count = this.elements.count.value;

        fetch(`/edit_sensor/${index}`, {
            method: 'POST',
            body: new FormData(this)
        }).then(() => {
            window.location.reload();
        });
    });

    removeForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const index = this.elements.index.value;

        fetch(`/remove_sensor/${index}`, {
            method: 'POST'
        }).then(() => {
            window.location.reload();
        });
    });

    document.getElementById('cancelEdit').addEventListener('click', function() {
        editModal.style.display = 'none';
    });

    document.getElementById('cancelRemove').addEventListener('click', function() {
        removeModal.style.display = 'none';
    });

    window.addEventListener('click', function(event) {
        if (event.target == editModal) {
            editModal.style.display = 'none';
        }
        if (event.target == removeModal) {
            removeModal.style.display = 'none';
        }
    });

    // Function to get CSRF token
    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    }

    // Include this in your fetch requests
    fetch('/your-endpoint', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify(data)
    })
});