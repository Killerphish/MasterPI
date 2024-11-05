"""
This module provides functions to load and save configuration data
from a YAML file asynchronously.
"""

import asyncio
import yaml

def load_config():
    """
    Load configuration from 'config.yaml'.

    Returns:
        dict: Configuration data if loaded successfully, None otherwise.
    """
    try:
        with open('config.yaml', 'r', encoding='utf-8') as config_file:
            print("Config file opened successfully")
            config = yaml.safe_load(config_file)
            print("Config file loaded successfully")
            return config
    except FileNotFoundError:
        print("Config file not found. Please ensure 'config.yaml' exists.")
        return None
    except yaml.YAMLError as e:
        print(f"Error parsing config file: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error loading config file: {e}")
        return None

async def save_config(config):
    """
    Save configuration to 'config.yaml'.

    Args:
        config (dict): Configuration data to save.
    """
    def _save_config():
        with open('config.yaml', 'w', encoding='utf-8') as file:
            yaml.dump(config, file)
        print("Config file saved successfully")

    # Run the synchronous file operation in a separate thread
    await asyncio.to_thread(_save_config)

# Ensure the file ends with a newline