#!/bin/bash

set -e

echo "Stopping Flask app..."
FLASK_PID=$(pgrep -f "python ~/rpi_control/app.py")
if [ -n "$FLASK_PID" ]; then
    kill $FLASK_PID
    echo "Flask app stopped."
else
    echo "Flask app not running."
fi

echo "Removing project directory and virtual environment..."
rm -rf ~/rpi_control
rm -rf ~/myenv

echo "Removing Nginx configuration..."
sudo rm /etc/nginx/sites-enabled/flask_app
sudo rm /etc/nginx/sites-available/flask_app

echo "Restarting Nginx..."
sudo systemctl restart nginx

echo "Uninstallation complete."
