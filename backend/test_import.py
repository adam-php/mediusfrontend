#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

try:
    print("Testing Flask import...")
    from flask import Flask
    print("✓ Flask imported successfully")

    print("Testing app import...")
    import app
    print("✓ App imported successfully")

except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
