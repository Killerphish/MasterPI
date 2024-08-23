import { showModal, hideModal } from './modal.js';
import { updateStatus, handleFetchError } from './status.js';
import { requestMeaterApiKey } from './api.js';

let tempUnit = 'F'; // Default unit changed to Fahrenheit

console.log('settings.js loaded');

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
    } else {
        console.error('Settings form not found');
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

    // Fetch settings to get the temperature unit
    fetch('/get_settings')
        .then(response => response.json())
        .then(settings => {
            tempUnit = settings.units.temperature;
        })
        .catch(error => {
            console.error('Error fetching settings:', error);
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
        const csPin = this.getAttribute('data-cs-pin');
        const label = this.getAttribute('data-label');

        // Create or update the edit form
        let editForm = document.getElementById(`editSensorForm-${sensorIndex}`);
        if (!editForm) {
            editForm = createEditForm(sensorIndex, csPin, label);
            document.body.appendChild(editForm);
        } else {
            updateEditForm(editForm, sensorIndex, csPin, label);
        }

        // Open the modal
        const modalId = `editSensorModal-${sensorIndex}`;
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = createEditModal(modalId, editForm);
            document.body.appendChild(modal);
        }
        const instance = M.Modal.init(modal);
        instance.open();
    }

    // Function to create edit form
    function createEditForm(index, csPin, label) {
        const form = document.createElement('form');
        form.id = `editSensorForm-${index}`;
        form.innerHTML = `
            <input type="hidden" name="index" value="${index}">
            <div class="input-field">
                <input type="text" name="cs_pin" value="${csPin}" required>
                <label for="cs_pin">CS Pin</label>
            </div>
            <div class="input-field">
                <input type="text" name="label" value="${label}" required>
                <label for="label">Label</label>
            </div>
            <button type="submit" class="btn">Save Changes</button>
        `;
        form.addEventListener('submit', handleEditFormSubmit);
        return form;
    }

    // Function to update existing edit form
    function updateEditForm(form, index, csPin, label) {
        form.querySelector('input[name="index"]').value = index;
        form.querySelector('input[name="cs_pin"]').value = csPin;
        form.querySelector('input[name="label"]').value = label;
    }

    // Function to create edit modal
    function createEditModal(id, form) {
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h4>Edit Sensor</h4>
            </div>
        `;
        modal.querySelector('.modal-content').appendChild(form);
        return modal;
    }

    // Function to handle edit form submission
    function handleEditFormSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const data = {
            index: formData.get('index'),
            cs_pin: formData.get('cs_pin'),
            label: formData.get('label')
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
                window.location.reload();  // Reload the page to reflect the edited sensor
            } else {
                M.toast({html: `Error: ${result.error}`});
            }
        })
        .catch(error => {
            console.error('Error editing sensor:', error);
            M.toast({html: `Error: ${error.message}`});
        });
    }

    // Function to get CSRF token
    function getCsrfToken() {
        const tokenInput = document.querySelector('input[name="csrf_token"]');
        return tokenInput ? tokenInput.value : null;
    }

    // Function to fetch available pins
    function fetchAvailablePins() {
        fetch(getAvailablePinsUrl)
            .then(response => response.json())
            .then(pins => {
                const selectElement = document.getElementById('newSensorCsPin');
                selectElement.innerHTML = ''; // Clear existing options
                pins.forEach(pin => {
                    const option = document.createElement('option');
                    option.value = pin;
                    option.textContent = pin;
                    selectElement.appendChild(option);
                });
                M.FormSelect.init(selectElement); // Reinitialize Materialize select
            })
            .catch(error => {
                console.error('Error fetching available pins:', error);
                M.toast({html: 'Error fetching available pins'});
            });
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
});

// Log any errors that occur when the script runs
window.onerror = function(message, source, lineno, colno, error) {
    console.error('An error occurred:', message, 'at', source, 'line', lineno, 'column', colno, 'Error object:', error);
};