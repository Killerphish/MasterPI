#!/bin/bash

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
python app.py

# Deactivate the virtual environment
deactivate

echo "Installation complete. The application is running."