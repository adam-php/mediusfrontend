## Marketplace Deep‑Dive

This document details the marketplace domain: data model, endpoints, flows, moderation, payments, carts, recommendations, and admin controls so another engineer can pick up immediately.


### Domain objects
- Listing
  - `id (uuid)`, `seller_id (uuid)`, `title (text)`, `description (text)`, `price_usd (numeric)`, `payment_methods (text[])` — values: `['crypto','paypal']`
  - `accept_all (bool)` — if true, listing accepts all supported currencies; otherwise `listing_currencies` is used
  - `status (text)` — `active|paused|deleted`
  - `tags (text[])`, timestamps
- Listing images
  - `listing_images(listing_id, url, sort_order)` — gallery for listing detail and cards
- Listing currencies
  - `listing_currencies(listing_id, currency)` — if `accept_all=false`
- Reviews (optional for later)
  - `reviews(listing_id, rating int, comment text, created_at)`; default rating fallback is 5★ if none
- Reports
  - `reports(entity_type, entity_id, reason, created_by, status)`; workflow: open → triaged → resolved → dismissed
- Moderation config
  - `moderation_config(provider, api_key, thresholds jsonb, enabled bool, updated_at)`; latest row wins
- Cart
  - `cart_items(user_id, listing_id, quantity, payment_method, selected_currency)`
  - `checkout_sessions(user_id, groups jsonb, created_at)` — optional capture of the checkout grouping for idempotency
- Messages (pre‑escrow)
  - `conversations(id, starter_id, recipient_id, listing_id, created_at)`
  - `conversation_messages(conversation_id, sender_id, body, image_url, created_at)`
- Search history
  - `search_history(user_id, q, filters jsonb, created_at)` — fuels recommendations


### Supported currencies (crypto)
- Backed by `CHAIN_MAP` and `SUPPORTED_CURRENCIES` in the backend:
  - `BTC, ETH, LTC, BCH, DOGE, XRP, ADA, DOT, MATIC, SOL, AVAX, TRX, BNB, ATOM, XLM` plus tokens: `USDT-ERC20, USDT-BEP20, USDT-SOL, USDT-TRON`

Platform wallet envs (fallback resolution):
- Preferred: `PLATFORM_<CURRENCY_WITH_UNDERSCORES>_ADDRESS` / `_MNEMONIC` (e.g., `PLATFORM_USDT_BEP20_ADDRESS`)
- Fallback to base chain: `PLATFORM_<BASE>_ADDRESS` / `_MNEMONIC` (e.g., `PLATFORM_BNB_ADDRESS`)
- Final generic: `PLATFORM_MNEMONIC`


### Endpoints
- Public browse
  - `GET /api/marketplace` — query params:
    - `q` (search title), `payment_method=crypto|paypal`, `currency`, `tag`
    - `sort=new|price_asc|price_desc`, `page`, `limit`
  - `GET /api/marketplace/:id` — detail with images, currencies, rating (5★ default) and seller volume USD
- Listing management (auth required)
  - `POST /api/marketplace` — body: `{ title, description, price_usd, payment_methods[], accept_all, allowed_currencies[], images: [{url,sort_order}], tags[] }`
  - `PATCH /api/marketplace/:id` — any subset of fields above; replaces images/currencies when provided
  - `POST /api/marketplace/:id/pause` | `POST /api/marketplace/:id/resume`
  - `DELETE /api/marketplace/:id` — soft delete (status=`deleted`)
- Cart (auth required)
  - `GET /api/cart` — returns items and grouped line_items (by payment method + currency); client can construct fallback
  - `POST /api/cart` — upsert item: `{ listing_id, payment_method, selected_currency?, quantity }`
  - `POST /api/cart/qty` — update quantity: `{ item_id, quantity }`
  - `DELETE /api/cart/:item_id` — remove item
  - `POST /api/cart/checkout` — creates aggregator addresses (crypto) and PayPal orders as needed
  - `POST /api/cart/crypto/check-funding` — check balances for aggregator addresses
  - `POST /api/cart/finalize` — creates escrows, disburses crypto, finalizes PayPal
- Messaging (auth required)
  - `GET /api/messages` — list conversations
  - `POST /api/messages/start` — `{ counterparty_username?, listing_id? }` alias for `start-from-listing`
  - `GET /api/messages/:conversation_id`, `POST /api/messages/:conversation_id`
- Recommendations (auth required)
  - `POST /api/marketplace/search/log` — log searches; later fuels `GET /api/marketplace/recommendations`
  - `GET /api/marketplace/recommendations`
- Admin
  - `GET /api/admin/reports`, `POST /api/admin/reports/:id/action`
  - `GET/POST /api/admin/moderation/config` — override provider/key/thresholds/enabled
  - `GET /api/admin/escrows`, `POST /api/admin/escrows/:id/action`


### Moderation
- Text moderation: OpenAI `POST /v1/moderations` with `model=omni-moderation-latest` (fail‑open if provider errors)
- Image moderation: OpenAI `POST /v1/responses` with image URL content, parse structured JSON result (fail‑open on provider errors)
- Config precedence: DB row in `moderation_config` (latest) overrides env values.
- Env defaults:
```
MODERATION_PROVIDER=openai
MODERATION_API_KEY=...
MODERATION_THRESHOLDS={}
```


### Payments
- Crypto (Tatum):
  - Checkout groups items by `payment_method+currency` and generates a single aggregator deposit address per group
  - When fully funded (via balance check), backend creates individual escrows and later multi‑sends on finalize
  - Requires `TATUM_API_KEY` and platform mnemonic/address envs
- PayPal:
  - Authorization on checkout; capture on release; payout to seller; webhook verification via `PAYPAL_WEBHOOK_ID`
  - Key helper envs: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `PAYPAL_WEBHOOK_ID`


### Frontend UX summary
- Marketplace index: filters (payment method/crypto), debounced search, recommendations after prior searches, login‑gated actions
- Listing detail: gallery left, sticky buy panel right; PayPal/Crypto selector, currency chips; CTAs: Buy now, Add to cart, Message seller
- Cart: grouped by payment method + currency, qty controls with debounce, PayPal multi‑approve then “I approved all”, crypto funding progress bars
- Messages: conversation list + chat pane; “start from listing” shortcut
- Admin: reports triage, moderation settings, overview dashboards


### Environment and rate limits
- Rate limits are configurable via env: `RL_CART_LIST`, `RL_CART_ADD`, `RL_CART_QTY`, `RL_CART_CHECKOUT`, `RL_CART_CHECK_FUNDING`, `RL_CART_FINALIZE`
- CORS/dev helpers: `FRONTEND_URL`, `ADDITIONAL_ALLOWED_ORIGINS`, `CORS_ALLOW_ALL`, `USE_NGROK`


### Handoff checklist
- Verify all expected tables exist and RLS matches owner‑only + admin override strategy
- Set payment and moderation envs; run a full test flow:
  1) Create listing → moderation OK
  2) Add to cart → qty updates debounced; rate limits acceptable
  3) Checkout (crypto + PayPal) → aggregator address and PayPal order creation
  4) Funding check (crypto) and authorization (PayPal) → finalize creates escrows
  5) Release → crypto multi‑send and PayPal capture + seller payout
  6) Webhook events recorded; referral payouts applied


### Roadmap / future features
- Bids/auctions, inventory SKUs, coupons, bundle pricing
- Seller storefronts and analytics
- Image upload pipeline with signed URLs and server‑side scanning
- Search indexing and typo tolerance
- Automated dispute workflows and resolution SLAs


