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

    fetch('/save_settings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
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

// Function to get CSRF token from meta tag
function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
}

document.addEventListener("DOMContentLoaded", function() {
    console.log('DOM fully loaded');

    const settingsForm = document.getElementById('settingsForm');
    console.log('Settings form:', settingsForm);

    if (settingsForm) {
        console.log('Adding event listener to settings form');
        settingsForm.addEventListener('submit', function(event) {
            event.preventDefault();
            console.log('Form submitted');

            const formData = new FormData(settingsForm);
            const settings = Object.fromEntries(formData);

            fetch('/save_settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                },
                body: JSON.stringify(settings)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    M.toast({html: 'Settings saved successfully'});
                } else {
                    M.toast({html: 'Error saving settings'});
                }
            })
            .catch(error => {
                console.error('Error:', error);
                M.toast({html: 'Error saving settings'});
            });
        });
    }

    const editSensorForm = document.getElementById('editSensorForm');
    if (editSensorForm) {
        editSensorForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const sensorIndex = document.getElementById('editSensorIndex').value;
            const label = document.getElementById('editSensorLabel').value;
            const chipSelectPin = document.getElementById('editSensorCsPin').value;

            const data = {
                index: sensorIndex,
                label: label,
                chip_select_pin: chipSelectPin
            };

            fetch(saveSensorSettingsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken()
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                if (result.message) {
                    M.toast({html: result.message});
                    refreshSensorList();
                    M.Modal.getInstance(document.getElementById('editSensorModal')).close();
                } else {
                    M.toast({html: `Error: ${result.error}`});
                }
            })
            .catch(error => {
                console.error('Error saving sensor settings:', error);
                M.toast({html: `Error: ${error.message}`});
            });
        });
    }

    M.AutoInit();  // Initialize all Materialize components

    // Initialize modals
    const modals = document.querySelectorAll('.modal');
    M.Modal.init(modals);

    // Add this new event listener for the "Add Sensor" button
    const openAddSensorModalBtn = document.getElementById('openAddSensorModal');
    if (openAddSensorModalBtn) {
        openAddSensorModalBtn.addEventListener('click', function() {
            const addSensorModal = document.getElementById('addSensorModal');
            if (addSensorModal) {
                fetchAvailablePins();
                const instance = M.Modal.getInstance(addSensorModal);
                instance.open();
            } else {
                console.error('Add Sensor modal not found');
            }
        });
    } else {
        console.error('Open Add Sensor Modal button not found');
    }

    var elems = document.querySelectorAll('.tabs');
    var instances = M.Tabs.init(elems);

    // Ensure labels are correctly positioned
    M.updateTextFields();

    // Fetch settings to get the temperature unit and timezone
    fetch('/get_settings')
        .then(response => response.json())
        .then(settings => {
            tempUnit = settings.units.temperature;
            const timezone = settings.units.timezone;
            document.getElementById('timezone').value = timezone;  // Set the timezone dropdown value
        })
        .catch(error => {
            console.error('Error fetching settings:', error);
        });

    // Fetch and populate timezones
    fetch('/get_timezones')
        .then(response => response.json())
        .then(timezones => {
            const timezoneSelect = document.getElementById('timezone');
            timezones.forEach(tz => {
                const option = document.createElement('option');
                option.value = tz;
                option.textContent = tz;
                timezoneSelect.appendChild(option);
            });
            M.FormSelect.init(timezoneSelect);  // Reinitialize Materialize select
        })
        .catch(error => {
            console.error('Error fetching timezones:', error);
        });

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

    // Handle the "Add Sensor" form submission
    const addSensorForm = document.getElementById('addSensorForm');
    if (addSensorForm) {
        addSensorForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const sensorType = document.getElementById('newSensorType').value;
            const label = document.getElementById('newSensorLabel').value;
            const chipSelectPin = document.getElementById('newSensorCsPin').value;

            const data = {
                sensor_type: sensorType,
                label: label,
                chip_select_pin: chipSelectPin
            };

            fetch(addSensorUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken()
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                if (result.message) {
                    M.toast({html: result.message});
                    refreshSensorList();  // Refresh the sensor list after adding
                } else {
                    M.toast({html: `Error: ${result.error}`});
                }
            })
            .catch(error => {
                console.error('Error adding sensor:', error);
                M.toast({html: `Error: ${error.message}`});
            });
        });
    }

    // Function to handle removing a sensor
    function handleRemoveSensor(event) {
        event.preventDefault();
        const sensorIndex = this.getAttribute('data-index');
        
        if (confirm('Are you sure you want to remove this sensor?')) {
            fetch('/remove_sensor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken()
                },
                body: JSON.stringify({ index: sensorIndex })
            })
            .then(response => response.json())
            .then(result => {
                if (result.message) {
                    M.toast({html: result.message});
                    refreshSensorList();  // Refresh the sensor list after removing
                } else {
                    M.toast({html: `Error: ${result.error}`});
                }
            })
            .catch(error => {
                console.error('Error removing sensor:', error);
                M.toast({html: `Error: ${error.message}`});
            });
        }
    }

    // Function to handle editing a sensor
    function handleEditSensor(event) {
        event.preventDefault();
        const sensorIndex = this.getAttribute('data-index');
        const sensorLabel = this.getAttribute('data-label');
        const sensorCsPin = this.getAttribute('data-cs-pin');

        // Populate the edit form with the current sensor data
        document.getElementById('editSensorLabel').value = sensorLabel;
        document.getElementById('editSensorCsPin').value = sensorCsPin;
        document.getElementById('editSensorIndex').value = sensorIndex;

        // Open the edit sensor modal
        const editSensorModal = document.getElementById('editSensorModal');
        const instance = M.Modal.getInstance(editSensorModal);
        instance.open();
    }

    // Function to refresh sensor list
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
            })
            .catch(error => {
                console.error('Error refreshing sensor list:', error);
                M.toast({html: 'Error refreshing sensor list'});
            });
    }

    // Function to initialize sensor buttons
    function initializeSensorButtons() {
        document.querySelectorAll('.edit-sensor').forEach(button => {
            button.addEventListener('click', handleEditSensor);
        });
        document.querySelectorAll('.remove-sensor').forEach(button => {
            button.addEventListener('click', handleRemoveSensor);
        });
    }

    // Call this function when the page loads
    initializeSensorButtons();

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
});