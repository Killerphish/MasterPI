import yaml
import asyncio

def load_config():
    try:
        with open('config.yaml', 'r') as config_file:
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
    def _save_config():
        with open('config.yaml', 'w') as file:
            yaml.dump(config, file)
        print("Config file saved successfully")

    # Run the synchronous file operation in a separate thread
    await asyncio.to_thread(_save_config)