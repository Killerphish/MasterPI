#!/bin/bash

# Remote repository URL and branch name
REMOTE_REPO="https://github.com/Killerphish/MasterPI.git"
BRANCH="main"  # Replace with your branch name if different
PROJECT_DIR="/home/smoke/MasterPi"  # Adjust this to your actual project directory

# Ensure the script itself is executable
chmod +x "$0" || { echo "Failed to set execute permission on install script"; exit 1; }

# Ensure autorun.sh and auto_update.sh are executable
if [ -f "$PROJECT_DIR/tools/autorun.sh" ]; then
    chmod +x "$PROJECT_DIR/tools/autorun.sh" || { echo "Failed to set execute permission on autorun.sh"; exit 1; }
else
    echo "autorun.sh not found at $PROJECT_DIR/tools/autorun.sh, skipping."
fi

if [ -f "$PROJECT_DIR/tools/auto_update.sh" ]; then
    chmod +x "$PROJECT_DIR/tools/auto_update.sh" || { echo "Failed to set execute permission on auto_update.sh"; exit 1; }
else
    echo "auto_update.sh not found at $PROJECT_DIR/tools/auto_update.sh, skipping."
fi

# Function to set up autorun
setup_autorun() {
    read -p "Do you want to set up the application to autorun at system startup? (y/n): " autorun_choice
    if [ "$autorun_choice" == "y" ]; then
        # Execute autorun.sh script directly
        "$PROJECT_DIR/tools/autorun.sh"
        echo "Autorun set up successfully."
    else
        echo "Autorun not configured."
    fi
}

# Function to set up auto-update
setup_auto_update() {
    read -p "Do you want to set up automatic updates for the application? (y/n): " auto_update_choice
    if [ "$auto_update_choice" == "y" ]; then
        # Set up auto-update using cron
        (crontab -l 2>/dev/null; echo "0 */6 * * * cd $PROJECT_DIR && $PROJECT_DIR/tools/auto_update.sh") | crontab -
        echo "Auto-update set up successfully."
    else
        echo "Auto-update not configured."
    fi
}

# Update and upgrade the system
sudo apt-get update && sudo apt-get upgrade -y || { echo "System update/upgrade failed"; exit 1; }

# Install Git (if not already installed)
sudo apt-get install -y git || { echo "Git installation failed"; exit 1; }

# Create project directory if it doesn't exist
mkdir -p "$PROJECT_DIR" || { echo "Failed to create project directory"; exit 1; }

# Navigate to the project directory
cd "$PROJECT_DIR" || { echo "Failed to navigate to project directory"; exit 1; }

# Check if the project directory is empty
if [ -z "$(ls -A $PROJECT_DIR)" ]; then
    # Clone the remote repository
    git clone "$REMOTE_REPO" . || { echo "Failed to clone repository"; exit 1; }
else
    # Pull the latest changes from the specified branch
    git fetch origin "$BRANCH" || { echo "Failed to fetch from origin"; exit 1; }
    git reset --hard "origin/$BRANCH" || { echo "Failed to reset to latest branch"; exit 1; }
fi

# Install Python and pip
sudo apt-get install -y python3 python3-pip || { echo "Python installation failed"; exit 1; }

# Install virtualenv
pip3 install virtualenv || { echo "virtualenv installation failed"; exit 1; }

# Install adafruit-python-shell
pip3 install --upgrade adafruit-python-shell || { echo "adafruit-python-shell installation failed"; exit 1; }

# Download and run the raspi-blinka.py script
wget https://raw.githubusercontent.com/adafruit/Raspberry-Pi-Installer-Scripts/master/raspi-blinka.py || { echo "Failed to download raspi-blinka.py"; exit 1; }
sudo -E env PATH=$PATH python3 raspi-blinka.py || { echo "Failed to run raspi-blinka.py"; exit 1; }

# Create and activate a virtual environment
if [ ! -d "venv" ]; then
    virtualenv venv || { echo "Failed to create virtual environment"; exit 1; }
fi

source venv/bin/activate || { echo "Failed to activate virtual environment"; exit 1; }

# Install the package (replace with your specific package installation command)
# For example, pip install . or python setup.py install
# Replace this line with your specific installation command
# pip install .

# Install additional requirements (assuming requirements.txt exists)
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt || { echo "Failed to install requirements"; exit 1; }
fi

# Run Quart application 

hypercorn masterpi:app & || { echo "Failed to start Quart application"; exit 1; }

# Deactivate the virtual environment
deactivate

echo "Installation complete."

# Prompt for setting up autorun and auto-update
setup_autorun
setup_auto_update