from flask import Flask
app = Flask(__name__)

# GPIO pin setup for relays
FAN_RELAY_PIN = 17  # Example pin, modify as needed
DAMPER1_RELAY_PIN = 27
DAMPER2_RELAY_PIN = 22

GPIO.setmode(GPIO.BCM)
GPIO.setup(FAN_RELAY_PIN, GPIO.OUT)
GPIO.setup(DAMPER1_RELAY_PIN, GPIO.OUT)
GPIO.setup(DAMPER2_RELAY_PIN, GPIO.OUT)

def control_fan(state):
    GPIO.output(FAN_RELAY_PIN, state)
    print(repr(f"Fan relay set to {'HIGH' if state else 'LOW'}"))

def control_damper1(state):
    GPIO.output(DAMPER1_RELAY_PIN, state)
    print(repr(f"Damper1 relay set to {'HIGH' if state else 'LOW'}"))

def control_damper2(state):
    GPIO.output(DAMPER2_RELAY_PIN, state)
    print(repr(f"Damper2 relay set to {'HIGH' if state else 'LOW'}"))

# Initialize I2C bus
i2c = busio.I2C(board.SCL, board.SDA)

# Initialize two ADS1115 ADCs
ads1 = ADS.ADS1115(i2c, address=0x48)
ads2 = ADS.ADS1115(i2c, address=0x49)

# Initialize channels (assuming 6 RTD probes)
channels = [
    AnalogIn(ads1, ADS.P0),
    AnalogIn(ads1, ADS.P1),
    AnalogIn(ads1, ADS.P2),
    AnalogIn(ads1, ADS.P3),
    AnalogIn(ads2, ADS.P0),
    AnalogIn(ads2, ADS.P1),
]

# Function to read temperatures
def read_temperatures():
    temperatures = []
    for channel in channels:
        # Replace with actual RTD100 conversion logic
        voltage = channel.voltage
        temperature = voltage * 100  # Example conversion, modify as needed
        temperatures.append(temperature)
    return temperatures

@app.route('/')
def index():
    temperatures = read_temperatures()
    return render_template('index.html', temperatures=temperatures)

@app.route('/set_fan', methods=['POST'])
def set_fan():
    state = request.form['state']
    control_fan(GPIO.HIGH if state == 'on' else GPIO.LOW)
    return redirect(url_for('index'))

@app.route('/set_damper1', methods=['POST'])
def set_damper1():
    state = request.form['state']
    control_damper1(GPIO.HIGH if state == 'open' else GPIO.LOW)
    return redirect(url_for('index'))

@app.route('/set_damper2', methods=['POST'])
def set_damper2():
    state = request.form['state']
    control_damper2(GPIO.HIGH if state == 'open' else GPIO.LOW)
    return redirect(url_for('index'))

if __name__ == "__main__":
    app.run(host='127.0.0.1', port=5000)