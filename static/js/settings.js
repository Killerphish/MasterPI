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
        form.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());

            console.log("Form data before sending:", data);  // Add this line to print form data

            try {
                const response = await fetch(saveDeviceSettingsUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                    },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    M.toast({html: 'Settings saved successfully!'});

                    // Update the displayed device name and other settings dynamically
                    document.querySelector('.brand-logo').textContent = data.device_name;
                    document.getElementById('device_name').value = data.device_name;
                    document.getElementById('temp_unit').value = data.temp_unit;
                    M.updateTextFields();  // Ensure labels are correctly positioned
                } else {
                    const errorData = await response.json();
                    M.toast({html: `Error: ${errorData.message}`});
                }
            } catch (error) {
                M.toast({html: `Error: ${error.message}`});
            }
        });
    }

    const addSensorButton = document.getElementById('addSensor');
    const sensorList = document.getElementById('sensorList');
    const sensorTypeSelect = document.getElementById('sensor_type');
    const removeModal = document.getElementById('sensorRemoveModal');
    const removeForm = document.getElementById('removeSensorForm');

    if (sensorTypeSelect) {
        sensorTypeSelect.innerHTML = `
            <option value="MAX31865">MAX31865</option>
            <option value="MAX31856">MAX31856</option>
            <option value="ADS1115">ADS1115</option>
            <option value="DHT22">DHT22</option>
            <option value="MAX31855">MAX31855</option>
        `;
    }

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
            const modal = document.getElementById(`editSensorModal-${index}`);
            const instance = M.Modal.init(modal);
            instance.open();
        } else if (event.target.classList.contains('remove-sensor')) {
            const index = event.target.dataset.index;
            removeForm.elements.index.value = index;
            const instance = M.Modal.init(removeModal);
            instance.open();
        }
    });

    document.querySelectorAll('[id^="editSensorForm-"]').forEach(form => {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            const index = this.elements.index.value;

            fetch(`/edit_sensor/${index}`, {
                method: 'POST',
                body: new FormData(this)
            }).then(() => {
                window.location.reload();
            });
        });
    });

    // Function to get CSRF token
    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    }

    function updateSensorTemperatures(sensors) {
        sensors.forEach((sensor, index) => {
            const sensorTempElement = document.getElementById(`sensor-temp-${index}`);
            if (sensorTempElement) {
                sensorTempElement.textContent = `Temperature: ${sensor.temperature} °${sensor.unit}`;
            }
        });
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