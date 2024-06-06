from flask import Flask, render_template, request, redirect, url_for
import threading

app = Flask(__name__)

# Shared data
temperatures = [0.0] * 6
target_temp = 350
damper1_state = GPIO.LOW
damper2_state = GPIO.LOW

@app.route('/')
def index():
    return render_template('index.html', temperatures=temperatures, target_temp=target_temp, damper1_state=damper1_state, damper2_state=damper2_state)

@app.route('/set_target_temp', methods=['POST'])
def set_target_temp():
    global target_temp
    target_temp = int(request.form['target_temp'])
    return redirect(url_for('index'))

@app.route('/toggle_damper1', methods=['POST'])
def toggle_damper1():
    global damper1_state
    damper1_state = not damper1_state
    control_damper1(damper1_state)
    return redirect(url_for('index'))

@app.route('/toggle_damper2', methods=['POST'])
def toggle_damper2():
    global damper2_state
    damper2_state = not damper2_state
    control_damper2(damper2_state)
    return redirect(url_for('index'))

def read_and_update_temperatures():
    global temperatures
    while True:
        temperatures = read_temperatures()
        time.sleep(1)

if __name__ == "__main__":
    # Start temperature reading in a separate thread
    temp_thread = threading.Thread(target=read_and_update_temperatures)
    temp_thread.daemon = True
    temp_thread.start()

    # Start the Flask web server
    app.run(host='127.0.0.1')