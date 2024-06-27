from setuptools import setup, find_packages

setup(
    name='MasterPI',
    version='1.0.0',
    packages=find_packages(),
    install_requires=[
        'Flask',
        'Adafruit-Blinka',
        'Adafruit-PlatformDetect',
        'Adafruit-PureIO',
        'adafruit-circuitpython-max31865',
        'simple-pid',
        'numpy',
        'matplotlib',
    ],
    entry_points={
        'console_scripts': [
            'start-masterpi=app:main',  # Assuming app.py contains a main function to start the app
        ],
    },
)