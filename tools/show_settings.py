import sqlite3

# Connect to the SQLite database
conn = sqlite3.connect('settings.db')
cursor = conn.cursor()

# Query the data
cursor.execute('SELECT * FROM settings')
rows = cursor.fetchall()

# Display the data
for row in rows:
    print(row)

# Close the connection
conn.close()