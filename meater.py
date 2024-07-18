import aiohttp
import os  # Import the os module

class MeaterApi:
    def __init__(self, session):
        self.session = session
        self.base_url = 'https://public-api.cloud.meater.com/v1/'
        self.jwt = os.getenv('MEATER_JWT')  # Load JWT from environment variable

    async def devices(self):
        headers = {
            'Authorization': f'Bearer {self.jwt}'
        }
        async with self.session.get(f'{self.base_url}devices', headers=headers) as response:
            if response.status != 200:
                raise aiohttp.ClientError(f'Failed to fetch devices: {response.status}')
            return await response.json()