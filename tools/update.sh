#!/bin/bash

#Get the current user
CURRENT_USER=$(logname)


# Define the path to your project directory and service name
PROJECT_DIR="/home/$CURRENT_USER/MasterPi"
SERVICE_NAME="flaskapp"

# Configure Git to mark the directory as safe for the actual user
sudo -u $CURRENT_USER git config --global --add safe.directory $PROJECT_DIR

# Set the preferred pull strategy to avoid warnings
sudo -u $CURRENT_USER git config --global pull.rebase false

# Ensure the actual user has ownership and correct permissions
sudo chown -R $CURRENT_USER:$CURRENT_USER $PROJECT_DIR
sudo chmod -R u+rwX $PROJECT_DIR

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

echo "Update and restart completed."