import os
from dotenv import load_dotenv
import requests

load_dotenv()

supabase_url = os.getenv('SUPABASE_URL')
print(f"Testing connection to: {supabase_url}")

try:
    response = requests.get(f"{supabase_url}/rest/v1/", timeout=10)
    print(f"Status: {response.status_code}")
except Exception as e:
    print(f"Error: {e}")