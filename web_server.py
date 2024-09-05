from quart import Quart, render_template, request, jsonify
import sqlite3
from database import get_last_24_hours_temperature_data, get_temperature_data_by_range

def create_app():
    app = Quart(__name__)

    @app.route('/')
    async def index():
        return await render_template('index.html')

    @app.route('/settings')
    async def settings():
        return await render_template('settings.html')

    @app.route('/chart')
    async def chart():
        return await render_template('chart.html')

    @app.route('/update_target', methods=['POST'])
    async def update_target():
        data = await request.form
        target_temp = data['target_temp']
        # Update target temperature in your PID controller
        return jsonify(success=True)

    @app.route('/current_temp', methods=['GET'])
    async def current_temp():
        # Get current temperature from the sensor
        return jsonify(current_temp=current_temp)

    @app.route('/temp_data', methods=['GET'])
    async def temp_data():
        time_range = request.args.get('time_range', '60')  # Default to 60 minutes if not provided
        data = get_temperature_data_by_range(int(time_range))
        return jsonify(data=data)

    @app.route('/save_settings', methods=['POST'])
    async def save_settings():
        data = await request.form
        device_name = data['device_name']
        temp_offset = data['temp_offset']
        temp_unit = data['temp_unit']
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
    async def pid_autotune():
        # Start PID autotune process
        return jsonify(success=True)

    return app