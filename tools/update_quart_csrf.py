import os
import re

def update_csrf_file():
    # Path to the csrf.py file in the quart_csrf package
    csrf_file_path = os.path.expanduser("~/.local/lib/python3.9/site-packages/quart_csrf/csrf.py")

    # Read the content of the file
    with open(csrf_file_path, 'r') as file:
        content = file.read()

    # Replace the import statement
    content = re.sub(r'from werkzeug.security import safe_str_cmp', 'import hmac', content)

    # Replace the usage of safe_str_cmp with hmac.compare_digest
    content = re.sub(r'safe_str_cmp', 'hmac.compare_digest', content)

    # Write the updated content back to the file
    with open(csrf_file_path, 'w') as file:
        file.write(content)

    print(f"Updated {csrf_file_path} successfully.")

if __name__ == "__main__":
    update_csrf_file()