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

// Move function definitions to the top level, outside of DOMContentLoaded
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
            console.error('Error updating available pins:', error);
        });
}

function refreshSensorList() {
    fetch('/settings')
        .then(response => response.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const newSensorList = doc.querySelector('.collection');
            document.querySelector('.collection').innerHTML = newSensorList.innerHTML;
            
            // Reinitialize event listeners for edit and remove buttons
            initializeSensorButtons();

            // Broadcast sensor configuration change
            broadcastSensorUpdate();
        })
        .catch(error => {
            console.error('Error refreshing sensor list:', error);
            M.toast({html: 'Error refreshing sensor list'});
        });
}

// Add this new function to broadcast sensor updates
function broadcastSensorUpdate() {
    // Use BroadcastChannel to communicate between tabs/windows
    const bc = new BroadcastChannel('sensor_updates');
    bc.postMessage({ type: 'sensor_config_changed' });
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
            
            const submitButton = addSensorForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            const sensorType = document.querySelector('#newSensorType').value;
            const sensorLabel = document.querySelector('#newSensorLabel').value;

            const sensorData = {
                sensor_type: sensorType,
                label: sensorLabel
            };

            if (sensorType === 'ADS1115') {
                sensorData.i2c_address = document.querySelector('#newSensorI2CAddress').value;
                sensorData.bus_number = parseInt(document.querySelector('#newSensorBusNumber').value);
                sensorData.channel = parseInt(document.querySelector('#newSensorChannel').value);
                sensorData.gain = parseInt(document.querySelector('#newSensorGain').value);
                sensorData.data_rate = parseInt(document.querySelector('#newSensorDataRate').value);
            } else {
                sensorData.chip_select_pin = document.querySelector('#newSensorCsPin').value;
            }

            window.fetchWithCsrf(addSensorUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sensorData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    M.toast({html: data.message});
                    refreshSensorList();
                    updateAvailablePins();
                    const instance = M.Modal.getInstance(addSensorModal);
                    instance.close();
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
                submitButton.disabled = false;
            });
        });
    } else {
        console.error('Add Sensor Form not found');
    }

    // Update the event listener for sensor type change
    document.getElementById('newSensorType').addEventListener('change', function() {
        const chipSelectPinField = document.getElementById('newSensorCsPinField');
        const ads1115Fields = document.getElementById('ads1115Fields');
        const max31865Fields = document.getElementById('max31865Fields');
        
        // Show/hide fields based on the selected sensor type
        chipSelectPinField.style.display = this.value === 'ADS1115' ? 'none' : 'block';
        ads1115Fields.style.display = this.value === 'ADS1115' ? 'block' : 'none';
        max31865Fields.style.display = this.value === 'MAX31865' ? 'block' : 'none';

        // Add logic for new sensor types
        if (this.value === 'NEW_SENSOR_TYPE_1') {
            // Show/hide fields specific to NEW_SENSOR_TYPE_1
        } else if (this.value === 'NEW_SENSOR_TYPE_2') {
            // Show/hide fields specific to NEW_SENSOR_TYPE_2
        }
    });

    // Function to initialize sensor buttons
    function initializeSensorButtons() {
        document.querySelectorAll('.remove-sensor').forEach(button => {
            button.removeEventListener('click', handleRemoveSensor);
            button.addEventListener('click', handleRemoveSensor);
        });
    }

    // Function to handle sensor removal
    function handleRemoveSensor(event) {
        event.preventDefault();
        const sensorIndex = parseInt(this.getAttribute('data-index'), 10);
        const sensorLabel = this.closest('.collection-item').querySelector('div').textContent.trim().split(' (')[0];
        console.log(`Attempting to remove sensor: ${sensorLabel} at index: ${sensorIndex}`);

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
                body: JSON.stringify({ 
                    index: sensorIndex,
                    label: sensorLabel  // Add the label for better identification
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(result => {
                if (result.success || result.message) {
                    M.toast({html: result.message || 'Sensor removed successfully'});
                    // Force a complete page reload to ensure everything is in sync
                    window.location.reload();
                } else {
                    M.toast({html: result.error || 'Error removing sensor'});
                }
            })
            .catch(error => {
                console.error('Error removing sensor:', error);
                M.toast({html: `Error: ${error.message}`});
            });
        };
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

    // Initialize the edit sensor modal
    const editSensorModal = document.querySelector('#editSensorModal');
    M.Modal.init(editSensorModal);

    // Add event listener for the "Edit Sensor" button
    document.querySelectorAll('.edit-sensor').forEach(button => {
        button.addEventListener('click', function() {
            const sensorIndex = this.getAttribute('data-index');
            const sensorLabel = this.getAttribute('data-label');

            // Populate the form with the current sensor data
            document.getElementById('editSensorIndex').value = sensorIndex;
            document.getElementById('editSensorLabel').value = sensorLabel;
            // Populate other fields as necessary

            // Open the modal
            const instance = M.Modal.getInstance(editSensorModal);
            instance.open();
        });
    });

    // Handle the edit sensor form submission
    const editSensorForm = document.querySelector('#editSensorForm');
    if (editSensorForm) {
        editSensorForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const sensorIndex = document.getElementById('editSensorIndex').value;
            const sensorLabel = document.getElementById('editSensorLabel').value;
            // Get other updated properties

            const updatedSensorData = {
                index: sensorIndex,
                label: sensorLabel,
                // Include other properties
            };

            window.fetchWithCsrf('/edit_sensor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedSensorData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    M.toast({html: 'Sensor updated successfully'});
                    refreshSensorList();
                    const instance = M.Modal.getInstance(editSensorModal);
                    instance.close();
                } else {
                    M.toast({html: `Error updating sensor: ${data.error}`});
                }
            })
            .catch(error => {
                console.error('Error updating sensor:', error);
                M.toast({html: 'Error updating sensor'});
            });
        });
    }
});