from flask import Flask, render_template, request, jsonify
import sqlite3
import threading
from simple_pid import PID
import random  # For simulating temperature changes during autotuning

app = Flask(__name__)

# Simulated process function (replace with actual control logic)
def simulate_process(input_value):
    return 20 + (input_value / 10) + random.uniform(-1, 1)

# PID Autotune function
def pid_autotune(setpoint):
    pid = PID(1, 0.1, 0.05, setpoint=setpoint)
    pid.sample_time = 1
    pid.output_limits = (0, 100)

    for i in range(100):
        current_temp = simulate_process(pid(setpoint))
        print(f"Cycle {i}, Current Temp: {current_temp:.2f} °C")
        time.sleep(1)

    kp, ki, kd = pid.tunings
    with open("pid_params.txt", "w") as f:
        f.write(f"{kp},{ki},{kd}")

@app.route('/pid_autotune', methods=['POST'])
def start_pid_autotune():
    setpoint = 200  # Example setpoint, you might want to get this from a form
    threading.Thread(target=pid_autotune, args=(setpoint,)).start()
    return jsonify(success=True)

if __name__ == '__main__':
    app.run(debug=True)