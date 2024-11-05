"""
This module modifies the `csrf.py` file in the `quart_csrf` package
to replace the `safe_str_cmp` import with a custom implementation.
"""

import os
import sys

def find_csrf_file():
    """
    Locate the `csrf.py` file in the `quart_csrf` package.
    
    Returns:
        str: The path to the `csrf.py` file.
    
    Raises:
        FileNotFoundError: If the `csrf.py` file is not found.
    """
    site_packages = next(p for p in sys.path if 'site-packages' in p)
    csrf_file_path = os.path.join(site_packages, 'quart_csrf', 'csrf.py')
    
    if not os.path.exists(csrf_file_path):
        raise FileNotFoundError(f"Could not find csrf.py at {csrf_file_path}")
    
    return csrf_file_path

def modify_csrf_file(file_path):
    """
    Modify the `csrf.py` file to replace the `safe_str_cmp` import with a custom function.
    
    Args:
        file_path (str): The path to the `csrf.py` file.
    """
    with open(file_path, 'r', encoding='utf-8') as file:
        lines = file.readlines()
    
    with open(file_path, 'w', encoding='utf-8') as file:
        for line in lines:
            if 'from werkzeug.security import safe_str_cmp' in line:
                file.write('def safe_str_cmp(a, b):\n')
                file.write('    if len(a) != len(b):\n')
                file.write('        return False\n')
                file.write('    result = 0\n')
                file.write('    for x, y in zip(a, b):\n')
                file.write('        result |= ord(x) ^ ord(y)\n')
                file.write('    return result == 0\n')
            else:
                file.write(line)

if __name__ == "__main__":
    try:
        path_to_csrf_file = find_csrf_file()
        modify_csrf_file(path_to_csrf_file)
        print(f"Successfully modified {path_to_csrf_file}")
    except FileNotFoundError as e:
        print(f"File not found: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")