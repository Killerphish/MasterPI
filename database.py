import sqlite3
import logging

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

    # Initialize settings.db
    conn = sqlite3.connect('settings.db')
    c = conn.cursor()
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_name TEXT,
            temp_offset REAL,
            temp_unit TEXT
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
    logging.info(f"Inserted temperature data: {temp}")

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

def get_temperature_data_by_range(minutes):
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('''
        SELECT timestamp, temperature 
        FROM temperature_data 
        WHERE timestamp >= datetime('now', ? || ' minutes') 
        ORDER BY timestamp ASC
    ''', (-minutes,))
    data = c.fetchall()
    conn.close()
    return data

def save_settings_to_db(device_name, temp_offset, temp_unit):
    conn = sqlite3.connect('settings.db')
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS settings
                     (id INTEGER PRIMARY KEY, device_name TEXT, temp_offset REAL, temp_unit TEXT)''')
    
    # Check if there's already a settings row
    cursor.execute('SELECT * FROM settings WHERE id = 1')
    if cursor.fetchone():
        cursor.execute('UPDATE settings SET device_name=?, temp_offset=?, temp_unit=? WHERE id=1',
                       (device_name, temp_offset, temp_unit))
    else:
        cursor.execute('INSERT INTO settings (id, device_name, temp_offset, temp_unit) VALUES (1, ?, ?, ?)',
                       (device_name, temp_offset, temp_unit))
    
    conn.commit()
    conn.close()
    return True

def get_settings_from_db():
    conn = sqlite3.connect('settings.db')
    cursor = conn.cursor()
    cursor.execute('SELECT device_name, temp_offset, temp_unit FROM settings WHERE id = 1')
    row = cursor.fetchone()
    conn.close()
    if row:
        return {'device_name': row[0], 'temp_offset': row[1], 'temp_unit': row[2]}
    else:
        return {'device_name': '', 'temp_offset': 0.0, 'temp_unit': 'C'}
    
if __name__ == '__main__':
    init_db()