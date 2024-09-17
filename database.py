import sqlite3
import logging
import pytz
from datetime import datetime, timedelta  # Add this import statement

def init_db():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS temperature_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            temperature REAL,
            sensor_id INTEGER
        )
    ''')
    
    conn.commit()
    conn.close()

def insert_temperature_data(temp, sensor_id):
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('INSERT INTO temperature_data (temperature, sensor_id) VALUES (?, ?)', (temp, sensor_id))
    conn.commit()
    conn.close()
    logging.info(f"Inserted temperature data: {temp} for sensor_id: {sensor_id}")

def get_last_24_hours_temperature_data():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('''
        SELECT timestamp, temperature, sensor_id
        FROM temperature_data 
        WHERE timestamp >= datetime('now', '-24 hours') 
        ORDER BY timestamp ASC
    ''')
    data = c.fetchall()
    conn.close()
    return data

def get_temperature_data_by_range(time_range, timezone):
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()

    # Calculate the start time based on the time range
    end_time = datetime.now(timezone)
    start_time = end_time - timedelta(minutes=time_range)

    # Example SQL query to fetch data including sensor_id
    query = """
    SELECT timestamp, temperature, sensor_id
    FROM temperature_data
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp ASC
    """
    # Execute the query and fetch the data
    cursor.execute(query, (start_time, end_time))
    data = cursor.fetchall()

    # Close the database connection
    conn.close()

    return data

if __name__ == '__main__':
    init_db()