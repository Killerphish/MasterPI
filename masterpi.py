import logging
from logging.handlers import RotatingFileHandler
from quart import Quart, jsonify, request
from temperature_sensor import TemperatureSensor
from pid_controller import PIDController
from fan_control import FanController  # Import FanController class
from database import save_settings_to_db, get_settings_from_db, insert_temperature_data, get_last_24_hours_temperature_data, init_db
import digitalio
import adafruit_blinka
import board
import os
import aiohttp  # Import aiohttp
import sqlite3  # Import sqlite3 for database operations
from meater import MeaterApi  # Import the MeaterApi class
import nest_asyncio  # Import nest_asyncio
import asyncio  # Import asyncio
import adafruit_dht  # Import the adafruit_dht module
from hypercorn.asyncio import serve
from hypercorn.config import Config

# Apply nest_asyncio to allow nested event loops
nest_asyncio.apply()

app = Quart(__name__)
app.config['DEBUG'] = True
app.secret_key = 'your_secret_key'  # Add a secret key for session management
app.config['REQUEST_TIMEOUT'] = 60  # Set request timeout to 60 seconds

# Setup logging
if not os.path.exists('logs'):
    os.mkdir('logs')
file_handler = RotatingFileHandler('logs/app.log', maxBytes=10240, backupCount=10)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'))
file_handler.setLevel(logging.INFO)
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)
app.logger.info('Application startup')

# Initialize temperature sensor (using GPIO18 for CS pin)
sensor = TemperatureSensor(board.D18)

# Initialize PID controller
pid = PIDController(kp=1.0, ki=0.1, kd=0.01, setpoint=30.0)

# Initialize FanController
fan_controller = FanController(fan_pin=27, target_temperature=50.0)  # Adjust this based on actual GPIO pin

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
def index():
    return render_template('index.html')

@app.route('/settings.html')
def settings():
    return render_template('settings.html')

@app.route('/get_temperature', methods=['GET'])
def get_temperature():
    try:
        temperature = sensor.read_temperature()
        return jsonify({'temperature': temperature})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_meater_temperature', methods=['GET'])
async def get_meater_temperature():
    app.logger.info('Fetching Meater temperature...')
    try:
        devices = await meater_api.devices()
        app.logger.info(f'Devices response: {devices}')
        if devices and 'data' in devices and devices['data']:
            device = devices['data'][0]  # Assuming you are using the first Meater device
            temperature = device['temperature']['internal']
            app.logger.info(f'Meater temperature fetched successfully: {temperature}')
            return jsonify({'temperature': temperature})
        app.logger.error('No Meater device or probe found')
        return jsonify({'error': 'No Meater device or probe found'}), 404
    except aiohttp.ClientError as e:
        app.logger.error(f"Network error fetching Meater temperature: {e}")
        return jsonify({'error': 'Network error'}), 500
    except Exception as e:
        app.logger.error(f"Error fetching Meater temperature: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

# Endpoint to get Meater devices
@app.route('/meater/devices', methods=['GET'])
def get_meater_devices():
    # Check if the token is stored in the session
    if 'meater_token' not in session:
        return jsonify({'error': 'Meater integration not enabled or token missing'}), 401

    token = session['meater_token']
    headers = {
        'Authorization': f'Bearer {token}'
    }
    response = requests.get('https://public-api.cloud.meater.com/v1/devices', headers=headers)
    
    if response.status_code != 200:
        return jsonify({'error': 'Failed to fetch Meater devices'}), response.status_code

    devices = response.json().get('data', {}).get('devices', [])
    return jsonify({'devices': devices})

# Endpoint to enable Meater integration
@app.route('/meater/enable', methods=['POST'])
def enable_meater_integration():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    # Make a request to the Meater login endpoint to get the token
    response = requests.post('https://public-api.cloud.meater.com/v1/login', json={
        'email': email,
        'password': password
    })

    if response.status_code != 200:
        return jsonify({'error': 'Failed to login to Meater'}), response.status_code

    token = response.json().get('data', {}).get('token')
    if not token:
        return jsonify({'error': 'Token not received from Meater'}), 500

    # Store the token in the session
    session['meater_token'] = token
    return jsonify({'success': True})

@app.route('/manifest.json')
def manifest():
    try:
        # Specify the directory where manifest.json is located
        manifest_dir = os.path.abspath(os.path.dirname(__file__))
        app.logger.debug(f"Manifest directory: {manifest_dir}")
        
        # Check if the file exists
        manifest_path = os.path.join(manifest_dir, 'manifest.json')
        if not os.path.exists(manifest_path):
            app.logger.error(f"Manifest file not found at path: {manifest_path}")
            return "Manifest file not found", 404
        
        return send_from_directory(manifest_dir, 'manifest.json')
    except Exception as e:
        app.logger.error(f"Error serving manifest.json: {e}", exc_info=True)
        return str(e), 500
    
@app.route('/update_target_temperature', methods=['POST'])
def update_target_temperature():
    global fan_controller  # Access the global variable

    data = request.get_json()
    target_temp = data.get('target_temp', 0)

    if fan_controller is None:
        # Initialize FanController with GPIO pin and initial target temperature
        fan_controller = FanController(fan_pin=27, target_temperature=float(target_temp))
    else:
        # Update target temperature in existing FanController instance
        fan_controller.set_target_temperature(float(target_temp))
    
    try:
        # Example: Read current temperature from sensor
        current_temperature = sensor.read_temperature()
        
        # Compute new fan speed based on updated setpoint and current temperature
        fan_speed = fan_controller.update(current_temperature)
        
        # Logic to control the fan based on fan_speed (if needed)
        
        return jsonify({'status': 'success', 'target_temp': target_temp})
    
    except Exception as e:
        app.logger.error(f"Error updating target temperature: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/emergency_shutdown', methods=['POST'])
def emergency_shutdown():
    # Logic to turn off the fan
    # For example, setting the fan GPIO pin to LOW
    fan_pin = digitalio.DigitalInOut(board.D27)  # Fan GPIO pin
    fan_pin.direction = digitalio.Direction.OUTPUT
    fan_pin.value = False  # Turn off the fan
    return jsonify({'status': 'success'})

@app.route('/get_status')
def get_status():
    current_temperature = sensor.read_temperature()  # Example: Read current temperature from sensor
    fan_speed = fan_controller.update(current_temperature)  # Update fan control based on temperature
    fan_on = fan_controller.is_fan_on()  # Check fan state

    return jsonify({
        'temperature': current_temperature,
        'fan_on': fan_on,
        'fan_speed': fan_speed  # Optionally return fan speed for visualization
    })


@app.route('/update_pid', methods=['POST'])
def update_pid():
    data = request.get_json()
    Kp = data.get('kp', 1.0)
    Ki = data.get('ki', 0.1)
    Kd = data.get('kd', 0.01)
    pid.set_parameters(Kp, Ki, Kd)
    return jsonify({'status': 'success', 'Kp': Kp, 'Ki': Ki, 'Kd': Kd})

@app.route('/get_settings', methods=['GET'])
def get_settings():
    settings = get_settings_from_db()
    return jsonify(settings)

@app.route('/save_settings', methods=['POST'])
def save_settings():
    form_data = request.form
    device_name = form_data.get('device_name')
    temp_offset = form_data.get('temp_offset')
    temp_unit = form_data.get('temp_unit')
    
    # Save settings to the database
    success = save_settings_to_db(device_name, temp_offset, temp_unit)
    
    return jsonify({'success': True})

@app.route('/pid_autotune', methods=['POST'])
def pid_autotune():
    try:
        # Start PID autotune process
        success = start_pid_autotune()  # Call your defined function here

        if success:
            return jsonify({'success': True}), 200
        else:
            return jsonify({'success': False}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route('/autotune_status')
def autotune_status():
    # Check autotune status and retrieve results
    if autotune_in_progress():
        return jsonify({'success': False})
    else:
        autotune_results = get_autotune_results()  # Implement this function to retrieve results
        return jsonify({'success': True, 'results': autotune_results})

@app.route('/get_meater_status', methods=['GET'])
def get_meater_status():
    # Replace with actual logic to get Meater status
    status = {
        "connected": True,
        "temperature": 75.0
    }
    return jsonify(status)

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
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

if __name__ == '__main__':
    async def main():
        await create_aiohttp_session()
        config = Config()
        config.bind = ["0.0.0.0:5000"]
        try:
            await serve(app, config)
        finally:
            await aiohttp_session.close()  # Ensure the aiohttp session is closed properly

    asyncio.run(main())