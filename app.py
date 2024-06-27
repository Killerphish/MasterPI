from flask import Flask, render_template, request, jsonify, send_from_directory
from temperature_sensor import TemperatureSensor
from pid_controller import PIDController
import board
import digitalio
import os
import logging
from logging.handlers import RotatingFileHandler
import time

app = Flask(__name__)

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
cs_pin = board.D18
temp_sensor = TemperatureSensor(cs_pin)

# Initialize PID controller
pid = PIDController(kp=1.0, ki=0.1, kd=0.01, setpoint=100.0)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/settings')
def settings():
    return render_template('settings.html')

@app.route('/get_temperature', methods=['GET'])
def get_temperature():
    temperature = temp_sensor.read_temperature()
    return jsonify({'temperature': temperature})

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
    data = request.get_json()
    target_temp = data.get('target_temp', 0)
    pid.setpoint = target_temp
    return jsonify({'status': 'success', 'target_temp': target_temp})

@app.route('/emergency_shutdown', methods=['POST'])
def emergency_shutdown():
    # Logic to turn off the fan
    # For example, setting the fan GPIO pin to LOW
    fan_pin = digitalio.DigitalInOut(board.D27)  #Fan GPIO pin
    fan_pin.direction = digitalio.Direction.OUTPUT
    fan_pin.value = False  # Turn off the fan
    return jsonify({'status': 'success'})

@app.route('/update_pid', methods=['POST'])
def update_pid():
    data = request.get_json()
    Kp = data.get('kp', 1.0)
    Ki = data.get('ki', 0.1)
    Kd = data.get('kd', 0.01)
    pid.set_parameters(Kp, Ki, Kd)
    return jsonify({'status': 'success', 'Kp': Kp, 'Ki': Ki, 'Kd': Kd})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)