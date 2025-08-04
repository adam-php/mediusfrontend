import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client
import requests
import jwt
from functools import wraps
from datetime import datetime, timedelta
import hashlib
import hmac
import base64
import time
import uuid
import json

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_KEY')
)

# Tatum API configuration
TATUM_API_URL = "https://api.tatum.io/v3"
TATUM_API_KEY = os.getenv('TATUM_API_KEY')

# PayPal configuration
PAYPAL_CLIENT_ID = os.getenv('PAYPAL_CLIENT_ID')
PAYPAL_CLIENT_SECRET = os.getenv('PAYPAL_CLIENT_SECRET')
PAYPAL_MODE = os.getenv('PAYPAL_MODE', 'sandbox')
PAYPAL_BASE_URL = f"https://api-m.{'sandbox.' if PAYPAL_MODE == 'sandbox' else ''}paypal.com"

# Store wallet IDs for escrows (only IDs, not keys)
ESCROW_WALLET_IDS = {}

# Create a custom JWT decorator that works with Supabase tokens
def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header:
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({'error': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'error': 'Token missing'}), 401
        
        try:
            payload = jwt.decode(
                token,
                os.getenv('SUPABASE_JWT_SECRET'),
                algorithms=['HS256'],
                audience='authenticated'
            )
            request.user_id = payload['sub']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

@app.route('/api/supported-currencies', methods=['GET'])
def get_supported_currencies():
    """Get list of supported cryptocurrencies"""
    currencies = [
        {'code': 'BTC', 'name': 'Bitcoin'},
        {'code': 'ETH', 'name': 'Ethereum'},
        {'code': 'LTC', 'name': 'Litecoin'},
        {'code': 'BCH', 'name': 'Bitcoin Cash'},
        {'code': 'DOGE', 'name': 'Dogecoin'},
        {'code': 'XRP', 'name': 'Ripple'},
        {'code': 'ADA', 'name': 'Cardano'},
        {'code': 'DOT', 'name': 'Polkadot'},
        {'code': 'MATIC', 'name': 'Polygon'},
        {'code': 'SOL', 'name': 'Solana'},
        {'code': 'AVAX', 'name': 'Avalanche'},
        {'code': 'TRX', 'name': 'Tron'},
        {'code': 'BNB', 'name': 'Binance Coin'},
        {'code': 'ATOM', 'name': 'Cosmos'},
        {'code': 'XLM', 'name': 'Stellar'}
    ]
    return jsonify(currencies), 200

@app.route('/api/escrows', methods=['POST'])
@require_auth
def create_escrow():
    try:
        data = request.json
        user_id = request.user_id
        
        # Validate required fields
        required_fields = ['seller_username', 'amount', 'currency', 'payment_method']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400
        
        # Get seller ID from username
        seller_response = supabase.table('profiles').select('id').eq('username', data['seller_username']).execute()
        
        if not seller_response.data or len(seller_response.data) == 0:
            return jsonify({"error": f"User '{data['seller_username']}' not found"}), 404
        
        seller_id = seller_response.data[0]['id']
        
        # Don't allow self-escrow
        if seller_id == user_id:
            return jsonify({"error": "Cannot create escrow with yourself"}), 400
        
        # Create escrow record
        escrow_data = {
            'buyer_id': user_id,
            'seller_id': seller_id,
            'amount': data['amount'],
            'currency': data['currency'],
            'payment_method': data['payment_method']
        }
        
        # Insert escrow into database to get ID
        escrow_response = supabase.table('escrows').insert(escrow_data).execute()
        escrow_id = escrow_response.data[0]['id']
        
        # Generate payment address/invoice based on payment method
        if data['payment_method'] == 'crypto':
            print("Generating crypto address...")
            address = generate_crypto_address(data['currency'], escrow_id)
            if address:
                # Update escrow with deposit address
                supabase.table('escrows').update({'deposit_address': address}).eq('id', escrow_id).execute()
                escrow_response.data[0]['deposit_address'] = address
            else:
                print("ERROR: Failed to generate crypto address")
                return jsonify({"error": "Failed to generate crypto address. Please try again or contact support."}), 500
        
        elif data['payment_method'] == 'paypal':
            print("Creating PayPal order...")
            paypal_order = create_paypal_order(data['amount'], data['currency'])
            if paypal_order:
                # Update escrow with PayPal order ID
                supabase.table('escrows').update({'paypal_order_id': paypal_order['id']}).eq('id', escrow_id).execute()
                escrow_response.data[0]['paypal_order_id'] = paypal_order['id']
            else:
                print("ERROR: Failed to create PayPal order")
                return jsonify({"error": "Failed to create PayPal order"}), 500
        
        return jsonify(escrow_response.data[0]), 201
        
    except Exception as e:
        print(f"Error in create_escrow: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route('/api/escrows/<escrow_id>', methods=['GET'])
@require_auth
def get_escrow(escrow_id):
    try:
        user_id = request.user_id
        
        # Fetch escrow with RLS
        escrow = supabase.table('escrows').select('*').eq('id', escrow_id).single().execute()
        
        if not escrow.data:
            return jsonify({"error": "Escrow not found"}), 404
            
        return jsonify(escrow.data), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/escrows/<escrow_id>/confirm', methods=['POST'])
@require_auth
def confirm_escrow(escrow_id):
    try:
        user_id = request.user_id
        data = request.json
        action = data.get('action')  # 'release' or 'cancel'
        
        # Get escrow
        escrow = supabase.table('escrows').select('*').eq('id', escrow_id).single().execute()
        
        if not escrow.data:
            return jsonify({"error": "Escrow not found"}), 404
        
        # Determine if user is buyer or seller
        update_data = {}
        other_action = None
        
        if escrow.data['buyer_id'] == user_id:
            update_data['buyer_action'] = action
            other_action = escrow.data.get('seller_action')
        elif escrow.data['seller_id'] == user_id:
            update_data['seller_action'] = action
            other_action = escrow.data.get('buyer_action')
        else:
            return jsonify({"error": "Unauthorized"}), 403
        
        # Update the user's action
        updated = supabase.table('escrows').update(update_data).eq('id', escrow_id).execute()
        
        # Check if both parties have selected the same action
        if other_action and other_action == action:
            if action == 'release':
                # Both selected release - complete the transaction
                supabase.table('escrows').update({
                    'status': 'completed',
                    'buyer_confirmed': True,
                    'seller_confirmed': True
                }).eq('id', escrow_id).execute()
                release_funds(escrow_id)
                
                # Add system message
                supabase.table('escrow_messages').insert({
                    'escrow_id': escrow_id,
                    'sender_id': user_id,
                    'message': 'Both parties agreed to release funds. Transaction completed!',
                    'message_type': 'system'
                }).execute()
                
            elif action == 'cancel':
                # Both selected cancel - cancel the transaction
                supabase.table('escrows').update({
                    'status': 'cancelled'
                }).eq('id', escrow_id).execute()
                
                # Add system message
                supabase.table('escrow_messages').insert({
                    'escrow_id': escrow_id,
                    'sender_id': user_id,
                    'message': 'Both parties agreed to cancel. Transaction cancelled.',
                    'message_type': 'system'
                }).execute()
        
        return jsonify(updated.data[0]), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/escrows/<escrow_id>/check-payment', methods=['POST'])
@require_auth
def check_payment_status(escrow_id):
    """Manually check payment status for crypto transactions"""
    try:
        user_id = request.user_id
        
        # Get escrow
        escrow = supabase.table('escrows').select('*').eq('id', escrow_id).single().execute()
        
        if not escrow.data:
            return jsonify({"error": "Escrow not found"}), 404
        
        escrow_data = escrow.data
        
        # Only allow buyer to check payment status
        if escrow_data['buyer_id'] != user_id:
            return jsonify({"error": "Unauthorized"}), 403
        
        if escrow_data['payment_method'] == 'crypto' and escrow_data['deposit_address']:
            # Check if crypto payment was received
            payment_received = check_crypto_payment(
                escrow_data['deposit_address'], 
                escrow_data['currency'], 
                escrow_data['amount']
            )
            
            if payment_received:
                # Update escrow status to funded
                updated = supabase.table('escrows').update({'status': 'funded'}).eq('id', escrow_id).execute()
                
                # Record transaction
                supabase.table('transactions').insert({
                    'escrow_id': escrow_id,
                    'type': 'deposit',
                    'amount': escrow_data['amount'],
                    'currency': escrow_data['currency'],
                    'transaction_hash': 'pending_verification'
                }).execute()
                
                return jsonify({"status": "funded", "escrow": updated.data[0]}), 200
            else:
                return jsonify({"status": "pending", "message": "Payment not yet received"}), 200
        
        return jsonify({"error": "Invalid payment method or missing address"}), 400
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/escrows/<escrow_id>/paypal-approve', methods=['POST'])
@require_auth
def approve_paypal_payment(escrow_id):
    """Handle PayPal payment approval from frontend"""
    try:
        user_id = request.user_id
        
        # Get escrow
        escrow = supabase.table('escrows').select('*').eq('id', escrow_id).single().execute()
        
        if not escrow.data:
            return jsonify({"error": "Escrow not found"}), 404
        
        escrow_data = escrow.data
        
        # Only allow buyer to approve payment
        if escrow_data['buyer_id'] != user_id:
            return jsonify({"error": "Unauthorized"}), 403
        
        if escrow_data['payment_method'] == 'paypal':
            # Update escrow status to funded
            updated = supabase.table('escrows').update({'status': 'funded'}).eq('id', escrow_id).execute()
            
            # Record transaction
            supabase.table('transactions').insert({
                'escrow_id': escrow_id,
                'type': 'deposit',
                'amount': escrow_data['amount'],
                'currency': escrow_data['currency'],
                'paypal_transaction_id': escrow_data['paypal_order_id']
            }).execute()
            
            return jsonify({"status": "funded", "escrow": updated.data[0]}), 200
        
        return jsonify({"error": "Invalid payment method"}), 400
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/escrows/<escrow_id>/refund', methods=['POST'])
@require_auth
def process_refund(escrow_id):
    """Process refund when transaction is cancelled"""
    try:
        user_id = request.user_id
        data = request.json
        buyer_refund_address = data.get('refund_address')
        
        if not buyer_refund_address:
            return jsonify({"error": "Refund address required"}), 400
        
        # Get escrow
        escrow = supabase.table('escrows').select('*').eq('id', escrow_id).single().execute()
        
        if not escrow.data:
            return jsonify({"error": "Escrow not found"}), 404
        
        escrow_data = escrow.data
        
        # Only buyer can request refund
        if escrow_data['buyer_id'] != user_id:
            return jsonify({"error": "Unauthorized"}), 403
        
        # Only process refund if status is cancelled
        if escrow_data['status'] != 'cancelled':
            return jsonify({"error": "Escrow must be cancelled to process refund"}), 400
        
        # Process the refund
        if escrow_data['payment_method'] == 'crypto':
            print(f"🔄 Processing crypto refund for escrow {escrow_id}")
            
            tx_hash = send_crypto_transaction_kms(
                escrow_id,
                buyer_refund_address,
                escrow_data['amount']
            )
            
            if not tx_hash:
                return jsonify({"error": "Failed to process crypto refund"}), 500
                        # Record refund transaction
            supabase.table('transactions').insert({
                'escrow_id': escrow_id,
                'type': 'refund',
                'amount': escrow_data['amount'],
                'currency': escrow_data['currency'],
                'transaction_hash': tx_hash
            }).execute()
            
            # Update escrow status
            supabase.table('escrows').update({
                'status': 'refunded',
                'buyer_refund_address': buyer_refund_address
            }).eq('id', escrow_id).execute()
            
            # Add system message
            supabase.table('escrow_messages').insert({
                'escrow_id': escrow_id,
                'sender_id': user_id,
                'message': f'✅ Refund processed! Transaction: {tx_hash}',
                'message_type': 'system'
            }).execute()
            
            return jsonify({
                "success": True,
                "transaction_hash": tx_hash,
                "message": "Crypto refund processed successfully"
            }), 200
            
        elif escrow_data['payment_method'] == 'paypal':
            # Process PayPal refund
            success = process_paypal_refund(escrow_data['paypal_order_id'], escrow_data['amount'])
            
            if not success:
                return jsonify({"error": "Failed to process PayPal refund"}), 500
            
            # Update escrow status
            supabase.table('escrows').update({'status': 'refunded'}).eq('id', escrow_id).execute()
            
            # Add system message
            supabase.table('escrow_messages').insert({
                'escrow_id': escrow_id,
                'sender_id': user_id,
                'message': '✅ PayPal refund processed successfully!',
                'message_type': 'system'
            }).execute()
            
            return jsonify({
                "success": True,
                "message": "PayPal refund processed successfully"
            }), 200
        
        return jsonify({"error": "Invalid payment method"}), 400
        
    except Exception as e:
        print(f"Error processing refund: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/escrows/user', methods=['GET'])
@require_auth
def get_user_escrows():
    """Get all escrows for the authenticated user"""
    try:
        user_id = request.user_id
        
        # Fetch escrows where user is buyer or seller
        escrows = supabase.table('escrows').select('*').or_(f'buyer_id.eq.{user_id},seller_id.eq.{user_id}').order('created_at', desc=True).execute()
        
        return jsonify(escrows.data), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/paypal/webhook', methods=['POST'])
def paypal_webhook():
    """Handle PayPal webhook notifications"""
    try:
        data = request.json
        event_type = data.get('event_type')
        
        if event_type == 'CHECKOUT.ORDER.APPROVED':
            # Payment was approved, update escrow status
            order_id = data['resource']['id']
            
            # Find escrow by PayPal order ID
            escrow = supabase.table('escrows').select('*').eq('paypal_order_id', order_id).single().execute()
            
            if escrow.data:
                # Update escrow status to funded
                supabase.table('escrows').update({'status': 'funded'}).eq('id', escrow.data['id']).execute()
                
                # Record transaction
                supabase.table('transactions').insert({
                    'escrow_id': escrow.data['id'],
                    'type': 'deposit',
                    'amount': escrow.data['amount'],
                    'currency': escrow.data['currency'],
                    'paypal_transaction_id': order_id
                }).execute()
        
        elif event_type == 'PAYMENT.CAPTURE.COMPLETED':
            # Payment was captured (funds released)
            order_id = data['resource']['supplementary_data']['related_ids']['order_id']
            print(f"PayPal payment captured for order: {order_id}")
        
        return jsonify({"status": "success"}), 200
        
    except Exception as e:
        print(f"PayPal webhook error: {e}")
        return jsonify({"error": str(e)}), 500

def generate_crypto_address(currency, escrow_id):
    """Generate crypto address and SAVE TO DATABASE (COMPLETE VERSION)"""
    try:
        # CHECK IF WALLET ALREADY EXISTS FIRST
        existing_wallet = supabase.table('escrow_wallets').select('*').eq('escrow_id', escrow_id).execute()
        
        if existing_wallet.data and len(existing_wallet.data) > 0:
            print(f"Wallet already exists for escrow {escrow_id}, returning existing address")
            wallet_data = existing_wallet.data[0]
            ESCROW_WALLET_IDS[escrow_id] = wallet_data
            return wallet_data['address']
        
        if not TATUM_API_KEY:
            print("ERROR: TATUM_API_KEY not found")
            return None
            
        headers = {
            'x-api-key': TATUM_API_KEY,
            'Content-Type': 'application/json'
        }
        
        # Complete chain mapping
        chain_map = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'LTC': 'litecoin',
            'BCH': 'bcash',
            'DOGE': 'dogecoin',
            'XRP': 'xrp',
            'ADA': 'ada',
            'DOT': 'polkadot',
            'MATIC': 'polygon',
            'SOL': 'solana',
            'AVAX': 'avalanche',
            'TRX': 'tron',
            'BNB': 'bsc',
            'ATOM': 'cosmos',
            'XLM': 'xlm'
        }
        
        chain = chain_map.get(currency.upper())
        if not chain:
            print(f"ERROR: Unsupported currency: {currency}")
            return None
        
        print(f"Generating wallet for {currency} ({chain})")
        
        # Step 1: Generate wallet using the correct endpoint
        wallet_url = f"{TATUM_API_URL}/{chain}/wallet"
        print(f"Calling: GET {wallet_url}")
        
        wallet_response = requests.get(
            wallet_url,
            headers=headers,
            timeout=30
        )
        
        print(f"Wallet response status: {wallet_response.status_code}")
        print(f"Wallet response: {wallet_response.text}")
        
        if wallet_response.status_code != 200:
            print(f"ERROR: Wallet generation failed with status {wallet_response.status_code}")
            return None
        
        wallet_data = wallet_response.json()
        
        # Extract wallet data
        mnemonic = wallet_data.get('mnemonic')
        xpub = wallet_data.get('xpub')
        
        if not xpub:
            print(f"ERROR: No xpub found in wallet response: {wallet_data}")
            return None
        
        print(f"Generated xpub: {xpub}")
        
        # Step 2: Generate address from xpub
        address_url = f"{TATUM_API_URL}/{chain}/address/{xpub}/0"
        print(f"Getting address from: GET {address_url}")
        
        address_response = requests.get(
            address_url,
            headers=headers,
            timeout=30
        )
        
        print(f"Address response status: {address_response.status_code}")
        print(f"Address response: {address_response.text}")
        
        if address_response.status_code != 200:
            print(f"ERROR: Address generation failed with status {address_response.status_code}")
            return None
        
        address_data = address_response.json()
        
        # Extract address
        address = address_data.get('address')
        if not address:
            print(f"ERROR: No address found in response: {address_data}")
            return None
        
        # SAVE TO DATABASE (NEW PART)
        wallet_record = {
            'escrow_id': escrow_id,
            'mnemonic': mnemonic,
            'xpub': xpub,
            'address': address,
            'currency': currency,
            'chain': chain,
            'address_index': 0
        }
        
        try:
            # Save to database
            db_result = supabase.table('escrow_wallets').insert(wallet_record).execute()
            print(f"✅ Wallet saved to database: {db_result}")
        except Exception as db_error:
            print(f"WARNING: Failed to save wallet to database: {db_error}")
            # Continue anyway - wallet will work for this session
        
        # Store in memory for current session
        ESCROW_WALLET_IDS[escrow_id] = wallet_record
        
        print(f"✅ Generated address: {address}")
        return address
        
    except requests.exceptions.RequestException as e:
        print(f"Network error calling Tatum API: {e}")
        return None
    except Exception as e:
        print(f"Error generating crypto address: {e}")
        import traceback
        print(traceback.format_exc())
        return None

def create_paypal_order(amount, currency):
    """Create a PayPal order"""
    try:
        # Get PayPal access token
        auth_response = requests.post(
            f"{PAYPAL_BASE_URL}/v1/oauth2/token",
            headers={
                'Accept': 'application/json',
                'Accept-Language': 'en_US',
            },
            data={'grant_type': 'client_credentials'},
            auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
        )
        
        if auth_response.status_code != 200:
            print(f"PayPal auth failed: {auth_response.text}")
            return None
        
        access_token = auth_response.json()['access_token']
        
        # Create order
        order_response = requests.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}'
            },
            json={
                'intent': 'CAPTURE',
                'purchase_units': [{
                    'amount': {
                        'currency_code': currency,
                        'value': str(amount)
                    }
                }]
            }
        )
        
        if order_response.status_code != 201:
            print(f"PayPal order creation failed: {order_response.text}")
            return None
        
        return order_response.json()
        
    except Exception as e:
        print(f"Error creating PayPal order: {e}")
        return None

def check_crypto_payment(address, currency, expected_amount):
    """Check if crypto payment was received using Tatum API"""
    try:
        headers = {
            'x-api-key': TATUM_API_KEY,
            'Content-Type': 'application/json'
        }
        
        # Map currency to Tatum chain names
        chain_map = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'LTC': 'litecoin',
            'BCH': 'bcash',
            'DOGE': 'dogecoin',
            'XRP': 'xrp',
            'ADA': 'ada',
            'DOT': 'polkadot',
            'MATIC': 'polygon',
            'SOL': 'solana',
            'AVAX': 'avalanche',
            'TRX': 'tron',
            'BNB': 'bsc',
            'ATOM': 'cosmos',
            'XLM': 'xlm'
        }
        
        chain = chain_map.get(currency.upper())
        if not chain:
            return False
        
        # Check address balance
        balance_url = f"{TATUM_API_URL}/{chain}/address/balance/{address}"
        balance_response = requests.get(
            balance_url,
            headers=headers,
            timeout=30
        )
        
        if balance_response.status_code != 200:
            print(f"Balance check failed: {balance_response.text}")
            return False
        
        balance_data = balance_response.json()
        
        # Check if balance is greater than or equal to expected amount
        if 'incoming' in balance_data:
            balance = float(balance_data['incoming'])
        elif 'balance' in balance_data:
            balance = float(balance_data['balance'])
        else:
            print(f"No balance found in response: {balance_data}")
            return False
        
        return balance >= float(expected_amount)
        
    except Exception as e:
        print(f"Error checking crypto payment: {e}")
        return False

def send_crypto_transaction_kms(escrow_id, to_address, amount):
    """Send crypto - loads wallet from DATABASE"""
    try:
        # Check memory first
        if escrow_id not in ESCROW_WALLET_IDS:
            print(f"Loading wallet from database for escrow {escrow_id}")
            
            # Load from database
            wallet_result = supabase.table('escrow_wallets').select('*').eq('escrow_id', escrow_id).single().execute()
            
            if not wallet_result.data:
                print(f"ERROR: No wallet found in database for escrow {escrow_id}")
                return False
                
            # Store in memory
            ESCROW_WALLET_IDS[escrow_id] = wallet_result.data
        
        wallet_info = ESCROW_WALLET_IDS[escrow_id]
        currency = wallet_info['currency']
        chain = wallet_info['chain']
        from_address = wallet_info['address']
        mnemonic = wallet_info['mnemonic']
        index = wallet_info.get('address_index', 0)
        
        headers = {
            'x-api-key': TATUM_API_KEY,
            'Content-Type': 'application/json'
        }
        
        print(f"🚀 Sending {amount} {currency} from {from_address} to {to_address}")
        
        # Get private key
        privkey_url = f"{TATUM_API_URL}/{chain}/wallet/priv"
        privkey_data = {
            "mnemonic": mnemonic,
            "index": index
        }
        
        privkey_response = requests.post(privkey_url, headers=headers, json=privkey_data, timeout=30)
        
        if privkey_response.status_code != 200:
            print(f"ERROR: Failed to get private key: {privkey_response.text}")
            return False
        
        private_key = privkey_response.json().get('key')
        
        # Send transaction
        if currency in ['BTC', 'LTC', 'BCH', 'DOGE']:
            tx_data = {
                "fromAddress": [{
                    "address": from_address,
                    "privateKey": private_key
                }],
                "to": [{
                    "address": to_address,
                    "value": float(amount)
                }]
            }
            send_url = f"{TATUM_API_URL}/{chain}/transaction"
            
        elif currency in ['ETH', 'MATIC', 'BNB']:
            tx_data = {
                "fromPrivateKey": private_key,
                "to": to_address,
                "amount": str(amount),
                "currency": currency
            }
            send_url = f"{TATUM_API_URL}/{chain}/transaction"
        else:
            print(f"ERROR: Transaction not implemented for {currency}")
            return False
        
        response = requests.post(send_url, headers=headers, json=tx_data, timeout=120)
        
        print(f"Transaction response status: {response.status_code}")
        print(f"Transaction response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            tx_hash = result.get('txId') or result.get('transactionHash')
            print(f"✅ SUCCESS! Transaction hash: {tx_hash}")
            return tx_hash
        else:
            print(f"❌ ERROR: Transaction failed")
            return False
            
    except Exception as e:
        print(f"ERROR sending crypto transaction: {e}")
        import traceback
        print(traceback.format_exc())
        return False

def release_funds(escrow_id):
    """Release funds from escrow"""
    try:
        # Get escrow details
        escrow = supabase.table('escrows').select('*').eq('id', escrow_id).single().execute()
        
        if not escrow.data:
            print(f"ERROR: Escrow {escrow_id} not found")
            return False
        
        escrow_data = escrow.data
        
        if escrow_data['payment_method'] == 'crypto':
            if not escrow_data.get('seller_address'):
                print(f"ERROR: No seller address for escrow {escrow_id}")
                
                # Add error message to chat
                supabase.table('escrow_messages').insert({
                    'escrow_id': escrow_id,
                    'sender_id': escrow_data['seller_id'],
                    'message': '❌ Cannot release funds: Seller address not provided',
                    'message_type': 'system'
                }).execute()
                
                return False
                
            print(f"🚀 RELEASING {escrow_data['amount']} {escrow_data['currency']} to {escrow_data['seller_address']}")
            
            # Send crypto using regular transaction function (NOT KMS)
            tx_hash = send_crypto_transaction_kms(  # <-- Changed from send_crypto_transaction_kms
                escrow_id,
                escrow_data['seller_address'],
                escrow_data['amount']
            )
            
            if not tx_hash:
                print("❌ FAILED to send crypto!")
                
                # Add system message about failure
                supabase.table('escrow_messages').insert({
                    'escrow_id': escrow_id,
                    'sender_id': escrow_data['seller_id'],
                    'message': f'❌ Failed to release funds. Please contact support. Escrow ID: {escrow_id}',
                    'message_type': 'system'
                }).execute()
                
                return False
            
            print(f"✅ SUCCESS! Transaction hash: {tx_hash}")
            
            # Record the successful transaction
            supabase.table('transactions').insert({
                'escrow_id': escrow_id,
                'type': 'release',
                'amount': escrow_data['amount'],
                'currency': escrow_data['currency'],
                'transaction_hash': tx_hash
            }).execute()
            
            # Add success message to chat
            supabase.table('escrow_messages').insert({
                'escrow_id': escrow_id,
                'sender_id': escrow_data['seller_id'],
                'message': f'✅ Funds released! Transaction: {tx_hash}',
                'message_type': 'system'
            }).execute()
            
        elif escrow_data['payment_method'] == 'paypal':
            # PayPal release code stays the same
            print(f"💳 Capturing PayPal payment for order {escrow_data['paypal_order_id']}")
            
            success = capture_paypal_payment(escrow_data['paypal_order_id'])
            
            if not success:
                print("❌ FAILED to capture PayPal payment!")
                
                # Add error message to chat
                supabase.table('escrow_messages').insert({
                    'escrow_id': escrow_id,
                    'sender_id': escrow_data['seller_id'],
                    'message': '❌ Failed to capture PayPal payment. Please contact support.',
                    'message_type': 'system'
                }).execute()
                
                return False
            
            print("✅ PayPal payment captured successfully!")
            
            # Record PayPal transaction
            supabase.table('transactions').insert({
                'escrow_id': escrow_id,
                'type': 'release',
                'amount': escrow_data['amount'],
                'currency': escrow_data['currency'],
                'paypal_transaction_id': escrow_data['paypal_order_id']
            }).execute()
            
            # Add success message to chat
            supabase.table('escrow_messages').insert({
                'escrow_id': escrow_id,
                'sender_id': escrow_data['seller_id'],
                'message': '✅ PayPal funds released to seller!',
                'message_type': 'system'
            }).execute()
        
        return True
        
    except Exception as e:
        print(f"ERROR releasing funds: {e}")
        import traceback
        print(traceback.format_exc())
        
        # Try to add error message to chat
        try:
            supabase.table('escrow_messages').insert({
                'escrow_id': escrow_id,
                'sender_id': escrow_data.get('seller_id', 'system'),
                'message': f'❌ System error releasing funds: {str(e)}',
                'message_type': 'system'
            }).execute()
        except:
            pass
            
        return False

def capture_paypal_payment(order_id):
    """Capture PayPal payment"""
    try:
        # Get PayPal access token
        auth_response = requests.post(
            f"{PAYPAL_BASE_URL}/v1/oauth2/token",
            headers={
                'Accept': 'application/json',
                'Accept-Language': 'en_US',
            },
            data={'grant_type': 'client_credentials'},
            auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
        )
        
        if auth_response.status_code != 200:
            return False
        
        access_token = auth_response.json()['access_token']
        
        # Capture the order
        capture_response = requests.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}'
            }
        )
        
        return capture_response.status_code == 201
        
    except Exception as e:
        print(f"Error capturing PayPal payment: {e}")
        return False

def process_paypal_refund(order_id, amount):
    """Process PayPal refund"""
    try:
        # Get PayPal access token
        auth_response = requests.post(
            f"{PAYPAL_BASE_URL}/v1/oauth2/token",
            headers={
                'Accept': 'application/json',
                'Accept-Language': 'en_US',
            },
            data={'grant_type': 'client_credentials'},
            auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
        )
        
        if auth_response.status_code != 200:
            print(f"PayPal auth failed: {auth_response.text}")
            return False
        
        access_token = auth_response.json()['access_token']
        
        # Process refund
        refund_response = requests.post(
            f"{PAYPAL_BASE_URL}/v2/payments/captures/{order_id}/refund",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}'
            },
            json={
                'amount': {
                    'currency_code': 'USD',
                    'value': str(amount)
                }
            }
        )
        
        return refund_response.status_code == 201
        
    except Exception as e:
        print(f"Error processing PayPal refund: {e}")
        return False
@app.route('/api/escrows/<escrow_id>/recover-and-release', methods=['POST'])
@require_auth
def recover_and_release(escrow_id):
    """Emergency recovery - regenerate wallet from blockchain and release funds"""
    try:
        # Get escrow details
        escrow = supabase.table('escrows').select('*').eq('id', escrow_id).single().execute()
        
        if not escrow.data:
            return jsonify({"error": "Escrow not found"}), 404
        
        escrow_data = escrow.data
        
        # Get the deposit address
        deposit_address = escrow_data.get('deposit_address')
        if not deposit_address:
            return jsonify({"error": "No deposit address found"}), 400
            
        print(f"Recovering wallet for address: {deposit_address}")
        
        # Check the balance first
        headers = {
            'x-api-key': TATUM_API_KEY,
            'Content-Type': 'application/json'
        }
        
        currency = escrow_data['currency']
        chain_map = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'LTC': 'litecoin',
            'BCH': 'bcash',
            'DOGE': 'dogecoin',
        }
        
        chain = chain_map.get(currency.upper())
        
        # Check balance
        balance_url = f"{TATUM_API_URL}/{chain}/address/balance/{deposit_address}"
        balance_response = requests.get(balance_url, headers=headers)
        
        if balance_response.status_code == 200:
            balance_data = balance_response.json()
            print(f"Address balance: {balance_data}")
        
        # Generate a NEW wallet to send from
        wallet_url = f"{TATUM_API_URL}/{chain}/wallet"
        wallet_response = requests.get(wallet_url, headers=headers)
        
        if wallet_response.status_code != 200:
            return jsonify({"error": "Failed to generate recovery wallet"}), 500
            
        wallet_data = wallet_response.json()
        mnemonic = wallet_data['mnemonic']
        
        # Get private key for the ORIGINAL deposit address
        # This requires you to have saved the original mnemonic somewhere
        # If you don't have it, we need to use a different approach
        
        # For now, let's create a manual transfer request
        return jsonify({
            "error": "Manual intervention required",
            "deposit_address": deposit_address,
            "balance": balance_data if 'balance_data' in locals() else "unknown",
            "seller_address": escrow_data.get('seller_address'),
            "amount": escrow_data.get('amount'),
            "instructions": "Please manually transfer funds using Tatum dashboard or another wallet that has access to this address"
        }), 400
        
    except Exception as e:
        print(f"Recovery error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)