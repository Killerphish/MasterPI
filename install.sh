#!/bin/bash

# Function to set up autorun
setup_autorun() {
    read -p "Do you want to set up the application to autorun at system startup? (y/n): " autorun_choice
    if [ "$autorun_choice" == "y" ]; then
        # Execute autorun.sh script directly
        ./tools/autorun.sh
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
        (crontab -l 2>/dev/null; echo "0 */6 * * * cd $(pwd) && ./tools/auto_update.sh >> auto_update.log 2>&1") | crontab -
        echo "Auto-update set up successfully."
    else
        echo "Auto-update not configured."
    fi
}

# Update and upgrade the system
sudo apt-get update && sudo apt-get upgrade -y

# Install Python and pip
sudo apt-get install -y python3 python3-pip

# Install virtualenv
pip3 install virtualenv

# Create a virtual environment (if it doesn't exist)
if [ ! -d "venv" ]; then
    virtualenv venv
fi

# Activate the virtual environment
source venv/bin/activate

# Install the package
pip install .

# Install additional requirements (assuming requirements.txt exists)
pip install -r requirements.txt

# Run Flask application
python app.py &

# Deactivate the virtual environment
deactivate

echo "Installation complete. The application is running."

# Prompt for setting up autorun and auto-update
setup_autorun
setup_auto_update