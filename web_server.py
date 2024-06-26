from flask import Flask, render_template, request, jsonify
import sqlite3

def create_app():
    app = Flask(__name__)

    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/settings')
    def settings():
        return render_template('settings.html')

    @app.route('/chart')
    def chart():
        return render_template('chart.html')

    @app.route('/update_target', methods=['POST'])
    def update_target():
        target_temp = request.form['target_temp']
        # Update target temperature in your PID controller
        return jsonify(success=True)

    @app.route('/current_temp', methods=['GET'])
    def current_temp():
        # Get current temperature from the sensor
        return jsonify(current_temp=current_temp)

    @app.route('/temp_data', methods=['GET'])
    def temp_data():
        conn = sqlite3.connect('database.db')
        c = conn.cursor()
        c.execute('SELECT timestamp, temperature FROM temperature ORDER BY timestamp DESC LIMIT 60')
        data = c.fetchall()
        conn.close()
        return jsonify(data=data)

    @app.route('/save_settings', methods=['POST'])
    def save_settings():
        device_name = request.form['device_name']
        temp_offset = request.form['temp_offset']
        temp_unit = request.form['temp_unit']
        # Save these settings to a database or file
        # Example: save to SQLite
        conn = sqlite3.connect('database.db')
        c = conn.cursor()
        c.execute('UPDATE settings SET device_name = ?, temp_offset = ?, temp_unit = ?',
                  (device_name, temp_offset, temp_unit))
        conn.commit()
        conn.close()
        return jsonify(success=True)

    @app.route('/pid_autotune', methods=['POST'])
    def pid_autotune():
        # Start PID autotune process
        return jsonify(success=True)

    return app