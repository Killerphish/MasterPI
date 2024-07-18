#!/bin/bash

# Define the path to your update script
UPDATE_SCRIPT="$HOME/MasterPI/tools/update.sh"

# Check if the update script exists
if [ ! -f "$UPDATE_SCRIPT" ]; then
  echo "Update script not found at $UPDATE_SCRIPT"
  exit 1
fi

# Make the update script executable
chmod +x "$UPDATE_SCRIPT"

# Create a cron job to run the update script at midnight every day
(crontab -l ; echo "0 0 * * * $UPDATE_SCRIPT") | crontab -

echo "Cron job set up to run the update script daily at midnight."