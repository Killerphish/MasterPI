#!/bin/bash

# Define the service name
SERVICE_NAME="flaskapp"

# Disable the service
sudo systemctl disable $SERVICE_NAME

# Stop the service if it's currently running
sudo systemctl stop $SERVICE_NAME

# Remove the service file
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
if [ -f "$SERVICE_FILE" ]; then
  sudo rm "$SERVICE_FILE"
fi

# Reload systemd to apply the changes
sudo systemctl daemon-reload

echo "Auto-run for MasterPi has been disabled."