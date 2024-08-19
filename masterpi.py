import logging
from logging.handlers import RotatingFileHandler
from quart import Quart, jsonify, request, render_template, send_from_directory, session, redirect, url_for, flash, get_flashed_messages, send_file
from quart_csrf import CSRFProtect, generate_csrf
from temperature_sensor import TemperatureSensor
from pid_controller import PIDController
from fan_control import FanController
from database import insert_temperature_data, get_last_24_hours_temperature_data, init_db
import digitalio
import adafruit_blinka
import board
import os
import aiohttp
import sqlite3
from meater import MeaterApi
import nest_asyncio
import asyncio
import adafruit_dht
from hypercorn.asyncio import serve
from hypercorn.config import Config
import ssl
import yaml
import busio
from adafruit_max31865 import MAX31865
from adafruit_max31856 import MAX31856
from adafruit_max31855 import MAX31855  # Add this import
import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn

# Load configuration from config.yaml
def load_config():
    try:
        with open('config.yaml', 'r') as config_file:
            print("Config file opened successfully")
            config = yaml.safe_load(config_file)
            print("Config file loaded successfully")
            return config
    except Exception as e:
        print(f"Error loading config file: {e}")
        raise

def save_config(config):
    try:
        with open('config.yaml', 'w') as config_file:
            yaml.safe_dump(config, config_file)
        app.logger.info("Configuration saved successfully.")
    except Exception as e:
        app.logger.error(f"Error saving configuration: {e}")
        raise

config = load_config()

# Apply nest_asyncio to allow nested event loops
nest_asyncio.apply()

app = Quart(__name__)
csrf = CSRFProtect(app)
app.config['DEBUG'] = config['app']['debug']
app.secret_key = 'your_secret_key'  # Add a secret key for session management
app.config['REQUEST_TIMEOUT'] = 60  # Set request timeout to 60 seconds

# Setup logging
if not os.path.exists('logs'):
    os.mkdir('logs')
file_handler = RotatingFileHandler(config['logging']['filename'], maxBytes=10240, backupCount=10)
file_handler.setFormatter(logging.Formatter(config['logging']['format']))
file_handler.setLevel(logging.INFO)
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)
app.logger.info('Application startup')

# Context processor to inject CSRF token into templates
@app.context_processor
def inject_csrf_token():
    token = generate_csrf()
    app.logger.debug(f"Generated CSRF token: {token}")
    return dict(csrf_token=token)

# Initialize temperature sensors based on settings
print("Initializing temperature sensors...")
def initialize_sensors(config):
    sensors = []
    sensor_configs = config['sensors']

    for sensor_config in sensor_configs:
        sensor_type = sensor_config['type']
        enabled = sensor_config.get('enabled', True)  # Default to True if not specified
        try:
            temp_offset = float(sensor_config.get('temp_offset', 0.0))
            if sensor_type == 'MAX31865':
                spi = busio.SPI(clock=board.SCLK, MISO=board.MISO, MOSI=board.MOSI)
                cs_pin = getattr(board, sensor_config['chip_select_pin'])
                cs = digitalio.DigitalInOut(cs_pin)
                sensor = MAX31865(spi, cs, rtd_nominal=sensor_config['rtd_type'], ref_resistor=sensor_config['reference_resistor'])
                sensors.append((sensor, temp_offset, enabled))
                app.logger.info(f"Initialized {sensor_type} sensor on pin {sensor_config['chip_select_pin']}")
            elif sensor_type == 'MAX31855':
                spi = busio.SPI(clock=board.SCLK, MISO=board.MISO)
                cs_pin = getattr(board, sensor_config['chip_select_pin'])
                cs = digitalio.DigitalInOut(cs_pin)
                sensor = MAX31855(spi, cs)
                sensors.append((sensor, temp_offset, enabled))
                app.logger.info(f"Initialized {sensor_type} sensor on pin {sensor_config['chip_select_pin']}")
            elif sensor_type == 'MAX31856':
                spi = busio.SPI(clock=board.SCLK, MISO=board.MISO, MOSI=board.MOSI)
                cs_pin = getattr(board, sensor_config['chip_select_pin'])
                cs = digitalio.DigitalInOut(cs_pin)
                sensor = MAX31856(spi, cs)
                sensors.append((sensor, temp_offset, enabled))
                app.logger.info(f"Initialized {sensor_type} sensor on pin {sensor_config['chip_select_pin']}")
            elif sensor_type == 'ADS1115':
                i2c = busio.I2C(board.SCL, board.SDA)
                ads = ADS.ADS1115(i2c, address=sensor_config['address'])
                sensor = AnalogIn(ads, getattr(ADS, f'P{sensor_config["channel"]}'))
                sensors.append((sensor, temp_offset, enabled))
                app.logger.info(f"Initialized {sensor_type} sensor on channel {sensor_config['channel']} with address {sensor_config['address']}")
            elif sensor_type == 'DHT22':
                sensor = adafruit_dht.DHT22(getattr(board, sensor_config['pin']))
                sensors.append((sensor, temp_offset, enabled))
                app.logger.info(f"Initialized {sensor_type} sensor on pin {sensor_config['pin']}")
        except Exception as e:
            app.logger.error(f"Error initializing {sensor_type} on pin {sensor_config.get('chip_select_pin', sensor_config.get('channel', 'N/A'))}: {e}")

    print("Temperature sensors initialized.")
    return sensors

# Initialize temperature sensors based on settings
print("Initializing temperature sensors...")
sensors = initialize_sensors(config)

# Initialize PID controller
pid = PIDController(kp=config['pid']['kp'], ki=config['pid']['ki'], kd=config['pid']['kd'], setpoint=config['pid']['target_temperature'])

# Initialize FanController
fan_controller = FanController(fan_pin=config['fan']['pin'], target_temperature=config['pid']['target_temperature'])

# Initialize aiohttp session and Meater API
aiohttp_session = None
meater_api = None

async def create_aiohttp_session():
    global aiohttp_session, meater_api
    aiohttp_session = aiohttp.ClientSession()
    meater_api = MeaterApi(aiohttp_session)

# Initialize the DHT22 sensor
dht_device = adafruit_dht.DHT22(board.D18)

@app.route('/')
async def index():
    return await render_template('index.html', device_name=config['device']['name'])

@app.route('/settings.html')
async def settings():
    config = load_config()
    messages = get_flashed_messages(with_categories=True)
    sensors = config.get('sensors', [])
    units = config.get('units', {})
    device_name = config['device']['name']  # Get device name from config
    return await render_template('settings.html', messages=messages, sensors=sensors, device_name=device_name, units=units)

@app.route('/get_temperature', methods=['GET'])
def get_temperature():
    try:
        print("Reading temperature from sensors...")
        temperatures = []
        for sensor, offset in sensors:
            try:
                if isinstance(sensor, MAX31865):
                    # Read temperature from MAX31865 sensor
                    temperature_celsius = sensor.temperature
                elif isinstance(sensor, MAX31855):
                    # Read temperature from MAX31855 sensor
                    temperature_celsius = sensor.temperature
                elif isinstance(sensor, MAX31856):
                    # Read temperature from MAX31856 sensor
                    temperature_celsius = sensor.temperature
                elif isinstance(sensor, AnalogIn):
                    # Read voltage from ADS1115 sensor
                    voltage = sensor.voltage
                    # Convert voltage to temperature; you need to implement the correct formula here
                    temperature_celsius = voltage_to_temperature(voltage)
                elif isinstance(sensor, adafruit_dht.DHT22):
                    # Read temperature from DHT22 sensor
                    temperature_celsius = sensor.temperature
                else:
                    raise ValueError("Unsupported sensor type")

                corrected_temperature_celsius = temperature_celsius + offset
                temperature_fahrenheit = (corrected_temperature_celsius * 9/5) + 32 if config['units']['temperature'] == 'Fahrenheit' else corrected_temperature_celsius
                
                temperatures.append(temperature_fahrenheit)
                app.logger.info(f"Read temperature: {temperature_fahrenheit} {'°F' if config['units']['temperature'] == 'Fahrenheit' else '°C'} from {sensor.__class__.__name__}")
            except Exception as e:
                app.logger.error(f"Error reading temperature from {sensor.__class__.__name__}: {e}")
                temperatures.append(None)
        
        print(f"Temperatures read: {temperatures}")
        return jsonify({'temperatures': temperatures})
    except Exception as e:
        app.logger.error(f"Error reading temperature: {e}")
        return jsonify({"error": str(e)}), 500

def voltage_to_temperature(voltage):
    # Implement this function based on the sensor and its characteristics
    # Example for an LM35 temperature sensor: temperature_C = voltage * 100
    # Adjust as needed for your setup
    return voltage * 100  # Replace this with the actual conversion formula

@app.route('/get_meater_temperature', methods=['GET'])
async def get_meater_temperature():
    try:
        temperature = await fetch_meater_temperature()
        return jsonify({'temperature': temperature})
    except Exception as e:
        app.logger.error(f"Error fetching Meater temperature: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

async def fetch_meater_temperature():
    # Replace with actual logic to fetch Meater temperature
    # Replace with actual implementation
    try:
        # Simulate fetching temperature from Meater API
        temperature = 75.0  # Example temperature value
        return temperature
    except Exception as e:
        raise e

# Endpoint to get Meater devices
@app.route('/get_meater_status', methods=['GET'])
def get_meater_status():
    # Replace with actual logic to get Meater status
    status = {
        "connected": True,
        "temperature": 75.0
    }
    return jsonify(status)

@app.route('/favicon.ico')
async def favicon():
    return await send_from_directory(os.path.join(app.root_path, 'static'),
                                     'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/save_temperature', methods=['POST'])
def save_temperature():
    data = request.get_json()
    temperature = data.get('temperature')
    if (temperature is None):
        return jsonify({'error': 'Temperature is required'}), 400

    try:
        insert_temperature_data(temperature)
        app.logger.info(f"Temperature data saved: {temperature}")
        return jsonify({'status': 'success'})
    except Exception as e:
        app.logger.error(f"Error saving temperature: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/get_temperature_data', methods=['GET'])
def get_temperature_data():
    try:
        data = get_last_24_hours_temperature_data()
        return jsonify(data)
    except Exception as e:
        app.logger.error(f"Error fetching temperature data: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/get_settings', methods=['GET'])
def get_settings():
    try:
        config = load_config()
        return jsonify(config)
    except Exception as e:
        app.logger.error(f"Error fetching settings: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/save_device_settings', methods=['POST'])
async def save_device_settings():
    try:
        form_data = await request.form
        device_name = form_data.get('device_name')
        temp_unit = form_data.get('temp_unit')

        app.logger.debug(f"Received form data: {form_data}")  # Add this line to print form data
        app.logger.debug(f"Received device_name: {device_name}")
        app.logger.debug(f"Received temp_unit: {temp_unit}")

        if not device_name:
            raise ValueError("Device name is required")

        config = load_config()

        # Update config with new settings
        config['device']['name'] = device_name
        config['units']['temperature'] = temp_unit

        app.logger.debug(f"Updated config: {config}")

        save_config(config)

        await flash('Device settings saved successfully!', 'success')
        return redirect(url_for('settings'))
    except Exception as e:
        app.logger.error(f"Error saving device settings: {e}", exc_info=True)
        await flash('Internal Server Error', 'error')
        return redirect(url_for('settings'))

@app.route('/save_integration_settings', methods=['POST'])
async def save_integration_settings():
    try:
        form_data = await request.form
        meater_enabled = form_data.get('meater_enabled') == 'true'
        meater_username = form_data.get('meater_username')
        meater_password = form_data.get('meater_password')

        app.logger.info(f"Form Data: {form_data}")  # Debugging line

        config = load_config()

        # Update config with new settings
        config['meater_integration']['enabled'] = meater_enabled
        config['meater_integration']['username'] = meater_username
        config['meater_integration']['password'] = meater_password

        save_config(config)

        await flash('Integration settings saved successfully!', 'success')
        return redirect(url_for('settings'))
    except Exception as e:
        app.logger.error(f"Error saving integration settings: {e}", exc_info=True)
        await flash('Internal Server Error', 'error')
        return redirect(url_for('settings'))

@app.route('/pid_autotune', methods=['POST'])
async def pid_autotune():
    try:
        # Replace with actual logic to start PID autotune
        # For example, you might call a method on your PIDController instance
        pid.start_autotune()
        await flash('PID autotune started successfully!', 'success')
        return redirect(url_for('settings'))
    except Exception as e:
        app.logger.error(f"Error starting PID autotune: {e}")
        await flash('Error starting PID autotune', 'error')
        return redirect(url_for('settings'))

# Check if the wizard has been completed
@app.before_request
async def check_wizard():
    # Only check if the wizard has not been completed
    if not config.get('app', {}).get('wizard_completed', False):
        app.logger.info("Wizard not completed, redirecting to wizard setup page.")
        # Redirect to the wizard setup page if not completed
        if request.endpoint not in ['wizard', 'complete_wizard', 'static']:
            return redirect(url_for('wizard'))

@app.route('/wizard', methods=['GET'])
async def wizard():
    app.logger.info("Rendering wizard setup page.")
    return await render_template('wizard.html')  # Ensure wizard.html is in the templates folder

@app.route('/complete_wizard', methods=['POST'])
async def complete_wizard():
    form_data = await request.form  # Await the request.form to get the form data
    device_name = form_data.get('device_name')
    temp_unit = form_data.get('temp_unit')

    # Update the configuration with the new settings
    config['device'] = {'name': device_name}
    config['units']['temperature'] = temp_unit
    config['app']['wizard_completed'] = True  # Set the wizard as completed

    save_config(config)  # Save the updated configuration

    # Log the updated configuration
    app.logger.info(f"Updated configuration: {config}")

    # Redirect to the main page
    return redirect(url_for('index'))

@app.route('/api/status', methods=['GET'])
async def get_status():
    try:
        # Fetch the current temperature from your sensor
        current_temperature = await get_current_temperature()
        fan_status = fan_controller.is_fan_on()

        status = {
            'status': 'OK',
            'message': 'Server is running',
            'temperature': current_temperature,  # Dynamic temperature value
            'fan_on': fan_status  # Dynamic fan status
        }
        return jsonify(status)
    except Exception as e:
        app.logger.error(f"Error fetching status: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

async def get_current_temperature():
    try:
        temperature = await read_sensor_temperature()
        return temperature
    except Exception as e:
        app.logger.error(f"Error fetching current temperature: {e}", exc_info=True)
        return 75.0  # Return a default value or handle the error appropriately

async def read_sensor_temperature():
    try:
        temperatures = []
        for sensor, offset, enabled in sensors:
            if not enabled:
                continue  # Skip disabled sensors

            try:
                if isinstance(sensor, MAX31865):
                    temperature_celsius = sensor.temperature
                elif isinstance(sensor, MAX31855):
                    temperature_celsius = sensor.temperature
                elif isinstance(sensor, MAX31856):
                    temperature_celsius = sensor.temperature
                elif isinstance(sensor, AnalogIn):
                    voltage = sensor.voltage
                    temperature_celsius = voltage_to_temperature(voltage)
                elif isinstance(sensor, adafruit_dht.DHT22):
                    temperature_celsius = sensor.temperature
                else:
                    raise ValueError("Unsupported sensor type")

                corrected_temperature_celsius = temperature_celsius + offset
                temperatures.append(corrected_temperature_celsius)
            except RuntimeError as e:
                app.logger.error(f"Error reading temperature from {sensor.__class__.__name__}: {e}")
                temperatures.append(None)  # Append None or a default value in case of error

        if temperatures:
            valid_temperatures = [temp for temp in temperatures if temp is not None]
            if valid_temperatures:
                return sum(valid_temperatures) / len(valid_temperatures)
            else:
                raise ValueError("No valid temperatures read from sensors")
        else:
            raise ValueError("No temperatures read from sensors")
    except Exception as e:
        app.logger.error(f"Error reading sensor temperature: {e}", exc_info=True)
        raise

@app.route('/set_target_temperature', methods=['POST'])
async def set_target_temperature():
    try:
        data = await request.get_json()
        target_temperature = data.get('target_temperature')
        if target_temperature is None:
            app.logger.error('Target temperature is required')
            return jsonify({'error': 'Target temperature is required'}), 400

        # Update the target temperature in your PID controller or other relevant component
        pid.setpoint = float(target_temperature)
        fan_controller.target_temperature = float(target_temperature)
        app.logger.info(f"Target temperature set to: {target_temperature}")
        return jsonify({'status': 'success'})
    except Exception as e:
        app.logger.error(f"Error setting target temperature: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Add this route to handle the removal of a sensor
@app.route('/remove_sensor', methods=['POST'])
async def remove_sensor():
    try:
        form_data = await request.form
        sensor_index = int(form_data.get('index'))

        # Load the current configuration
        config = load_config()

        # Remove the sensor from the configuration
        if 'sensors' in config and 0 <= sensor_index < len(config['sensors']):
            del config['sensors'][sensor_index]
            save_config(config)
            await flash('Sensor removed successfully!', 'success')
        else:
            await flash('Invalid sensor index.', 'error')

        return redirect(url_for('settings'))
    except Exception as e:
        app.logger.error(f"Error removing sensor: {e}", exc_info=True)
        await flash('Internal Server Error', 'error')
        return redirect(url_for('settings'))

@app.route('/view_config')
async def view_config():
    try:
        config = load_config()
        return await render_template('view_config.html', config=config)
    except Exception as e:
        app.logger.error(f"Error loading configuration: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/edit_config')
async def edit_config():
    try:
        config = load_config()
        csrf_token = generate_csrf()  # Generate CSRF token
        return await render_template('edit_config.html', config=config, csrf_token=csrf_token)
    except Exception as e:
        app.logger.error(f"Error loading configuration: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/save_config', methods=['POST'])
async def save_config_route():
    try:
        form_data = await request.form
        config_content = form_data.get('configContent')
        config = yaml.safe_load(config_content)
        save_config(config)
        await flash('Configuration saved successfully!', 'success')
        return redirect(url_for('view_config'))
    except Exception as e:
        app.logger.error(f"Error saving configuration: {e}", exc_info=True)
        await flash('Internal Server Error', 'error')
        return redirect(url_for('edit_config'))

if __name__ == '__main__':
    async def main():
        await create_aiohttp_session()
        init_db()  # Initialize the database
        config = Config()
        config.bind = ["127.0.0.1:5000"]  # Ensure this is correct
        try:
            await serve(app, config)
        finally:
            await aiohttp_session.close()  # Ensure the aiohttp session is closed properly

    asyncio.run(main())