import { showModal, hideModal } from './modal.js';
import { updateStatus, handleFetchError } from './status.js';
import { requestMeaterApiKey } from './api.js';

let tempUnit = 'F'; // Default unit changed to Fahrenheit

document.addEventListener("DOMContentLoaded", function() {
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
                    window.location.reload();  // Reload the page to reflect the new sensor
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

    // Handle the "Remove Sensor" form submission
    document.querySelectorAll('.remove-sensor').forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();

            const sensorIndex = this.getAttribute('data-index');

            fetch(removeSensorUrl, {
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
                    window.location.reload();  // Reload the page to reflect the removed sensor
                } else {
                    M.toast({html: `Error: ${result.error}`});
                }
            })
            .catch(error => {
                console.error('Error removing sensor:', error);
                M.toast({html: `Error: ${error.message}`});
            });
        });
    });

    // Handle the "Edit Sensor" form submission
    document.querySelectorAll('.edit-sensor').forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();

            const sensorIndex = this.getAttribute('data-index');
            const csPin = this.getAttribute('data-cs-pin');
            const label = this.getAttribute('data-label');

            const form = document.getElementById(`editSensorForm-${sensorIndex}`);
            form.querySelector('input[name="index"]').value = sensorIndex;
            form.querySelector('input[name="cs_pin"]').value = csPin;
            form.querySelector('input[name="label"]').value = label;

            const modal = document.getElementById(`editSensorModal-${sensorIndex}`);
            const instance = M.Modal.getInstance(modal);
            instance.open();
        });
    });

    document.querySelectorAll('[id^="editSensorForm-"]').forEach(form => {
        form.addEventListener('submit', function(event) {
            event.preventDefault();

            const formData = new FormData(form);
            const index = formData.get('index');
            const csPin = formData.get('cs_pin');
            const label = formData.get('label');

            const data = {
                index: index,
                cs_pin: csPin,
                label: label
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
        });
    });

    // Handle the "Save Personalization Settings" form submission
    const personalizationForm = document.getElementById('personalizationForm');
    if (personalizationForm) {
        personalizationForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const formData = new FormData(personalizationForm);

            fetch(savePersonalizationSettingsUrl, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken()
                },
                body: formData
            })
            .then(response => response.json())
            .then(result => {
                if (result.message) {
                    M.toast({html: result.message});
                    window.location.reload();
                } else {
                    M.toast({html: `Error: ${result.error}`});
                }
            })
            .catch(error => {
                console.error('Error saving personalization settings:', error);
                M.toast({html: `Error: ${error.message}`});
            });
        });
    }

    // Function to get CSRF token
    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
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
});