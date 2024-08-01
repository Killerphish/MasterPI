import os
import sys

def find_csrf_file():
    # Locate the site-packages directory
    site_packages = next(p for p in sys.path if 'site-packages' in p)
    
    # Construct the path to the csrf.py file
    csrf_file_path = os.path.join(site_packages, 'quart_csrf', 'csrf.py')
    
    if not os.path.exists(csrf_file_path):
        raise FileNotFoundError(f"Could not find csrf.py at {csrf_file_path}")
    
    return csrf_file_path

def modify_csrf_file(csrf_file_path):
    with open(csrf_file_path, 'r') as file:
        lines = file.readlines()
    
    with open(csrf_file_path, 'w') as file:
        for line in lines:
            if 'from werkzeug.security import safe_str_cmp' in line:
                # Replace the import line with the custom function
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
        csrf_file_path = find_csrf_file()
        modify_csrf_file(csrf_file_path)
        print(f"Successfully modified {csrf_file_path}")
    except Exception as e:
        print(f"An error occurred: {e}")