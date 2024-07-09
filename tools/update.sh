#!/bin/bash

#Log current user
CURRENT_USER =$(logname)

# Define the path to your project directory and service name
PROJECT_DIR="/home/$CURRENT_USER/MasterPi"
SERVICE_NAME="masterpi"

# Navigate to the project directory
cd $PROJECT_DIR || exit

# Stop the Flask application using systemd
echo "Stopping the Flask application..."
sudo systemctl stop $SERVICE_NAME

# Pull the latest changes from GitHub
echo "Pulling the latest changes from GitHub..."
sudo -u $CURRENT_USER git pull origin main

# Restart the Flask application using systemd
echo "Restarting the Flask application..."
sudo systemctl start $SERVICE_NAME

echo "MasterPi has been successfully updated."