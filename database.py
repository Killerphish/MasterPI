"""
This module provides functions to initialize a database and perform operations
related to temperature data.
"""

import sqlite3
import logging
from datetime import datetime, timedelta  # Correct import order

def init_db():
    """Initialize the database and create the temperature_data table if it doesn't exist."""
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
    """Insert a new temperature record into the database."""
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('INSERT INTO temperature_data (temperature, sensor_id) VALUES (?, ?)', (temp, sensor_id))
    conn.commit()
    conn.close()
    logging.info("Inserted temperature data: %s for sensor_id: %s", temp, sensor_id)  # Use lazy % formatting

def get_last_24_hours_temperature_data():
    """Retrieve temperature data from the last 24 hours."""
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
    """Retrieve temperature data within a specified time range and timezone."""
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

# Add a final newline