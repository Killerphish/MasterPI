import { showModal, hideModal } from './modal.js';
import { updateStatus, handleFetchError } from './status.js';
import { requestMeaterApiKey } from './api.js';

let tempUnit = 'F'; // Default unit changed to Fahrenheit

console.log('settings.js loaded');

// Make saveSettings globally accessible
window.saveSettings = function(element) {
    console.log('saveSettings called for:', element.name, 'with value:', element.value);
    const setting = {
        [element.name]: element.value
    };

    window.fetchWithCsrf('/save_settings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(setting)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Server response:', data);
        if (data.success) {
            M.toast({html: `${element.name} updated successfully`});
            // Apply the color change immediately
            applyColorChange(element.name, element.value);
        } else {
            M.toast({html: `Error updating ${element.name}: ${data.error}`});
        }
    })
    .catch(error => {
        console.error('Error:', error);
        M.toast({html: `Error updating ${element.name}`});
    });
};

function applyColorChange(settingName, value) {
    switch(settingName) {
        case 'navColor':
            document.documentElement.style.setProperty('--nav-color', value);
            break;
        case 'navTextColor':
            document.documentElement.style.setProperty('--nav-text-color', value);
            break;
        case 'buttonColor':
            document.documentElement.style.setProperty('--button-color', value);
            break;
        case 'buttonTextColor':
            document.documentElement.style.setProperty('--button-text-color', value);
            break;
        case 'backgroundColor':
            document.documentElement.style.setProperty('--background-color', value);
            break;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');

    // Initialize Materialize components
    M.AutoInit();

    // Initialize the modal
    const addSensorModal = document.querySelector('#addSensorModal');
    M.Modal.init(addSensorModal);

    const deleteSensorModal = document.querySelector('#deleteSensorModal');
    const deleteSensorInstance = M.Modal.init(deleteSensorModal);

    // Add event listener for the "Add Sensor" button
    const openAddSensorModalButton = document.querySelector('#openAddSensorModal');
    if (openAddSensorModalButton) {
        openAddSensorModalButton.addEventListener('click', () => {
            updateAvailablePins().then(() => {
                const instance = M.Modal.getInstance(addSensorModal);
                instance.open();
            });
        });
    } else {
        console.error('Open Add Sensor Modal button not found');
    }

    // Add event listener for the "Add Sensor" form submission
    const addSensorForm = document.querySelector('#addSensorForm');
    if (addSensorForm) {
        addSensorForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            // Disable the submit button to prevent multiple submissions
            const submitButton = addSensorForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            const sensorType = document.querySelector('#newSensorType').value;
            const chipSelectPin = document.querySelector('#newSensorCsPin').value;
            const sensorLabel = document.querySelector('#newSensorLabel').value;

            const sensorData = {
                sensor_type: sensorType,
                chip_select_pin: chipSelectPin,
                label: sensorLabel
            };

            console.log('Attempting to add sensor:', sensorData);
            window.fetchWithCsrf('/add_sensor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sensorData)
            })
            .then(response => response.json())
            .then(data => {
                console.log('Server response:', data);
                if (data.message) {
                    M.toast({html: data.message});
                    refreshSensorList();  // Refresh the sensor list after adding
                    updateAvailablePins();  // Update available pins after adding a sensor
                    // Close the modal
                    const instance = M.Modal.getInstance(addSensorModal);
                    instance.close();
                    // Reset the form
                    addSensorForm.reset();
                } else {
                    M.toast({html: `Error adding sensor: ${data.error}`});
                }
            })
            .catch(error => {
                console.error('Error adding sensor:', error);
                M.toast({html: 'Error adding sensor'});
            })
            .finally(() => {
                // Re-enable the submit button
                submitButton.disabled = false;
            });
        });
    } else {
        console.error('Add Sensor Form not found');
    }

    // Function to refresh sensor list
    function refreshSensorList() {
        fetch('/settings')
            .then(response => response.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const newSensorList = doc.querySelector('.collection');
                const currentSensorList = document.querySelector('.collection');
                if (currentSensorList && newSensorList) {
                    currentSensorList.innerHTML = newSensorList.innerHTML;
                    initializeSensorButtons();  // Re-initialize buttons for the new list
                }
            })
            .catch(error => {
                console.error('Error refreshing sensor list:', error);
                M.toast({html: 'Error refreshing sensor list'});
            });
    }

    // Function to initialize sensor buttons
    function initializeSensorButtons() {
        document.querySelectorAll('.remove-sensor').forEach(button => {
            button.addEventListener('click', handleRemoveSensor);
        });
    }

    // Function to handle sensor removal
    function handleRemoveSensor(event) {
        event.preventDefault();
        const sensorIndex = this.getAttribute('data-index');
        console.log(`Attempting to remove sensor at index: ${sensorIndex}`);

        // Open the confirmation modal
        const instance = M.Modal.getInstance(deleteSensorModal);
        instance.open();

        // Set up the confirmation button
        const confirmDeleteButton = document.querySelector('#confirmDeleteSensor');
        confirmDeleteButton.onclick = function() {
            window.fetchWithCsrf(removeSensorUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ index: sensorIndex })
            })
            .then(response => response.json())
            .then(result => {
                if (result.message) {
                    M.toast({html: result.message});
                    refreshSensorList();  // Refresh the sensor list after removing
                    updateAvailablePins();  // Update available pins after removing a sensor
                } else {
                    M.toast({html: `Error: ${result.error}`});
                }
            })
            .catch(error => {
                console.error('Error removing sensor:', error);
                M.toast({html: `Error: ${error.message}`});
            });
        };
    }

    // Function to fetch and update available pins
    function updateAvailablePins() {
        return fetch(getAvailablePinsUrl)
            .then(response => response.json())
            .then(data => {
                const newSensorCsPin = document.getElementById('newSensorCsPin');
                const editSensorCsPin = document.getElementById('editSensorCsPin');
                
                [newSensorCsPin, editSensorCsPin].forEach(select => {
                    if (select) {
                        select.innerHTML = '<option value="" disabled selected>Choose CS pin</option>';
                        data.available_pins.forEach(pin => {
                            const option = document.createElement('option');
                            option.value = pin;
                            option.textContent = pin;
                            select.appendChild(option);
                        });
                        M.FormSelect.init(select);
                    }
                });
            })
            .catch(error => {
                console.error('Error fetching available pins:', error);
            });
    }

    // Initial fetch of available pins
    updateAvailablePins();

    // Log any errors that occur when the script runs
    window.onerror = function(message, source, lineno, colno, error) {
        console.error('An error occurred:', message, 'at', source, 'line', lineno, 'column', colno, 'Error object:', error);
    };

    // Initialize Materialize select
    var elems = document.querySelectorAll('select');
    M.FormSelect.init(elems);

    function fetchAvailablePins() {
        fetch(getAvailablePinsUrl)
            .then(response => response.json())
            .then(pins => {
                const newSensorCsPin = document.getElementById('newSensorCsPin');
                const editSensorCsPin = document.getElementById('editSensorCsPin');
                
                [newSensorCsPin, editSensorCsPin].forEach(select => {
                    select.innerHTML = '';
                    pins.forEach(pin => {
                        const option = document.createElement('option');
                        option.value = pin;
                        option.textContent = pin;
                        select.appendChild(option);
                    });
                    M.FormSelect.init(select);
                });
            })
            .catch(error => {
                console.error('Error fetching available pins:', error);
            });
    }

    // Fetch available pins and populate the dropdown
    fetch(getAvailablePinsUrl)
        .then(response => response.json())
        .then(data => {
            const csPinSelect = document.getElementById('newSensorCsPin');
            csPinSelect.innerHTML = '<option value="" disabled selected>Choose CS pin</option>';
            data.available_pins.forEach(pin => {
                const option = document.createElement('option');
                option.value = pin;
                option.textContent = pin;
                csPinSelect.appendChild(option);
            });
            M.FormSelect.init(csPinSelect); // Reinitialize the select element
        })
        .catch(error => {
            console.error('Error fetching available pins:', error);
        });

    // Add event listener for sensor type change
    document.getElementById('newSensorType').addEventListener('change', function() {
        const chipSelectPinField = document.getElementById('newSensorCsPinField');
        if (this.value === 'ADS1115') {
            chipSelectPinField.style.display = 'none';
        } else {
            chipSelectPinField.style.display = 'block';
        }
    });

    // Add other event listeners and initialization code here
});