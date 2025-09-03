#!/usr/bin/env python3
"""
Server Diagnostic Script for Medius Backend
Checks if the backend server is running and listening on the expected port
"""

import socket
import requests
import time
import os
from pyngrok import ngrok, conf

def check_port(port: int) -> bool:
    """Check if a port is already in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def get_running_processes():
    """Get processes running on common ports"""
    common_ports = [5000, 5001, 8000, 8001, 3000, 3001]
    running = []

    for port in common_ports:
        if check_port(port):
            running.append(port)

    return running

def test_backend_health(port: int) -> tuple:
    """Test if backend server is responding"""
    try:
        response = requests.get(f"http://localhost:{port}/api/system/status", timeout=5)
        return response.status_code == 200, response.status_code
    except requests.exceptions.RequestException as e:
        return False, f"Connection failed: {str(e)}"

def start_ngrok_tunnel(local_port: int, ngrok_auth_token: str = None):
    """Start ngrok tunnel pointing to local backend"""

    # Configure ngrok
    if ngrok_auth_token:
        conf.get_default().auth_token = ngrok_auth_token

    # Kill any existing tunnels
    ngrok.kill()

    # Start tunnel
    public_tunnel = ngrok.connect(local_port, "http", hostname="")

    
🚀 Ngrok tunnel established!"    print(f"📍 Local:  http://localhost:{local_port}")
    print(f"🌐 Public: {public_tunnel.public_url}")
    print(f"🔒 HTTPS:  {public_tunnel.public_url.replace('http://', 'https://')}")

    return public_tunnel.public_url

def main():
    print("🔍 Medius Backend Diagnostic Tool")
    print("=" * 50)

    # Check running processes
    running_ports = get_running_processes()
    if running_ports:
        print(f"📋 Ports currently running: {', '.join(map(str, running_ports))}")
    else:
        print("❌ No servers detected on common ports")

    # Test common ports
    print("\n🔍 Testing backend servers...")
    test_ports = [5000, 8000, 3000]  # Skip 3001 as that's likely frontend

    backend_running = False
    backend_port = None

    for port in test_ports:
        print(f"Testing port {port}...", end=" ")
        is_healthy, result = test_backend_health(port)
        if is_healthy:
            print("✅ Backend running!")
            backend_running = True
            backend_port = port
            break
        else:
            print(f"❌ {result}")

    if not backend_running:
        print("\n❌ No backend server detected!")
        print("\n💡 How to start your backend server:")
        print("   cd backend")
        print("   pip install -r requirements.txt")
        print("   python app.py")
        print("\n💡 Make sure you're in the backend directory with your environment variables.")
        return

    print(f"\n✅ Backend server running on port {backend_port}")

    # Check for ngrok auth token
    ngrok_token = os.getenv('NGROK_AUTH_TOKEN')
    if not ngrok_token:
        print("\n⚠️  No NGROK_AUTH_TOKEN found in environment")
        print("💡 Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken")
        print("💡 Add to backend/.env: NGROK_AUTH_TOKEN=your_token_here")

    # Offer to start ngrok tunnel
    while True:
        print(f"\n🔗 Start ngrok tunnel for port {backend_port}? (y/n)", end=" ")
        choice = input().lower().strip()

        if choice == 'y':
            try:
                public_url = start_ngrok_tunnel(backend_port, ngrok_token)

                print("\n✅ Tunnel established! Use this URL in your frontend environment:")
                print(f"   NEXT_PUBLIC_API_URL={public_url}")
                print("\n💡 Add this to your frontend/.env.local file")

                print("
⏹️  Press Ctrl+C to stop the tunnel"                print("🔄 The tunnel will stay active while this script runs")

                try:
                    while True:
                        time.sleep(1)
                except KeyboardInterrupt:
                    print("\n\n👋 Stopping ngrok tunnel...")
                    ngrok.kill()
                    print("✅ Tunnel stopped")

            except Exception as e:
                print(f"❌ Failed to start ngrok tunnel: {str(e)}")
                print("🔧 Troubleshooting steps:")
                print("   1. Install ngrok CLI: https://ngrok.com/download")
                print("   2. Set up auth token: ngrok config add-authtoken YOUR_TOKEN")
                print("   3. Run: ngrok http 5000")
                break

        elif choice == 'n':
            print("
🔍 Backend server diagnostic complete!"            print("
💡 To manually start ngrok tunnel:"            print(f"   ngrok http {backend_port}")
            break
        else:
            print("Please enter 'y' or 'n'")

if __name__ == "__main__":
    main()