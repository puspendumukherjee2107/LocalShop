# LocalStore: Screen-by-Screen UI & Operational Specification (Phase 4 Edition)

This document provides an exhaustive, screen-by-screen breakdown of every user interface view, sub-tab, modal, and data flow in the **LocalStore** hyperlocal commerce application.

---

## 🗺️ System Navigation Architecture

```
                                  [ LocalShop Matrix Console ]
                                                │
         ┌──────────────────────┬───────────────┴───────────────┬──────────────────────┐
         │                      │                               │                      │
         ▼                      ▼                               ▼                      ▼
   [ 👤 CUSTOMER ]        [ 🏪 MERCHANT ]              [ 🛵 DELIVERY ]           [ 🛡️ ADMIN ]
         │                      │                               │                      │
  ┌──────┴──────┐        ┌──────┴──────┐                 ┌──────┴──────┐        ┌──────┴──────┐
  │ Auth Gate   │        │ Auth Gate   │                 │ Driver      │        │ Auth Gate   │
  │ • Login     │        │ • Sign In   │                 │ Selector    │        │ • Root Auth │
  │ • Register  │        │ • Reg Store │                 └──────┬──────┘        └──────┬──────┘
  └──────┬──────┘        └──────┬──────┘                        │                      │
         │ (Authenticated)      │ (Authenticated)               │ (Driver Assigned)    │ (Authenticated)
  ┌──────┴──────────────┐┌──────┴──────────────┐         ┌──────┴──────────────┐┌──────┴──────────────┐
  │ Customer Sub-Tabs:  ││ Merchant Sub-Tabs:  │         │ Delivery Features:  ││ Admin Command Views:│
  │ 1. 🛍️ Shop          ││ 1. 📦 Stock         │         │ • Assigned Queue    ││ 1. APPROVALS        │
  │    ├─ Mode A: List  ││    ├─ Orders/Quotes │         │ • WhatsApp Client   ││ 2. CUSTOMERS        │
  │    └─ Mode B: Catalog││    ├─ ⚡ Quick Bill │         │ • 📞 Phone Call     ││ 3. REPORTS          │
  │    ├─ Address Modal ││    └─ Catalog Stock │         │ • In-Order Chat     ││ 4. LOGS             │
  │    └─ Promo Coupons ││ 2. 👥 Staff         │         │ • 🔑 OTP Verification││ 5. CONFIG           │
  │ 2. 📦 Track         ││ 3. 🏦 Bank          │         │ • Delivered History │└─────────────────────┘
  │    ├─ OTP Banner    ││ 4. ⚙️ Profile       │         └─────────────────────┘
  │    ├─ WhatsApp Store│└─────────────────────┘
  │    ├─ In-Order Chat │
  │    └─ 5★ Star Review│
  │ 3. 💳 Pay           │
  │ 4. ⚙️ Account       │
  └─────────────────────┘
```

---

## 🕹️ Global Component: Matrix Console Switcher

* **Source File:** [`app/(tabs)/index.tsx`](file:///c:/PM%20Project/LocalStore/UI/local-shop-app/app/%28tabs%29/index.tsx)
* **Access Level:** Persistent top header across all views.

### Visual Layout
```
+---------------------------------------------------------------------------------------+
|                               LocalShop Matrix Console                                |
|        [ Customer ]   [ Merchant ]   [ 🛵 Delivery (New) ]   [ Admin ]                |
+---------------------------------------------------------------------------------------+
```

### Component Breakdown
| Element | Type | Purpose / Action |
| :--- | :--- | :--- |
| **Console Header Title** | Text | Displays `LocalShop Matrix Console`. |
| **Role Selector Strip** | Button Group | 4 segmented buttons: `Customer`, `Merchant`, `🛵 Delivery`, `Admin`. |
| **State Tracker** | React State | Maintains `mainRole` (`customer` \| `merchant` \| `delivery` \| `admin`). Active tab receives white background, shadow elevation, and dark text. |

---

## 👤 Part 1: Customer Persona Screens

### Screen C1: Customer Authentication (`LoginScreen.tsx` & `RegisterScreen.tsx`)
* **Purpose:** Ensures secure phone-based identity with password verification.
* **Database Target:** SQLite `Users` table (Passwords hashed via SHA-256).

| Field / Button | Input Type | Validation & Rules |
| :--- | :--- | :--- |
| **Mobile Number** | Phone Pad | Exactly 10 digits (`^[0-9]{10}$`). |
| **Full Name** | Text | Required during registration (e.g. `Turja Mukherjee`). |
| **Password** | Secure Text | Min 6 characters. Stored as SHA-256 hash. |
| **Default Address** | Multiline | Default delivery address for orders. |
| **Sign In / Sign Up** | Button | Calls `POST /api/auth/login` or `/api/auth/register`. |

---

### Screen C2: Shop & Multi-Store Discovery (`CustomerScreen.tsx`)
* **Purpose:** Multi-store selection, delivery address picker, dual ordering modes, and discount coupons.

#### Section C2.1: Store Selector & Hero Banner
* **Store Pills Strip:** Horizontal scroll list showing nearby stores (`Kirana Junction`, `Daily Fresh Organics`, `Sharma Dairy`).
* **Active Shop Banner:** Shows store name, category, star rating, operating hours, delivery radius, and open/closed badge.
* **WhatsApp Inquiry Button:** Deep-links directly to shopkeeper's WhatsApp with greeting (`https://wa.me/919876500000`).

#### Section C2.2: Saved Delivery Address Bar & Modal
* **Address Strip:** `📍 Delivering to: [Selected Address] [Change]`.
* **Address Picker Modal:**
  * Displays saved locations tagged with `🏠 Home`, `🏢 Work`, or `📍 Other`.
  * **Add Address Form:** Input line with category tag chips (`Home`, `Work`, `Other`) and "Save and Use Address" button (`POST /api/customers/{phone}/addresses`).

#### Section C2.3: Dual Mode Ordering
* **Mode A: Freeform Grocery List (Zero Inventory Required)**
  * Quick chips: `+ Amul Milk`, `+ Atta 1kg`, `+ Eggs 6 pcs`, `+ Fortune Oil`.
  * Multiline freeform text area.
  * Button: **"Send List for Price Quote"** (`POST /api/orders/custom-list`). Order placed with status `QuoteRequested`.
* **Mode B: Standard Catalog & Promotional Coupons**
  * Search bar with category filters (`Groceries`, `Dairy`, `Bakery`).
  * Product cards with image, price, and `+` / `-` quantity steppers.
  * **Coupon Promo Bar:**
    * Input for promo codes (`FIRST50`, `KIRANA10`, `FLAT20`).
    * Quick coupon pills (`🏷️ FIRST50 (₹50 OFF)`).
    * "Apply" button: Calls `POST /api/coupons/validate` and updates total bill.
  * **Checkout Bar:** Displays items count, original total, discounted total, and "Submit Order" button (`POST /api/orders/catalog`). Decrements stock in SQLite and generates 4-digit `deliveryOtp`.

---

### Screen C3: Live Order Tracking & In-Order Chat (`OrderTrackingScreen.tsx`)
* **Purpose:** Real-time quote alerts via SignalR, delivery OTP display, WhatsApp store contact, live chat thread, and post-delivery ratings.

#### Key Components:
1. **Real-Time SignalR Quote Card:** Automatically pops up when the merchant quotes a grocery list. Displays total bill and provides "Accept Quote & Pay" button with Cash on Delivery or instant UPI options.
2. **Delivery Confirmation Code (OTP) Card:**
   * High-contrast gold card: `🔑 Delivery Confirmation Code: 4829`.
   * Clear instruction: *"Share this 4-digit code with the delivery partner upon arrival to complete delivery."*
3. **Assigned Delivery Driver Banner:** Shows driver name and contact number once assigned by merchant.
4. **Action Buttons:**
   * **💬 WhatsApp Store:** Opens pre-populated WhatsApp message with order ID and items.
   * **Order Chat:** Opens bi-directional live chat modal with merchant and driver.
   * **Cancel Order:** Triggers instant order cancellation, inventory restock, and refund initiation.
5. **Post-Delivery 5-Star Rating Card & Modal:**
   * Visible once order status is `Delivered`.
   * Star rating selector (1 to 5 gold stars) and text feedback comment.
   * "Submit Review" button saves review permanently to SQLite (`PUT /api/orders/{id}/rate`).

---

## 🏪 Part 2: Merchant Persona Screens

### Screen M1: Merchant Auth & Registration (`MerchantAuthScreen.tsx`)
* **Purpose:** Shopkeeper phone sign-in and store profile onboarding with trade license upload.

---

### Screen M2: Inventory, Orders & Fulfillment (`InventoryScreen.tsx`)

#### Sub-Tab 1: Orders & Quotes Queue
* **Incoming Customer Lists:** Displays uncataloged customer orders awaiting price quotes. Includes numeric input for shelf price and "Send Bill" button (`PUT /api/orders/{id}/quote`). Real-time SignalR push alerts customer.
* **Assign Driver Button:** On confirmed orders, merchant taps "Assign Driver" to open registered staff picker and assigns order to delivery personnel (`PUT /api/orders/{id}/assign-driver`). Status updates to `Out for Delivery`.
* **WhatsApp Customer Button:** Pre-populates WhatsApp text to customer with bill amount and delivery OTP.
* **Order Chat Button:** In-order live chat drawer for messaging customer and delivery partner.
* **Direct Deliver Button:** For walk-ins or self-delivery, marks order `Delivered` immediately.

#### Sub-Tab 2: Quick Counter POS (Zero Inventory Needed)
* Form with Customer Name, Phone, Items Sold, Total Bill (₹), and Payment Mode (Cash/UPI).
* Button: **"Record Sale & Collect Payment"** (`POST /api/orders/quick-bill`). Directly updates sales ledger.

#### Sub-Tab 3: Stock Catalog
* Standard items catalog listing with live stock levels. Add product form with category, price, and stock quantities.

---

### Screen M3: Staff Management (`StaffManagementScreen.tsx`)
* Directory of delivery drivers and counter clerks. Add staff member form (`POST /api/staff`), Active/Inactive toggle (`PUT /api/staff/{id}/toggle`), and delete button.

---

### Screen M4: Bank Settlements (`MerchantSettlementScreen.tsx`)
* Displays Total Digital Sales, Settled Payouts, and Net Withdrawable Balance. "Request Instant Settlement" button initiates payout (`POST /api/settlements/request`) and appends immutable transaction record.

---

### Screen M5: Store Profile & Operating Hours (`MerchantSettingsScreen.tsx`)
* Manage shop name, category, delivery radius (km), minimum order amount (₹), opening/closing hours, and master Open/Closed emergency toggle.

---

## 🛵 Part 3: Delivery Partner Persona Screens (New in Phase 4)

* **Source File:** [`src/screens/DeliveryPartnerScreen.tsx`](file:///c:/PM%20Project/LocalStore/UI/local-shop-app/src/screens/DeliveryPartnerScreen.tsx)
* **Access Level:** Accessible via `🛵 Delivery` in the Matrix Console.

### Screen D1: Driver Selection & Header Console
* Segmented pills to select active delivery driver profile:
  * `🛵 Rohan Das (9876500001)`
  * `🛵 Aman Verma (9876500002)`
  * `🛵 All Active Drivers`
* Header badge showing number of active deliveries currently assigned.

### Screen D2: Assigned Delivery Queue & Order Cards
Each active delivery card presents essential fulfillment details:
* **Store Name & Order ID:** e.g. `Kirana Junction • ORD-29248D`.
* **Customer Contact Details:** Name and phone number.
* **Delivery Destination:** Full address with street and landmark instructions.
* **Bill & Payment Status:** Total order value and payment method (`Cash on Delivery` / `Prepaid UPI`).
* **Grocery Items Summary:** Itemized list of products in the parcel.

### Screen D3: Delivery Action Suite
1. **💬 WhatsApp Customer:**
   * Calls `openWhatsAppToCustomerFromDriver(phone, name, orderId)`.
   * Opens WhatsApp with arrival alert: *"Hello [Name]! I am your delivery partner for LocalStore Order #[ID]. I am en route with your items. Please keep Delivery OTP ready."*
2. **📞 Call Customer:** Native telephone launcher for instant customer voice contact.
3. **💬 Chat:** In-order live messaging modal with customer and merchant.
4. **🔑 Verify OTP & Complete Delivery Button:**
   * High-contrast green button that opens the **OTP Verification Modal**.
   * Large 4-digit PIN input with number pad.
   * Tapping "Verify & Deliver" sends `PUT /api/orders/{id}/verify-otp-deliver`:
     * If code is incorrect: Displays warning alert.
     * If code matches: Order is marked `Delivered` in SQLite, SignalR notifies customer and merchant, and card moves to completed deliveries history.

---

## 🛡️ Part 4: System Administrator Screens

* **Source Files:** [`AdminLoginScreen.tsx`](file:///c:/PM%20Project/LocalStore/UI/local-shop-app/src/screens/AdminLoginScreen.tsx) & [`AdminDashboardScreen.tsx`](file:///c:/PM%20Project/LocalStore/UI/local-shop-app/src/screens/AdminDashboardScreen.tsx)

### Screen A1: Admin Root Login Gate
* Master Key (`superadmin`) and Password (`admin123`) authorization gate.

### Screen A2: Administrator Command Dashboard
* **APPROVALS:** Live merchant store KYC applications list with "Approve Shop" and "Reject" buttons (`PUT /api/admin/merchants/{id}/kyc`).
* **CUSTOMERS:** User directory with status badges and "Flag / Activate" compliance toggle (`PUT /api/admin/customers/{id}/toggle-status`).
* **REPORTS:** Real-time Gross Merchandise Volume (GMV), platform commission collected, active store count, and order volumes.
* **LOGS:** Immutable audit ledger tracking admin actions, bank payouts, and security events (`GET /api/admin/logs`).
* **CONFIG:** Master platform commission fee setter (e.g. `2.5%`) and emergency maintenance mode switch (`GET/PUT /api/admin/config`).

---
