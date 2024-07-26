import logging
from logging.handlers import RotatingFileHandler
from quart import Quart, jsonify, request, render_template, send_from_directory, session
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

# Load configuration from config.yaml
def load_config():
    with open('config.yaml', 'r') as config_file:
        return yaml.safe_load(config_file)

def save_config(config):
    with open('config.yaml', 'w') as config_file:
        yaml.safe_dump(config, config_file)

config = load_config()

# Apply nest_asyncio to allow nested event loops
nest_asyncio.apply()

app = Quart(__name__)
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

# Initialize temperature sensors based on settings
print("Initializing temperature sensors...")
sensors = []
sensor_configs = config['sensors']
for sensor_config in sensor_configs:
    sensor_type = sensor_config['type']
    try:
        # if sensor_type == 'MAX31865':
        #     from adafruit_max31865 import MAX31865
        #     cs_pin = getattr(board, sensor_config['chip_select_pin'])
        #     sensor = MAX31865(board.SPI(), digitalio.DigitalInOut(cs_pin))
        if sensor_type == 'MAX31855':
            from adafruit_max31855 import MAX31855
            cs_pin = getattr(board, sensor_config['chip_select_pin'])
            sensor = MAX31855(board.SPI(), digitalio.DigitalInOut(cs_pin))
            sensors.append(sensor)
        # elif sensor_type == 'ADS1115':
        #     from adafruit_ads1x15.analog_in import AnalogIn
        #     from adafruit_ads1x15.ads1115 import ADS1115
        #     i2c = board.I2C()
        #     address = sensor_config.get('address', 0x48)  # Default to 0x48 if not specified
        #     try:
        #         ads = ADS1115(i2c, address=address)
        #         sensor = AnalogIn(ads, sensor_config['channel'])
        #         sensors.append(sensor)
        #     except ValueError as e:
        #         app.logger.error(f"ADS1115 not found at address {address}: {e}")
        #         continue  # Skip this sensor
    except Exception as e:
        app.logger.error(f"Error initializing {sensor_type}: {e}")
print("Temperature sensors initialized.")

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
    return await render_template('index.html')

@app.route('/settings.html')
async def settings():
    return await render_template('settings.html')

@app.route('/get_temperature', methods=['GET'])
def get_temperature():
    try:
        print("Reading temperature from sensors...")
        temperatures = [sensor.temperature for sensor in sensors]
        print(f"Temperatures read: {temperatures} °C")
        return jsonify({'temperatures': temperatures})
    except Exception as e:
        app.logger.error(f"Error reading temperature: {e}")
        return jsonify({"error": str(e)}), 500

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
    if temperature is None:
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
        minutes = request.args.get('minutes', default=1440, type=int)  # Default to 24 hours
        data = get_temperature_data_by_range(minutes)
        return jsonify(data)
    except Exception as e:
        app.logger.error(f"Error fetching temperature data: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

def get_temperature_data_by_range(minutes):
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('''
        SELECT timestamp, temperature 
        FROM temperature_data 
        WHERE timestamp >= datetime('now', ? || ' minutes') 
        ORDER BY timestamp ASC
    ''', (-minutes,))
    data = c.fetchall()
    conn.close()
    return data

@app.route('/init_db', methods=['POST'])
def initialize_database():
    try:
        init_db()
        return jsonify({'status': 'success'})
    except Exception as e:
        app.logger.error(f"Error initializing database: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

async def get_meater_api_token(email, password):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post('https://public-api.cloud.meater.com/v1/login', json={
                'email': email,
                'password': password
            }) as response:
                response.raise_for_status()
                data = await response.json()
                return data['data']['token']
    except aiohttp.ClientError as e:
        app.logger.error(f"Error fetching Meater API token: {e}")
        raise

@app.route('/save_general_settings', methods=['POST'])
async def save_general_settings():
    try:
        form_data = await request.form
        device_name = form_data.get('device_name')

        if not device_name:
            raise ValueError("Device name is required.")

        config = load_config()

        # Update config with new settings
        config['device']['name'] = device_name

        save_config(config)

        return jsonify({'success': True})
    except ValueError as ve:
        app.logger.error(f"Validation error: {ve}")
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        app.logger.error(f"Error saving general settings: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal Server Error'}), 500

@app.route('/save_device_settings', methods=['POST'])
async def save_device_settings():
    try:
        form_data = await request.form
        temp_offset = form_data.get('temp_offset')
        sensor_type = form_data.get('sensor_type')
        sensor_count = form_data.get('sensor_count')

        if not sensor_type or not sensor_count:
            raise ValueError("Sensor type and count are required.")

        config = load_config()

        # Update config with new settings
        config['sensors'] = [{'type': sensor_type, 'chip_select_pin': f'D{i+18}', 'channel': i} for i in range(int(sensor_count))]

        save_config(config)

        return jsonify({'success': True})
    except ValueError as ve:
        app.logger.error(f"Validation error: {ve}")
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        app.logger.error(f"Error saving device settings: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal Server Error'}), 500

@app.route('/get_settings', methods=['GET'])
async def get_settings():
    try:
        config = load_config()
        return jsonify(config)
    except Exception as e:
        app.logger.error(f"Error fetching settings: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/get_status', methods=['GET'])
async def get_status():
    try:
        # Example status data, replace with actual status logic
        status = {
            'app': 'Temperature Control System',
            'version': '1.0.0',
            'status': 'running',
            'sensors': [sensor.__class__.__name__ for sensor in sensors],
            'temperature': sensors[0].temperature if sensors else None  # Example temperature data
        }
        return jsonify(status)
    except Exception as e:
        app.logger.error(f"Error fetching status: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

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

        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error saving integration settings: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal Server Error'}), 500

@app.route('/pid_autotune', methods=['POST'])
async def pid_autotune():
    try:
        # Replace with actual logic to start PID autotune
        # For example, you might call a method on your PIDController instance
        pid.start_autotune()
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error starting PID autotune: {e}")
        return jsonify({'success': False, 'error': 'Internal Server Error'}), 500

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