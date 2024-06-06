#!/bin/bash
update_and_upgrade() {
    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Running Apt Update... (This could take several minutes)        **"
    echo "**                                                                     **"
    echo "*************************************************************************"
    sudo apt update

    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Running Apt Upgrade... (This could take several minutes)       **"
    echo "**                                                                     **"
    echo "*************************************************************************"
    sudo apt upgrade -y
}

# Function to install dependencies
install_dependencies() {
    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Installing Dependencies... (This could take several minutes)   **"
    echo "**                                                                     **"
    echo "*************************************************************************"
    sudo apt install python3-dev python3-pip python3-venv python3-rpi.gpio python3-scipy python3-wheel nginx git supervisor ttf-mscorefonts-installer redis-server libatlas-base-dev libopenjp2-7 -y
}
    # Create directory if it doesn't exist
    if [ ! -d "/usr/local/bin/masterpi" ]; then
       sudo mkdir -p /usr/local/bin/masterpi
    fi

# Function to clone the repository
clone_repo() {
    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Cloning MasterPi from GitHub...                                **"
    echo "**                                                                     **"
    echo "*************************************************************************"
     sudo git clone --depth 1 https://github.com/Killerphish/MasterPI /usr/local/bin/masterpi
}

# Function to set up the Python virtual environment and install modules
setup_venv() {
    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Setting up Python VENV and Installing Modules...               **"
    echo "**            (This could take several minutes)                        **"
    echo "**                                                                     **"
    echo "*************************************************************************"
     groupadd masterpi 
     usermod -a -G masterpi $USER
     usermod -a -G masterpi root
     chown -R $USER:masterpi /usr/local/bin/masterpi
     chmod -R 775 /usr/local/bin/masterpi/ 

    echo " - Setting up VENV"
     sudo python3 -m venv --system-site-packages /usr/local/bin/masterpi

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
        "eventlet"
    )

    for package in "${dependencies[@]}"; do
         sudo pip install $package
    done
}

# Function to configure Raspberry Pi settings
configure_raspberry_pi() {
    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Configuring Raspberry Pi settings...                           **"
    echo "**                                                                     **"
    echo "*************************************************************************"

    if [ -f "/boot/firmware/config.txt" ]; then
        config_path="/boot/firmware/config.txt"
    elif [ -f "/boot/config.txt" ]; then
        config_path="/boot/config.txt"
    else
        echo "Raspberry Pi config file not found."
        return
    fi

    echo "dtoverlay=pwm,gpiopin=13,func=4" |  "tee -a $config_path" 
}

# Function to set /tmp to RAM based storage
set_tmp_to_ram() {
    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Setting /tmp to RAM based storage in /etc/fstab                **"
    echo "**                                                                     **"
    echo "*************************************************************************"
    echo 'tmpfs /tmp  tmpfs defaults,noatime 0 0' | tee -a /etc/fstab
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
echo "$nginx_config" |  sudo tee /etc/nginx/sites-available/flask_app

# Run the setup functions
check_root
set_tmp_to_ram
update_and_upgrade
install_dependencies
clone_repo
setup_venv
configure_raspberry_pi
