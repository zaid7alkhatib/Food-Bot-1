# Payment Gateway & POS Card Terminal Integration Plan

This document outlines the proposed architecture, payment providers, and API flows for integrating **Online Payment Gateways** and **In-Person POS Card Terminals** into the ordering platform, specifically tailored for the German market.

---

## 1. German Market Payment Requirements

German consumer payment preferences differ significantly from credit-card-dominant markets. To achieve high conversion rates, the platform must support the following payment methods:

### Online Checkout (Web & WhatsApp)
*   **PayPal**: Absolute market leader for online food delivery.
*   **Klarna / Sofort**: Direct bank-to-bank transfers, highly trusted.
*   **Mobile Wallets**: Apple Pay & Google Pay (crucial for fast mobile purchases).
*   **Credit Cards**: Visa and Mastercard.

### In-Person Checkout (POS Cashier & Table Ordering)
*   **girocard (EC-Karte)**: Germany's national debit card system. Many German consumers do not use Visa or Mastercard in daily transactions.
*   **Contactless (NFC)**: Support for tapping physical cards and mobile wallets (Apple/Google Pay linked to Girocard/Credit card).

---

## 2. Architecture Overview

We propose a hybrid payment architecture:
1.  **Online Checkout**: A cloud-based gateway (Stripe) embedded into the Brand Landing Page.
2.  **In-Store POS / Card Reader**: A cloud-to-device API (SumUp or Stripe Terminal) triggering WiFi card terminals directly from the dashboard.

```mermaid
flowchart TD
    subgraph Online Flow (Web / WhatsApp)
        A[Customer Cart] -->|Checkout Request| B[NodeJS Server]
        B -->|Create Intent| C[Stripe Gateway API]
        C -->|Secure Form / Element| A
        C -->|Webhook: Payment Success| B
        B -->|Print Kitchen Receipt & Update POS| D[Kitchen Panel]
    end

    subgraph In-Person POS Flow (Cashier)
        E[POS Cashier Screen] -->|Trigger Terminal Payment| F[NodeJS Server]
        F -->|POST Payment Request| G[SumUp / Stripe Cloud API]
        G -->|Push Payment Request| H[WiFi Card Terminal Solo/S700]
        H -->|Customer Taps Card| G
        G -->|Webhook / API Response: Paid| F
        F -->|Success Status| E
        F -->|Trigger Print| D
    end
```

---

## 3. Recommended Payment Providers

### A. Online Payments: Stripe
Stripe is recommended for web checkouts due to its unified integration and support for localized European payment methods.

*   **Integration Tool**: **Stripe Payment Element** (React).
*   **Backend Flow (Node.js)**:
    1.  POS Client requests payment intent: `POST /api/payments/create-intent` with `{ amount, currency: "EUR", orderId }`.
    2.  Server initializes Stripe:
        ```javascript
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'eur',
          payment_method_types: ['card', 'paypal', 'sofort', 'sepa_debit'],
          metadata: { orderId }
        });
        ```
    3.  Server returns `clientSecret` to React.
    4.  React mounts `<PaymentElement clientSecret={clientSecret} />`.
    5.  Once authorized, Stripe redirects back or calls a Webhook `payment_intent.succeeded` to finalize order status.

---

### B. POS Card Terminals: SumUp
SumUp is ideal for small-to-medium German restaurants. They offer low hardware costs, zero monthly rental fees, and native **girocard** support.

*   **Hardware Recommended**: **SumUp Solo** (WiFi & mobile connection).
*   **Integration Method**: **SumUp Terminal Cloud API** (No SDK or Bluetooth bridge required).
*   **POS Cashier Flow**:
    1.  Cashier selects "Card" on the POS Cashier dashboard.
    2.  Server sends payment instruction to SumUp:
        ```bash
        POST /v0.1/me/terminals/{terminal_serial}/transactions
        Headers: Authorization: Bearer {SumUp_Access_Token}
        Body:
        {
          "amount": 24.50,
          "currency": "EUR",
          "reference": "ORDER-1002"
        }
        ```
    3.  The paired WiFi SumUp reader immediately wakes up, displays "24.50 EUR", and lights up the NFC reader.
    4.  Customer pays. The transaction status is resolved via webhook or polling the transaction status ID.

---

### C. Unified Alternative: Stripe Terminal
If the client wants a single dashboard for both online payments and physical terminals, Stripe Terminal is the best alternative.

*   **Hardware Supported**: **Stripe Reader S700** or **BBPOS WisePad 3**.
*   **Girocard Support**: Fully supported in Germany on Stripe Terminal.
*   **Integration Method**: Connects via the Stripe Terminal JS SDK embedded directly in the React POS Cashier component.

---

## 4. Integration Comparison

| Feature | Stripe (Online) | SumUp Cloud (In-Store) | Stripe Terminal (In-Store) |
| :--- | :--- | :--- | :--- |
| **Transaction Fees** | Low (variable by payment type) | Flat ~0.9% for debit/Girocard, ~1.9% for credit | Flat rates depending on reader type |
| **Monthly Hardware Rental**| €0 | €0 (Purchase reader once for ~€79) | €0 (Purchase reader once for ~€199+) |
| **Girocard Support** | N/A | Native | Native |
| **Setup Complexity** | Low (Pre-built components) | Medium (REST API) | High (Requires Reader Pairing SDK) |
| **Internet Dependency** | Yes | Yes (WiFi / SIM) | Yes |

---

## 5. Security & Legal Compliance (Germany)
*   **TSE Compliance (KassenSichV)**: In Germany, physical POS systems must register transactions with a **Technical Security System (TSE)**. If in-store card terminals are implemented alongside POS cashier entries, we must log these transactions to a cloud TSE provider (e.g., Fiskaly API) to comply with German tax authority auditing standards.
*   **PCI-DSS**: Both Stripe and SumUp handle card data tokenization on their servers. The platform never stores raw credit/debit card numbers in the database.
