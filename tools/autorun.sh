#!/bin/bash
#This script will setup the autorun at restart
# Define variables
SERVICE_NAME="flaskapp"
USER=$(whoami)
PROJECT_DIR="$HOME/MasterPI"
EXEC_START="/usr/bin/python3 $PROJECT_DIR/app.py"

# Create the systemd service file
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

if [ ! -f "$SERVICE_FILE" ]; then
  echo "Creating systemd service file at $SERVICE_FILE"

  sudo tee "$SERVICE_FILE" > /dev/null <<EOL
[Unit]
Description=Flask Application
After=network.target

[Service]
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$EXEC_START
Restart=always

[Install]
WantedBy=multi-user.target
EOL

  # Reload systemd to apply the new service file
  sudo systemctl daemon-reload

  # Enable the service to start on boot
  sudo systemctl enable $SERVICE_NAME

  # Start the service now
  sudo systemctl start $SERVICE_NAME

  echo "Flask application set to auto-run at start."
else
  echo "Service file already exists at $SERVICE_FILE"
fi