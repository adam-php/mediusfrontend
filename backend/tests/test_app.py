# tests/test_app.py
import pytest
import json
import jwt
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def auth_token():
    """Generate a valid JWT token for testing"""
    payload = {
        'sub': 'test-user-id',
        'aud': 'authenticated',
        'exp': datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, 'test-secret', algorithm='HS256')

@pytest.fixture
def auth_headers(auth_token):
    return {'Authorization': f'Bearer {auth_token}'}

class TestHealthCheck:
    def test_health_check(self, client):
        response = client.get('/health')
        assert response.status_code == 200
        assert response.json['status'] == 'healthy'

class TestSupportedCurrencies:
    def test_get_supported_currencies(self, client):
        response = client.get('/api/supported-currencies')
        assert response.status_code == 200
        data = response.json
        assert isinstance(data, list)
        assert len(data) > 0
        assert all('code' in curr and 'name' in curr for curr in data)

class TestEscrowCreation:
    @patch('app.supabase')
    @patch('app.generate_crypto_address')
    def test_create_crypto_escrow_success(self, mock_generate_address, mock_supabase, client, auth_headers):
        # Mock Supabase responses
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {'id': 'seller-id'}
        ]
        mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
            {
                'id': 'escrow-id',
                'buyer_id': 'test-user-id',
                'seller_id': 'seller-id',
                'amount': 0.1,
                'currency': 'BTC',
                'payment_method': 'crypto',
                'deposit_address': 'bc1qtest123'
            }
        ]
        
        # Mock crypto address generation
        mock_generate_address.return_value = 'bc1qtest123'
        
        data = {
            'seller_username': 'seller@example.com',
            'amount': 0.1,
            'currency': 'BTC',
            'payment_method': 'crypto',
            'seller_address': 'bc1qseller456'
        }
        
        response = client.post('/api/escrows', 
                             json=data,
                             headers=auth_headers)
        
        assert response.status_code == 201
        assert response.json['deposit_address'] == 'bc1qtest123'

    @patch('app.supabase')
    def test_create_escrow_seller_not_found(self, mock_supabase, client, auth_headers):
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        
        data = {
            'seller_username': 'nonexistent@example.com',
            'amount': 100,
            'currency': 'USD',
            'payment_method': 'paypal'
        }
        
        response = client.post('/api/escrows', 
                             json=data,
                             headers=auth_headers)
        
        assert response.status_code == 404
        assert 'not found' in response.json['error']

    def test_create_escrow_unauthorized(self, client):
        response = client.post('/api/escrows', json={})
        assert response.status_code == 401

class TestEscrowOperations:
    @patch('app.supabase')
    def test_get_escrow_success(self, mock_supabase, client, auth_headers):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            'id': 'escrow-id',
            'buyer_id': 'test-user-id',
            'amount': 100
        }
        
        response = client.get('/api/escrows/escrow-id', headers=auth_headers)
        assert response.status_code == 200
        assert response.json['id'] == 'escrow-id'

    @patch('app.supabase')
    @patch('app.release_funds')
    def test_confirm_escrow_both_parties(self, mock_release, mock_supabase, client, auth_headers):
        # Mock escrow data
        escrow_data = {
            'id': 'escrow-id',
            'buyer_id': 'test-user-id',
            'seller_id': 'seller-id',
            'seller_action': 'release',
            'amount': 100,
            'currency': 'USD'
        }
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = escrow_data
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            {**escrow_data, 'buyer_action': 'release'}
        ]
        
        response = client.post('/api/escrows/escrow-id/confirm',
                             json={'action': 'release'},
                             headers=auth_headers)
        
        assert response.status_code == 200
        mock_release.assert_called_once_with('escrow-id')

class TestPaymentChecking:
    @patch('app.supabase')
    @patch('app.check_crypto_payment')
    def test_check_payment_funded(self, mock_check_payment, mock_supabase, client, auth_headers):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            'id': 'escrow-id',
            'buyer_id': 'test-user-id',
            'payment_method': 'crypto',
            'deposit_address': 'bc1qtest',
            'currency': 'BTC',
            'amount': 0.1
        }
        
        mock_check_payment.return_value = True
        
        response = client.post('/api/escrows/escrow-id/check-payment',
                             headers=auth_headers)
        
        assert response.status_code == 200
        assert response.json['status'] == 'funded'

class TestTatumIntegration:
    @patch('requests.get')
    def test_generate_crypto_address_success(self, mock_get, client):
        # Mock Tatum API responses
        mock_get.side_effect = [
            MagicMock(status_code=200, json=lambda: {'xpub': 'xpub123'}),
            MagicMock(status_code=200, json=lambda: {'address': 'bc1qtest123'})
        ]
        
        from app import generate_crypto_address
        address = generate_crypto_address('BTC')
        
        assert address == 'bc1qtest123'
        assert mock_get.call_count == 2

class TestPayPalIntegration:
    @patch('requests.post')
    def test_create_paypal_order_success(self, mock_post, client):
        # Mock PayPal API responses
        mock_post.side_effect = [
            MagicMock(status_code=200, json=lambda: {'access_token': 'test-token'}),
            MagicMock(status_code=201, json=lambda: {'id': 'ORDER-123'})
        ]
        
        from app import create_paypal_order
        order = create_paypal_order(100, 'USD')
        
        assert order['id'] == 'ORDER-123'