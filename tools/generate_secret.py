"""
This module generates a secret key using the secrets library.
"""

import secrets

secret_key = secrets.token_hex(32)
print(secret_key)