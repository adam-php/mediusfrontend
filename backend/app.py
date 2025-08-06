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
    os.getenv('SUPABASE_SERVICE_KEY')
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
        
        # Calculate platform fees
        fee_info = calculate_platform_fee(data['amount'], data['currency'], data['payment_method'])
        
        # Create escrow record with fee information
        escrow_data = {
            'buyer_id': user_id,
            'seller_id': seller_id,
            'amount': data['amount'],
            'currency': data['currency'],
            'payment_method': data['payment_method'],
            'platform_fee_rate': fee_info['fee_rate'],
            'platform_fee_amount': fee_info['fee_amount'],
            'usd_amount': fee_info['usd_amount'],
            'net_amount': fee_info['net_amount']
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
            # Create PayPal order for the FULL amount (buyer pays total including fee)
            paypal_order = create_paypal_order(data['amount'], data['currency'], fee_info)
            if paypal_order:
                # Update escrow with PayPal order ID
                supabase.table('escrows').update({'paypal_order_id': paypal_order['id']}).eq('id', escrow_id).execute()
                escrow_response.data[0]['paypal_order_id'] = paypal_order['id']
                escrow_response.data[0]['paypal_approval_url'] = paypal_order.get('approval_url')
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

def calculate_platform_fee(amount, currency, payment_method):
    """Calculate platform fee based on payment method and amount"""
    try:
        amount_float = float(amount)
        
        if payment_method == 'crypto':
            # Crypto fees: < $50 = 2%, >= $50 = 1.5%
            if amount_float < 50:
                fee_rate = 0.02  # 2%
            else:
                fee_rate = 0.015  # 1.5%
        elif payment_method == 'paypal':
            # PayPal fees: 2%
            fee_rate = 0.02  # 2%
        else:
            fee_rate = 0.02  # Default 2%
        
        fee_amount = amount_float * fee_rate
        net_amount = amount_float - fee_amount
        
        return {
            'fee_rate': fee_rate,
            'fee_amount': round(fee_amount, 8),
            'net_amount': round(net_amount, 8),
            'usd_amount': amount_float  # Assuming USD for now
        }
        
    except (ValueError, TypeError):
        return {
            'fee_rate': 0.02,
            'fee_amount': 0,
            'net_amount': float(amount),
            'usd_amount': float(amount)
        }
        
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

@app.route('/api/escrows/<escrow_id>/paypal-create', methods=['POST'])
@require_auth
def create_paypal_order_for_escrow(escrow_id):
    """Create PayPal order for existing escrow"""
    try:
        user_id = request.user_id
        
        # Get escrow
        escrow = supabase.table('escrows').select('*').eq('id', escrow_id).single().execute()
        
        if not escrow.data:
            return jsonify({"error": "Escrow not found"}), 404
        
        escrow_data = escrow.data
        
        # Only buyer can create PayPal order
        if escrow_data['buyer_id'] != user_id:
            return jsonify({"error": "Unauthorized"}), 403
        
        # Only for PayPal payment method
        if escrow_data['payment_method'] != 'paypal':
            return jsonify({"error": "Invalid payment method"}), 400
        
        # Calculate fees if not already calculated
        if not escrow_data.get('platform_fee_amount'):
            fee_info = calculate_platform_fee(escrow_data['amount'], escrow_data['currency'], 'paypal')
            
            # Update escrow with fee info
            supabase.table('escrows').update({
                'platform_fee_rate': fee_info['fee_rate'],
                'platform_fee_amount': fee_info['fee_amount'],
                'net_amount': fee_info['net_amount'],
                'usd_amount': fee_info['usd_amount']
            }).eq('id', escrow_id).execute()
            
            escrow_data.update(fee_info)
        else:
            fee_info = {
                'fee_rate': escrow_data['platform_fee_rate'],
                'fee_amount': escrow_data['platform_fee_amount'],
                'net_amount': escrow_data['net_amount'],
                'usd_amount': escrow_data['usd_amount']
            }
        
        # Create PayPal order
        print(f"Creating PayPal order for escrow {escrow_id}")
        paypal_order = create_paypal_order(escrow_data['amount'], escrow_data['currency'], fee_info)
        
        if not paypal_order:
            return jsonify({"error": "Failed to create PayPal order"}), 500
        
        # Update escrow with PayPal order ID
        supabase.table('escrows').update({
            'paypal_order_id': paypal_order['id']
        }).eq('id', escrow_id).execute()
        
        return jsonify({
            "success": True,
            "paypal_order_id": paypal_order['id'],
            "approval_url": paypal_order['approval_url']
        }), 200
        
    except Exception as e:
        print(f"Error creating PayPal order: {e}")
        return jsonify({"error": str(e)}), 500

def create_paypal_order(amount, currency, fee_info):
    """Create a PayPal order with fee breakdown"""
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
        
        # For now, create a simple order for the full amount
        # In production, you'd want to use PayPal's marketplace features for automatic splitting
        order_response = requests.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())  # Idempotency key
            },
            json={
                'intent': 'AUTHORIZE',  # Changed from CAPTURE to AUTHORIZE for escrow
                'purchase_units': [{
                    'reference_id': f'escrow_{int(time.time())}',
                    'amount': {
                        'currency_code': 'USD',  # Hardcoded for now
                        'value': str(amount),
                        'breakdown': {
                            'item_total': {
                                'currency_code': 'USD',
                                'value': str(fee_info['net_amount'])
                            },
                            'handling': {
                                'currency_code': 'USD', 
                                'value': str(fee_info['fee_amount'])
                            }
                        }
                    },
                    'items': [{
                        'name': f'Escrow Transaction ({currency})',
                        'quantity': '1',
                        'unit_amount': {
                            'currency_code': 'USD',
                            'value': str(fee_info['net_amount'])
                        }
                    }],
                    'description': f'Escrow payment with {fee_info["fee_rate"]*100}% platform fee'
                }],
                'application_context': {
                    'return_url': f'{os.getenv("FRONTEND_URL", "http://localhost:3000")}/escrow/success',
                    'cancel_url': f'{os.getenv("FRONTEND_URL", "http://localhost:3000")}/escrow/cancel',
                    'brand_name': 'Medius Escrow',
                    'locale': 'en-US',
                    'user_action': 'PAY_NOW'
                }
            }
        )
        
        if order_response.status_code != 201:
            print(f"PayPal order creation failed: {order_response.text}")
            return None
        
        order_data = order_response.json()
        
        # Extract approval URL
        approval_url = None
        for link in order_data.get('links', []):
            if link.get('rel') == 'approve':
                approval_url = link.get('href')
                break
        
        return {
            'id': order_data['id'],
            'approval_url': approval_url,
            'status': order_data['status']
        }
        
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

def release_paypal_funds_to_seller(escrow_id, authorization_id, seller_paypal_email):
    """Capture payment and send to seller via PayPal Payouts"""
    try:
        # Get escrow details
        escrow = supabase.table('escrows').select('*').eq('id', escrow_id).single().execute()
        if not escrow.data:
            return False
            
        escrow_data = escrow.data
        
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
        
        # Step 1: Capture the authorized payment (money comes to platform account)
        capture_response = requests.post(
            f"{PAYPAL_BASE_URL}/v2/payments/authorizations/{authorization_id}/capture",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json={
                'amount': {
                    'currency_code': 'USD',
                    'value': str(escrow_data['amount'])  # Capture full amount
                },
                'final_capture': True,
                'note_to_payer': 'Medius Escrow - Payment captured'
            }
        )
        
        if capture_response.status_code != 201:
            print(f"❌ PayPal capture failed: {capture_response.text}")
            return False
        
        print("✅ PayPal payment captured to platform account")
        
        # Step 2: Send net amount to seller via Payouts API
        payout_response = requests.post(
            f"{PAYPAL_BASE_URL}/v1/payments/payouts",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json={
                'sender_batch_header': {
                    'sender_batch_id': f'escrow_{escrow_id}_{int(time.time())}',
                    'email_subject': 'Medius Escrow - Payment Released',
                    'email_message': f'Your escrow payment of ${escrow_data.get("net_amount", escrow_data["amount"])} has been released.'
                },
                'items': [{
                    'recipient_type': 'EMAIL',
                    'amount': {
                        'value': str(escrow_data.get('net_amount', escrow_data['amount'])),
                        'currency': 'USD'
                    },
                    'receiver': seller_paypal_email,
                    'note': f'Medius Escrow Release - Transaction #{escrow_id[:8]}',
                    'sender_item_id': f'escrow_{escrow_id}'
                }]
            }
        )
        
        if payout_response.status_code == 201:
            print(f"✅ Payout sent to seller: {seller_paypal_email}")
            return True
        else:
            print(f"❌ Payout failed: {payout_response.text}")
            return False
            
    except Exception as e:
        print(f"Error releasing PayPal funds: {e}")
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
                
            print(f"🚀 RELEASING {escrow_data['net_amount']} {escrow_data['currency']} to seller (after {escrow_data['platform_fee_amount']} fee)")
            
            # For crypto, we need to send net_amount to seller and handle platform fee separately
            # This requires more complex transaction splitting - for now, send full amount to seller
            # In production, you'd want to implement proper multi-output transactions
            tx_hash = send_crypto_transaction_kms(
                escrow_id,
                escrow_data['seller_address'],
                escrow_data['net_amount']  # Send net amount to seller
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
                'amount': escrow_data['net_amount'],
                'currency': escrow_data['currency'],
                'transaction_hash': tx_hash,
                'usd_amount': escrow_data['net_amount']
            }).execute()
            
            # Record platform fee transaction
            supabase.table('transactions').insert({
                'escrow_id': escrow_id,
                'type': 'platform_fee',
                'amount': escrow_data['platform_fee_amount'],
                'currency': escrow_data['currency'],
                'transaction_hash': tx_hash,
                'usd_amount': escrow_data['platform_fee_amount']
            }).execute()
            
            # Add success message to chat
            supabase.table('escrow_messages').insert({
                'escrow_id': escrow_id,
                'sender_id': escrow_data['seller_id'],
                'message': f'✅ Funds released! Seller receives: {escrow_data["net_amount"]} {escrow_data["currency"]} (Platform fee: {escrow_data["platform_fee_amount"]}). Transaction: {tx_hash}',
                'message_type': 'system'
            }).execute()
            
        elif escrow_data['payment_method'] == 'paypal':
            print(f"\U0001F4B3 Releasing PayPal payment to seller")
            
            paypal_data = escrow_data.get('paypal_order_id')
            seller_email = escrow_data.get('seller_paypal_email')
            
            if not paypal_data:
                print("❌ No PayPal data found")
                return False
                
            if not seller_email:
                print("❌ No seller PayPal email found")
                supabase.table('escrow_messages').insert({
                    'escrow_id': escrow_id,
                    'sender_id': escrow_data['seller_id'],
                    'message': '❌ Cannot release funds: Seller PayPal email not provided',
                    'message_type': 'system'
                }).execute()
                return False
            
            # Parse authorization ID
            if '|' in paypal_data:
                order_id, authorization_id = paypal_data.split('|', 1)
            else:
                authorization_id = paypal_data
            
            success = release_paypal_funds_to_seller(escrow_id, authorization_id, seller_email)
            
            if not success:
                print("❌ FAILED to release PayPal payment!")
                supabase.table('escrow_messages').insert({
                    'escrow_id': escrow_id,
                    'sender_id': escrow_data['seller_id'],
                    'message': '❌ Failed to release PayPal payment. Please contact support.',
                    'message_type': 'system'
                }).execute()
                return False
            
            print("✅ PayPal payment released to seller!")
            
            # Record transaction
            supabase.table('transactions').insert({
                'escrow_id': escrow_id,
                'type': 'release',
                'amount': escrow_data.get('net_amount', escrow_data['amount']),
                'currency': escrow_data['currency'],
                'paypal_transaction_id': authorization_id,
                'usd_amount': escrow_data.get('net_amount', escrow_data['amount'])
            }).execute()
            
            # Add success message
            supabase.table('escrow_messages').insert({
                'escrow_id': escrow_id,
                'sender_id': escrow_data['seller_id'],
                'message': f'✅ PayPal funds released to {seller_email}! Amount: ${escrow_data.get("net_amount", escrow_data["amount"])}',
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

def create_paypal_order(amount, currency, fee_info):
    """Create a PayPal AUTHORIZATION order (real escrow)"""
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
        
        # Create AUTHORIZATION order (NOT capture - this is real escrow)
        order_response = requests.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json={
                'intent': 'AUTHORIZE',  # This holds the money without capturing
                'purchase_units': [{
                    'reference_id': f'escrow_{int(time.time())}',
                    'amount': {
                        'currency_code': 'USD',
                        'value': str(amount)
                    },
                    'description': f'Medius Escrow - Amount: ${amount}, Fee: ${fee_info["fee_amount"]}'
                }],
                'application_context': {
                    'return_url': f'{os.getenv("FRONTEND_URL", "http://localhost:3000")}/escrow/paypal/success',
                    'cancel_url': f'{os.getenv("FRONTEND_URL", "http://localhost:3000")}/escrow/paypal/cancel',
                    'brand_name': 'Medius Escrow',
                    'locale': 'en-US',
                    'user_action': 'PAY_NOW',
                    'shipping_preference': 'NO_SHIPPING'
                }
            }
        )
        
        if order_response.status_code != 201:
            print(f"PayPal order creation failed: {order_response.text}")
            return None
        
        order_data = order_response.json()
        
        # Extract approval URL
        approval_url = None
        for link in order_data.get('links', []):
            if link.get('rel') == 'approve':
                approval_url = link.get('href')
                break
        
        return {
            'id': order_data['id'],
            'approval_url': approval_url,
            'status': order_data['status']
        }
        
    except Exception as e:
        print(f"Error creating PayPal order: {e}")
        return None

@app.route('/api/escrows/<escrow_id>/paypal-email', methods=['POST'])
@require_auth
def save_seller_paypal_email(escrow_id):
    """Save seller's PayPal email"""
    try:
        user_id = request.user_id
        data = request.json
        paypal_email = data.get('paypal_email')
        
        if not paypal_email:
            return jsonify({"error": "PayPal email required"}), 400
        
        # Verify user is the seller
        escrow = supabase.table('escrows').select('*').eq('id', escrow_id).single().execute()
        if not escrow.data or escrow.data['seller_id'] != user_id:
            return jsonify({"error": "Unauthorized"}), 403
        
        # Update escrow with seller's PayPal email
        updated = supabase.table('escrows').update({
            'seller_paypal_email': paypal_email
        }).eq('id', escrow_id).execute()
        
        return jsonify({"success": True}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/escrows/<escrow_id>/paypal-authorize', methods=['POST'])
@require_auth
def handle_paypal_authorization(escrow_id):
    """Handle PayPal authorization after user returns from PayPal"""
    try:
        data = request.json
        token = data.get('token')  # PayPal order ID from URL params
        
        if not token:
            return jsonify({"error": "Missing PayPal token"}), 400
        
        # Get escrow
        escrow = supabase.table('escrows').select('*').eq('id', escrow_id).single().execute()
        if not escrow.data:
            return jsonify({"error": "Escrow not found"}), 404
            
        escrow_data = escrow.data
        
        # Verify the authorization with PayPal
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
            return jsonify({"error": "PayPal authentication failed"}), 500
        
        access_token = auth_response.json()['access_token']
        
        # Get order details to verify authorization
        order_response = requests.get(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{token}",
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
        )
        
        if order_response.status_code != 200:
            return jsonify({"error": "Failed to verify PayPal order"}), 500
            
        order_data = order_response.json()
        
        # Check if order is approved
        if order_data.get('status') != 'APPROVED':
            return jsonify({"error": "PayPal order not approved"}), 400
        
        # Authorize the payment (this creates the hold)
        authorize_response = requests.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{token}/authorize",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            }
        )
        
        if authorize_response.status_code != 201:
            print(f"PayPal authorization failed: {authorize_response.text}")
            return jsonify({"error": "Failed to authorize PayPal payment"}), 500
            
        auth_data = authorize_response.json()
        
        # Extract authorization ID
        authorization_id = None
        for purchase_unit in auth_data.get('purchase_units', []):
            for payment in purchase_unit.get('payments', {}).get('authorizations', []):
                authorization_id = payment.get('id')
                break
        
        if not authorization_id:
            return jsonify({"error": "No authorization ID found"}), 500
        
        # Update escrow - NOW it's truly funded (PayPal is holding the money)
        updated = supabase.table('escrows').update({
            'status': 'funded',
            'paypal_authorization_id': authorization_id
        }).eq('id', escrow_id).execute()
        
        # Record transaction
        supabase.table('transactions').insert({
            'escrow_id': escrow_id,
            'type': 'deposit',
            'amount': escrow_data['amount'],
            'currency': escrow_data['currency'],
            'paypal_transaction_id': authorization_id,
            'usd_amount': escrow_data['amount']
        }).execute()
        
        return jsonify({
            "success": True,
            "escrow": updated.data[0],
            "message": "PayPal payment authorized - funds are now held in escrow!"
        }), 200
        
    except Exception as e:
        print(f"Error handling PayPal authorization: {e}")
        return jsonify({"error": str(e)}), 500

def capture_paypal_payment(escrow_id, authorization_id):
    """ACTUALLY capture the authorized payment (release to seller)"""
    try:
        # Get escrow details
        escrow = supabase.table('escrows').select('*').eq('id', escrow_id).single().execute()
        if not escrow.data:
            return False
            
        escrow_data = escrow.data
        
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
        
        # Capture the authorized payment
        capture_response = requests.post(
            f"{PAYPAL_BASE_URL}/v2/payments/authorizations/{authorization_id}/capture",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json={
                'amount': {
                    'currency_code': 'USD',
                    'value': str(escrow_data['net_amount'])  # Seller gets net amount
                },
                'final_capture': True,
                'note_to_payer': 'Medius Escrow - Funds released to seller'
            }
        )
        
        if capture_response.status_code == 201:
            print(f"✅ PayPal capture successful! Net amount: ${escrow_data['net_amount']}")
            return True
        else:
            print(f"❌ PayPal capture failed: {capture_response.text}")
            return False
        
    except Exception as e:
        print(f"Error capturing PayPal payment: {e}")
        return False

def void_paypal_authorization(authorization_id):
    """Void the authorization (automatic refund to buyer)"""
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
        
        # Void the authorization
        void_response = requests.post(
            f"{PAYPAL_BASE_URL}/v2/payments/authorizations/{authorization_id}/void",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            }
        )
        
        return void_response.status_code == 204
        
    except Exception as e:
        print(f"Error voiding PayPal authorization: {e}")
        return False
        
def capture_paypal_payment(escrow_id, order_id):
    """Capture PayPal payment with automatic fee splitting"""
    try:
        # Get escrow details for fee calculation
        escrow = supabase.table('escrows').select('*').eq('id', escrow_id).single().execute()
        if not escrow.data:
            print(f"Escrow {escrow_id} not found")
            return False
            
        escrow_data = escrow.data
        
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
        
        # First, get the order details to find the authorization
        order_response = requests.get(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}",
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
        )
        
        if order_response.status_code != 200:
            print(f"Failed to get order details: {order_response.text}")
            return False
            
        order_data = order_response.json()
        
        # Find the authorization ID
        authorization_id = None
        for purchase_unit in order_data.get('purchase_units', []):
            for payment in purchase_unit.get('payments', {}).get('authorizations', []):
                if payment.get('status') == 'CREATED':
                    authorization_id = payment.get('id')
                    break
        
        if not authorization_id:
            print("No valid authorization found")
            return False
        
        # Capture the authorized payment for the seller amount (excluding platform fee)
        capture_response = requests.post(
            f"{PAYPAL_BASE_URL}/v2/payments/authorizations/{authorization_id}/capture",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json={
                'amount': {
                    'currency_code': 'USD',
                    'value': str(escrow_data['net_amount'])  # Seller gets net amount
                },
                'final_capture': True,
                'note_to_payer': 'Escrow funds released to seller',
                'disbursement_mode': 'INSTANT'
            }
        )
        
        print(f"Capture response: {capture_response.status_code} - {capture_response.text}")
        
        if capture_response.status_code == 201:
            capture_data = capture_response.json()
            print(f"✅ PayPal capture successful! Seller receives: ${escrow_data['net_amount']}, Platform fee: ${escrow_data['platform_fee_amount']}")
            
            # Record the platform fee transaction
            supabase.table('transactions').insert({
                'escrow_id': escrow_id,
                'type': 'platform_fee',
                'amount': escrow_data['platform_fee_amount'],
                'currency': escrow_data['currency'],
                'paypal_transaction_id': capture_data['id'],
                'usd_amount': escrow_data['platform_fee_amount']
            }).execute()
            
            return True
        else:
            print(f"❌ PayPal capture failed: {capture_response.text}")
            return False
        
    except Exception as e:
        print(f"Error capturing PayPal payment: {e}")
        import traceback
        print(traceback.format_exc())
        return False

@app.route('/api/escrows/<escrow_id>/paypal-refund', methods=['POST'])
@require_auth
def process_paypal_cancel(escrow_id):
    """Cancel PayPal authorization (automatic refund)"""
    try:
        # Get escrow
        escrow = supabase.table('escrows').select('*').eq('id', escrow_id).single().execute()
        if not escrow.data:
            return jsonify({"error": "Escrow not found"}), 404
            
        escrow_data = escrow.data
        paypal_data = escrow_data.get('paypal_order_id')
        
        if '|' in paypal_data:
            order_id, authorization_id = paypal_data.split('|', 1)
        else:
            authorization_id = paypal_data
        
        # Void the authorization (this refunds the buyer automatically)
        success = void_paypal_authorization(authorization_id)
        
        if success:
            # Update escrow status
            supabase.table('escrows').update({'status': 'refunded'}).eq('id', escrow_id).execute()
            
            return jsonify({"success": True, "message": "PayPal authorization voided - buyer refunded"}), 200
        else:
            return jsonify({"error": "Failed to void PayPal authorization"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
def get_authorization_id_from_order(order_id):
    """Get authorization ID from PayPal order"""
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
            return None
        
        access_token = auth_response.json()['access_token']
        
        # Get order details
        order_response = requests.get(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}",
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
        )
        
        if order_response.status_code != 200:
            print(f"Failed to get order details: {order_response.text}")
            return None
            
        order_data = order_response.json()
        print(f"🔍 Order data: {order_data}")
        
        # Look for authorization ID in the order
        for purchase_unit in order_data.get('purchase_units', []):
            for payment in purchase_unit.get('payments', {}).get('authorizations', []):
                auth_id = payment.get('id')
                print(f"🔍 Found authorization ID: {auth_id}")
                return auth_id
        
        print("❌ No authorization found in order")
        return None
        
    except Exception as e:
        print(f"Error getting authorization ID: {e}")
        return None

if __name__ == '__main__':
    app.run(debug=True, port=5000)