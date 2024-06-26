import sqlite3

def init_db():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS temperature (
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            temperature REAL
        )
    ''')
    
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

def save_settings_to_db(device_name, temp_offset, temp_unit):
    try:
        conn = sqlite3.connect('settings.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO settings (device_name, temp_offset, temp_unit)
            VALUES (?, ?, ?)
        ''', (device_name, temp_offset, temp_unit))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error saving settings: {e}")
        return False