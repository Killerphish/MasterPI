#!/bin/bash

# Remote repository URL and branch name
REMOTE_REPO="https://github.com/Killerphish/MasterPI.git"
BRANCH="main"  # Replace with your branch name if different

# Function to set up autorun
setup_autorun() {
    read -p "Do you want to set up the application to autorun at system startup? (y/n): " autorun_choice
    if [ "$autorun_choice" == "y" ]; then
        # Execute autorun.sh script directly
        ./tools/autorun.sh
        echo "Autorun set up successfully."
    else
        echo "Autorun is disabled."
    fi
}

# Function to set up auto-update
setup_auto_update() {
    read -p "Do you want to set up automatic updates for the application? (y/n): " auto_update_choice
    if [ "$auto_update_choice" == "y" ]; then
        # Set up auto-update using cron
        (crontab -l 2>/dev/null; echo "0 */6 * * * cd $(pwd) && ./tools/auto_update.sh") | crontab -
        echo "Auto-update set up successfully."
    else
        echo "Auto-update is disabled."
    fi
}

# Update and upgrade the system
sudo apt-get update
sudo apt-get upgrade -y

# Install Git
sudo apt-get install -y git

# Navigate to the project directory
cd "$HOME/MasterPi" || exit

# Set the remote repository and branch
git remote set-url origin "$REMOTE_REPO"
git checkout "$BRANCH"

# Pull the latest changes from the specified branch
git pull origin "$BRANCH"

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