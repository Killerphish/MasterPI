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
    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Running Apt Update... (This could take several minutes)        **"
    echo "**                                                                     **"
    echo "*************************************************************************"
    run_command "apt update" true

    echo "*************************************************************************"
    echo "**                                                                     **"
    echo "**      Running Apt Upgrade... (This could take several minutes)       **"
    echo "**                                                                     **"
    echo "*************************************************************************"
    run_command "apt upgrade -y" true
}