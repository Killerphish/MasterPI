#!/bin/bash

# Variables
DOMAIN_OR_IP="your_domain_or_ip"
QUART_PORT=5000
NGINX_CONF="/etc/nginx/sites-available/quart_app"
NGINX_LINK="/etc/nginx/sites-enabled/quart_app"

# Update package list and install Nginx
echo "Updating package list..."
sudo apt update

echo "Installing Nginx..."
sudo apt install -y nginx

# Create Nginx configuration file
echo "Creating Nginx configuration file..."
sudo bash -c "cat > $NGINX_CONF" <<EOL
server {
    listen 80;
    server_name $DOMAIN_OR_IP;

    location / {
        proxy_pass http://127.0.0.1:$QUART_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOL

# Enable the configuration by creating a symbolic link
echo "Enabling Nginx configuration..."
sudo ln -s $NGINX_CONF $NGINX_LINK

# Test Nginx configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# Restart Nginx to apply changes
echo "Restarting Nginx..."
sudo systemctl restart nginx

echo "Nginx setup complete. You can now access your Quart application at http://$DOMAIN_OR_IP"