import logging
from logging.handlers import RotatingFileHandler
import os
import aiohttp
import asyncio
from quart import Quart, jsonify, request
from meater import MeaterApi  # Import the MeaterApi class

app = Quart(__name__)
app.config['DEBUG'] = True
app.secret_key = 'your_secret_key'  # Add a secret key for session management
app.config['REQUEST_TIMEOUT'] = 60  # Set request timeout to 60 seconds

# Setup logging
if not os.path.exists('logs'):
    os.mkdir('logs')
file_handler = RotatingFileHandler('logs/app.log', maxBytes=10240, backupCount=10)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'))
file_handler.setLevel(logging.INFO)
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)
app.logger.info('Application startup')

# Initialize aiohttp session and Meater API
aiohttp_session = None
meater_api = None

async def create_aiohttp_session():
    global aiohttp_session, meater_api
    aiohttp_session = aiohttp.ClientSession()
    meater_api = MeaterApi(aiohttp_session)

@app.route('/get_meater_temperature', methods=['GET'])
async def get_meater_temperature():
    app.logger.info('Fetching Meater temperature...')
    try:
        devices = await meater_api.devices()
        if devices and 'data' in devices and devices['data']:
            device = devices['data'][0]  # Assuming you are using the first Meater device
            temperature = device['temperature']['internal']
            app.logger.info('Meater temperature fetched successfully')
            return jsonify({'temperature': temperature})
        app.logger.error('No Meater device or probe found')
        return jsonify({'error': 'No Meater device or probe found'}), 404
    except aiohttp.ClientError as e:
        app.logger.error(f"Network error fetching Meater temperature: {e}")
        return jsonify({'error': 'Network error'}), 500
    except Exception as e:
        app.logger.error(f"Error fetching Meater temperature: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.before_serving
async def startup():
    await create_aiohttp_session()

@app.after_serving
async def cleanup():
    await aiohttp_session.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)