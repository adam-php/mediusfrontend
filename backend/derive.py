"""
derive_trustwallet_compatible.py

pip install bip-utils==2.9.3

Usage:
  - Export MNEMONIC (and optional MNEMONIC_PASSPHRASE) env vars and run:
      export MNEMONIC="your twelve/twenty-four words"
      python derive_trustwallet_compatible.py

  - Or run and paste mnemonic when prompted.

This prints lines like:
BTC_FEE_ADDY=bc1...
ETH_FEE_ADDY=0x...
...
"""

import os
import sys
from bip_utils import (
    Bip39SeedGenerator,
    Bip44,
    Bip44Coins,
    Bip44Changes,
    Bip84,
    Bip84Coins,
)

# Map env var -> bip-utils enum name (for Bip44) or special tag for BTC (Bip84)
COIN_MAP = {
    "BTC_FEE_ADDY": ("BIP84", "BITCOIN"),           # Trust Wallet default: bech32 (BIP84) example in docs
    "ETH_FEE_ADDY": ("BIP44", "ETHEREUM"),
    "SOL_FEE_ADDY": ("BIP44", "SOLANA"),           # bip-utils handles Solana derivation via BIP44 coin enum
    "LTC_FEE_ADDY": ("BIP44", "LITECOIN"),
    "BCH_FEE_ADDY": ("BIP44", "BITCOIN_CASH"),
    "DOGE_FEE_ADDY": ("BIP44", "DOGECOIN"),
    "XRP_FEE_ADDY": ("BIP44", "RIPPLE"),
    "ADA_FEE_ADDY": ("BIP44", "CARDANO"),
    "DOT_FEE_ADDY": ("BIP44", "POLKADOT"),
    "MATIC_FEE_ADDY": ("BIP44", "POLYGON"),
    "AVAX_FEE_ADDY": ("BIP44", "AVAX_C_CHAIN"),
    "TRX_FEE_ADDY": ("BIP44", "TRON"),
    "BNB_FEE_ADDY": ("BIP44", "BINANCE_SMART_CHAIN"),  # BNB (BEP20) shares Ethereum-style address
    "ATOM_FEE_ADDY": ("BIP44", "COSMOS"),
    "XLM_FEE_ADDY": ("BIP44", "STELLAR"),
    "USDT_ERC20_FEE_ADDY": ("BIP44", "ETHEREUM"),
    "USDT_BEP20_FEE_ADDY": ("BIP44", "BINANCE_SMART_CHAIN"),
    "USDT_SOL_FEE_ADDY": ("BIP44", "SOLANA"),
    "USDT_TRON_FEE_ADDY": ("BIP44", "TRON"),
}

ACCOUNT = 0
CHANGE = Bip44Changes.CHAIN_EXT
ADDRESS_INDEX = 0


def derive_bip44_address(seed_bytes, coin_enum_name):
    """Generic BIP44 derivation using Bip44 and Bip44Coins enum."""
    try:
        bip44_coin = getattr(Bip44Coins, coin_enum_name)
    except AttributeError:
        return ""
    bip_obj = Bip44.FromSeed(seed_bytes, bip44_coin)
    addr_obj = (
        bip_obj
        .Purpose()
        .Coin()
        .Account(ACCOUNT)
        .Change(CHANGE)
        .AddressIndex(ADDRESS_INDEX)
    )
    return addr_obj.PublicKey().ToAddress()


def derive_btc_bip84(seed_bytes):
    """Derive BTC native SegWit (bech32) using BIP84 (Trust Wallet example shows m/84'... as default)."""
    try:
        bip84_obj = Bip84.FromSeed(seed_bytes, Bip84Coins.BITCOIN)
        addr_obj = (
            bip84_obj
            .Purpose()
            .Coin()
            .Account(ACCOUNT)
            .Change(CHANGE)
            .AddressIndex(ADDRESS_INDEX)
        )
        return addr_obj.PublicKey().ToAddress()
    except Exception:
        return ""


def main():
    mnemonic = os.environ.get("MNEMONIC")
    if not mnemonic:
        mnemonic = input("Enter your BIP39 mnemonic (Trust Wallet seed): ").strip()
    if not mnemonic:
        sys.exit("Mnemonic required.")
    passphrase = os.environ.get("MNEMONIC_PASSPHRASE", "")

    seed = Bip39SeedGenerator(mnemonic).Generate(passphrase)

    # Print exactly the variables in the order you provided, with '=' and the address (or blank on error)
    for env_key, (method, enum_name) in COIN_MAP.items():
        try:
            if method == "BIP84" and enum_name == "BITCOIN":
                addr = derive_btc_bip84(seed)
            else:
                addr = derive_bip44_address(seed, enum_name)
            if not addr:
                # if we couldn't derive, print empty after =
                print(f"{env_key}=")
            else:
                print(f"{env_key}={addr}")
        except Exception:
            # fail silently to keep exact format
            print(f"{env_key}=")


if __name__ == "__main__":
    main()
