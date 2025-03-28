import sys
import os
import site

print("=== PYTHON ENVIRONMENT DETAILS ===")
print(f"Python Version: {sys.version}")
print(f"Python Executable: {sys.executable}")
print(f"Python Prefix: {sys.prefix}")
print(f"Working Directory: {os.getcwd()}")
print("\nEnvironment Variables:")
print(f"PYTHONPATH: {os.environ.get('PYTHONPATH', 'Not set')}")
print(f"VIRTUAL_ENV: {os.environ.get('VIRTUAL_ENV', 'Not set')}")

print("\nAll sys.path locations:")
for idx, path in enumerate(sys.path):
    print(f"{idx + 1}. {path}")

print("\nSite Packages:")
for site_pkg in site.getsitepackages():
    print(f"- {site_pkg}")
    if os.path.exists(site_pkg):
        print("  Contents:")
        try:
            for item in os.listdir(site_pkg):
                if 'pytesseract' in item.lower():
                    print(f"  * {item} (PYTESSERACT FOUND)")
                else:
                    print(f"  * {item}")
        except Exception as e:
            print(f"  Error reading directory: {e}")

print("\nTrying to locate pytesseract:")
try:
    import pytesseract
    print(f"Successfully imported pytesseract from: {pytesseract.__file__}")
except ImportError as e:
    print(f"Failed to import pytesseract: {e}")
    print("Searching for pytesseract.py in all paths...")
    for path in sys.path:
        try:
            contents = os.listdir(path)
            matches = [f for f in contents if 'pytesseract' in f.lower()]
            if matches:
                print(f"Found potential matches in {path}:")
                for match in matches:
                    print(f"  - {match}")
        except:
            continue