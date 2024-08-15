import { showModal, hideModal } from './modal.js';
import { updateStatus, handleFetchError } from './status.js';
import { requestMeaterApiKey } from './api.js';

document.addEventListener("DOMContentLoaded", function() {
    M.AutoInit();
    var elems = document.querySelectorAll('.tabs');
    var instances = M.Tabs.init(elems);

    // Ensure labels are correctly positioned
    M.updateTextFields();

    // Add event listeners to switch tab content
    document.querySelectorAll('.tabs a').forEach(tab => {
        tab.addEventListener('click', function(event) {
            event.preventDefault();
            const target = this.getAttribute('href').substring(1);
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(target).classList.add('active');
        });
    });

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
            const tempUnit = formData.get('temp_unit') || 'F'; // Default unit changed to Fahrenheit

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
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCsrfToken()  // Include CSRF token
                }
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
                    document.getElementById('temp_unit').value = settings.temp_unit || 'F'; // Default unit changed to Fahrenheit
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
    fetchStatus(); // Call the defined fetchStatus function
    fetchMeaterTemperature(); // Added this line to call the new function
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

    // Function to get CSRF token
    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    }
});

function fetchStatus() {
    fetch('/api/status')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            // Update the UI with the fetched status data
            console.log('Status data:', data);
            // Example: update a status element
            const statusElement = document.getElementById('status');
            if (statusElement) {
                statusElement.textContent = `Status: ${data.status}`;
            }
            const temperatureElement = document.getElementById('current-temp');
            if (temperatureElement) {
                temperatureElement.textContent = `Current Temperature: ${data.temperature} °F`;
            }
            const fanStatusElement = document.getElementById('fan-status');
            if (fanStatusElement) {
                fanStatusElement.textContent = `Fan Status: ${data.fan_on ? 'On' : 'Off'}`;
            }
        })
        .catch(error => {
            console.error('Error fetching status:', error);
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
            const meaterTempElement = document.getElementById('meater-temp');
            if (meaterTempElement) {
                meaterTempElement.textContent = `Meater Temperature: ${data.temperature}`;
            } else {
                console.error('Element with id "meater-temp" not found.');
            }
        })
        .catch(error => {
            console.error('Error fetching Meater temperature:', error);
            const meaterTempElement = document.getElementById('meater-temp');
            if (meaterTempElement) {
                meaterTempElement.textContent = 'Error fetching Meater temperature';
            } else {
                console.error('Element with id "meater-temp" not found.');
            }
        });
}