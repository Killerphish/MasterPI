import sqlite3
import logging
import pytz
from datetime import datetime

def init_db():
    # Initialize database.db
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS temperature (
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            temperature REAL
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS temperature_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            temperature REAL
        )
    ''')
    
    conn.commit()
    conn.close()

def insert_temperature(temp):
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('INSERT INTO temperature (temperature) VALUES (?)', (temp,))
    conn.commit()
    conn.close()
    logging.info(f"Inserted temperature: {temp}")  # Log the inserted temperature

def get_temperature_data():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('SELECT timestamp, temperature FROM temperature ORDER BY timestamp DESC LIMIT 60')
    data = c.fetchall()
    conn.close()
    return data

def insert_temperature_data(temp):
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('INSERT INTO temperature_data (temperature) VALUES (?)', (temp,))
    conn.commit()
    conn.close()
    logging.info(f"Inserted temperature data: {temp}")  # Log the inserted data

def get_last_24_hours_temperature_data():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('''
        SELECT timestamp, temperature 
        FROM temperature_data 
        WHERE timestamp >= datetime('now', '-24 hours') 
        ORDER BY timestamp ASC
    ''')
    data = c.fetchall()
    conn.close()
    return data

def get_temperature_data_by_range(time_range, timezone):
    conn = sqlite3.connect('temperature.db')
    cursor = conn.cursor()
    
    # Calculate the timestamp for the start of the time range
    start_time = datetime.datetime.now(pytz.timezone(timezone)) - datetime.timedelta(minutes=time_range)
    
    # Convert the start_time to UTC for database query
    start_time_utc = start_time.astimezone(pytz.UTC)
    
    cursor.execute("""
        SELECT timestamp, temperature
        FROM temperature_data
        WHERE timestamp >= ?
        ORDER BY timestamp
    """, (start_time_utc.strftime('%Y-%m-%d %H:%M:%S'),))
    
    data = cursor.fetchall()
    conn.close()
    
    return data

if __name__ == '__main__':
    init_db()