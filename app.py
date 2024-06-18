from flask import Flask, render_template, request, jsonify
import RPi.GPIO as GPIO
import time
import threading
from simple_pid import PID
import board
import busio
import digitalio
import adafruit_max31865

app = Flask(__name__)

# GPIO setup
FAN_PIN = 17
GPIO.setmode(GPIO.BCM)
GPIO.setup(FAN_PIN, GPIO.OUT)
GPIO.output(FAN_PIN, GPIO.LOW)

# MAX31865 setup
spi = busio.SPI(board.SCK, board.MOSI, board.MISO)
cs = digitalio.DigitalInOut(board.D5)
sensor = adafruit_max31865.MAX31865(spi, cs)

# PID setup
pid = PID(1, 0.1, 0.05, setpoint=0)
pid.output_limits = (0, 100)  # Fan PWM range

target_temp = 70  # default target temperature in Fahrenheit
override = False

def celsius_to_fahrenheit(celsius):
    return celsius * 9.0 / 5.0 + 32.0

def read_temperature():
    temp_c = sensor.temperature
    return celsius_to_fahrenheit(temp_c)

def control_fan():
    while True:
        if not override:
            temperature = read_temperature()
            pid.setpoint = target_temp
            fan_speed = pid(temperature)
            GPIO.output(FAN_PIN, GPIO.HIGH if fan_speed > 0 else GPIO.LOW)
        time.sleep(1)

threading.Thread(target=control_fan).start()

@app.route('/')
def index():
    return render_template('index.html', target_temp=target_temp, override=override)

@app.route('/set_target_temp', methods=['POST'])
def set_target_temp():
    global target_temp
    target_temp = float(request.form['target_temp'])
    return jsonify(success=True)

@app.route('/set_override', methods=['POST'])
def set_override():
    global override
    override = request.form['override'] == 'true'
    GPIO.output(FAN_PIN, GPIO.HIGH if override else GPIO.LOW)
    return jsonify(success=True)

@app.route('/get_status', methods=['GET'])
def get_status():
    temperature = read_temperature()
    return jsonify(temperature=temperature, target_temp=target_temp, override=override)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)