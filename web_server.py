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

    return app