#!/bin/bash

# Function to run commands with sudo if required
run_command() {
    if [ "$use_sudo" = true ]; then
        sudo "$1"
    else
        "$1"
    fi
}

# Function to check if root
check_root() {
    if [ "$(id -u)" -eq 0 ]; then
        echo "You are root."
    else
        echo "SUDO will be used for the install."
        # Check if sudo is installed
        if command -v sudo >/dev/null 2>&1; then
            SUDO="sudo"
        else
            echo "Please install sudo."
            exit 1
        fi
    fi
}

# Function to update and upgrade packages
update_and_upgrade() {
    clear
    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Running Apt Update... (This could take several minutes)        **"
    echo "**                                                                     **"
    echo "*************************************************************************"
    run_command "apt update" true
    clear

    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Running Apt Upgrade... (This could take several minutes)       **"
    echo "**                                                                     **"
    echo "*************************************************************************"
    run_command "apt upgrade -y" true
    clear
}

# Function to install dependencies
install_dependencies() {
    clear
    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Installing Dependencies... (This could take several minutes)   **"
    echo "**                                                                     **"
    echo "*************************************************************************"
    run_command "apt install python3-dev python3-pip python3-venv python3-rpi.gpio python3-scipy python3-wheel nginx git supervisor ttf-mscorefonts-installer redis-server libatlas-base-dev libopenjp2-7 -y" true
}

# Function to clone the repository
clone_repo() {
    clear
    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Cloning MasterPi from GitHub...                                **"
    echo "**                                                                     **"
    echo "*************************************************************************"
    run_command "git clone --depth 1 https://github.com/Killerphish/MasterPI /usr/local/bin/masterpi" true
}

# Function to set up the Python virtual environment and install modules
setup_venv() {
    clear
    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Setting up Python VENV and Installing Modules...               **"
    echo "**            (This could take several minutes)                        **"
    echo "**                                                                     **"
    echo "*************************************************************************"
    run_command "groupadd masterpi" true
    run_command "usermod -a -G masterpi $USER" true
    run_command "usermod -a -G masterpi root" true
    run_command "chown -R $USER:masterpi /usr/local/bin/masterpi" true
    run_command "chmod -R 775 /usr/local/bin/masterpi/" true

    echo " - Setting up VENV"
    run_command "python3 -m venv --system-site-packages /usr/local/bin/masterpi"
    source /usr/local/bin/masterpi/bin/activate || . /usr/local/bin/masterpi/bin/activate

    echo " - Installing module dependencies... "
    dependencies=(
        "flask==2.3.3"
        "flask-mobility"
        "flask-qrcode"
        "flask-socketio"
        "gpiozero"
        "redis"
        "uuid"
        "influxdb-client[ciso]"
        "apprise"
        "scikit-fuzzy"
        "scikit-learn"
        "ratelimitingfilter"
        "pillow>=9.2.0"
        "paho-mqtt"
        "psutil"
        "gunicorn"
        "adafruit-circuitpython-ili9341"
        "adafruit-circuitpython-touchscreen"
        "adafruit-circuitpython-ads1x15"
    )

    for package in "${dependencies[@]}"; do
        run_command "pip install $package" true
    done

    if [ "${PYTHON_VERSION%%.*}" -lt 3 ] || [ "${PYTHON_VERSION%%.*}" -eq 3 ] && [ "${PYTHON_VERSION##*.}" -lt 11 ]; then
        echo "System is running a python version lower than 3.11, installing eventlet==0.30.2"
        run_command "pip install eventlet==0.30.2" true
    else
        echo "System is running a python version 3.11 or greater, installing latest eventlet"
        run_command "pip install eventlet" true
    fi
}

# Function to configure Raspberry Pi settings
configure_raspberry_pi() {
    clear
    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Configuring Raspberry Pi settings...                           **"
    echo "**                                                                     **"
    echo "*************************************************************************"

    run_command "raspi-config nonint do_spi 0" true
    run_command "raspi-config nonint do_i2c 0" true

    config_path="/boot/firmware/config.txt"
    if [ ! -f "$config_path" ]; then
        config_path="/boot/config.txt"
    fi
    echo "dtoverlay=pwm,gpiopin=13,func=4" | run_command "tee -a $config_path" true
}

# Function to set /tmp to RAM based storage
set_tmp_to_ram() {
    clear
    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Setting /tmp to RAM based storage in /etc/fstab                **"
    echo "**                                                                     **"
    echo "*************************************************************************"
    echo "tmpfs /tmp  tmpfs defaults,noatime 0 0" | run_command "tee -a /etc/fstab" true
}

# Check if the Nginx default configuration file exists before attempting to remove it
if [ -f '/etc/nginx/sites-enabled/default' ]; then
    echo "Removing Nginx default configuration..."
    sudo rm '/etc/nginx/sites-enabled/default'
else
    echo "Nginx default configuration not found, skipping removal."
fi

echo "Configuring Nginx..."
# Content to write to the file
nginx_config=$(cat << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
)

# Write the content to the file
echo "$nginx_config" | run_command "sudo tee /etc/nginx/sites-available/flask_app" true

# Run the setup functions
check_root
set_tmp_to_ram
update_and_upgrade
