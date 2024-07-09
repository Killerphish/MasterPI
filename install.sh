#!/bin/bash

# Remote repository URL and branch name
REMOTE_REPO="https://github.com/Killerphish/MasterPI.git"
BRANCH="main"  # Replace with your branch name if different
PROJECT_DIR="/home/smoke/MasterPi"  # Adjust this to your actual project directory

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
sudo apt-get update
sudo apt-get upgrade -y

# Install Git (if not already installed)
sudo apt-get install -y git

# Create project directory if it doesn't exist
mkdir -p "$PROJECT_DIR"

# Navigate to the project directory
cd "$PROJECT_DIR" || exit

# Check if the project directory is empty
if [ -z "$(ls -A $PROJECT_DIR)" ]; then
    # Clone the remote repository
    git clone "$REMOTE_REPO" .
else
    # Pull the latest changes from the specified branch
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
fi

# Install Python and pip
sudo apt-get install -y python3 python3-pip

# Install virtualenv
pip3 install virtualenv

# Create and activate a virtual environment
if [ ! -d "venv" ]; then
    virtualenv venv
fi

source venv/bin/activate

# Install the package (replace with your specific package installation command)
# For example, pip install . or python setup.py install
# Replace this line with your specific installation command
# pip install .

# Install additional requirements (assuming requirements.txt exists)
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
fi

# Run Flask application (replace with your specific command)
# For example: python masterpi.py &
# Replace this line with your specific command to start your Flask application
# python masterpi.py &

# Deactivate the virtual environment
deactivate

echo "Installation complete."

# Prompt for setting up autorun and auto-update
setup_autorun
setup_auto_update