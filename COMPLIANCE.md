# Legal Compliance & Implementation Roadmap (Germany / EU)

This document outlines the required compliance measures (GDPR/DSGVO, GoBD, KassenSichV) for the **Mr. Tabboush WhatsApp Ordering & Reservation System** and lists the options for the legal and development teams to review.

---

## 1. Impressum (Legal Notice) & Privacy Policy (Datenschutzerklärung)

Under German **§ 5 DDG** (formerly TMG), every commercial web page must link to a valid legal notice ("Impressum") and privacy policy ("Datenschutzerklärung").

### Chosen Solution: Dynamic Modal Overlays
* We will render modal overlays directly inside the web pages when clicking "Imprint" or "Privacy" in the footers of the **Brand Website** and **Smart Menu**.
* The contents are dynamically populated using the restaurant details saved in the database:
  * **Company Legal Name**: `{restaurant?.legalName || restaurant?.name}`
  * **Address**: `{restaurant?.address}`
  * **Contact**: `{restaurant?.phone}` / `{restaurant?.email}`
  * **Vertretungsberechtigte Person (Authorized Representative)**: (To be configured in settings)
  * **USt-IdNr (VAT ID)**: (To be configured in settings)

---

## 2. GDPR Marketing Consent (WhatsApp Bot & Campaigns)

German **UWG § 7** strictly forbids bulk advertising via text messaging/WhatsApp without a documented Double Opt-In.

### Implementation Options:
1. **Option A (Checkout Checkbox)**: Add a checklist option under the Smart Menu checkout screen:
   `[ ] Ja, ich möchte über Sonderangebote per WhatsApp informiert werden. (Widerruf jederzeit möglich).`
   This is saved as `marketingOptIn: true` in the customer profile.
2. **Option B (Chat Opt-In)**: When a new customer completes their first order, the chatbot prompts them to reply with `JA` to subscribe to weekly offers.

---

## 3. Financial Compliances (GoBD & KassenSichV)

Germany requires POS cash registers to sign transactions using a Technische Sicherheitseinrichtung (TSE).

### Implementation Options:
1. **Option A (fiskaly Cloud TSE)**: Integrate the **fiskaly** Cloud TSE API to sign transactions directly from the POS interface.
   * Store signatures in order records (`tseSignature: { transactionId, signature, qrData, timestamp }`).
   * Print signature details on thermal receipts.
2. **Option B (GoBD Audit Trail)**: Remove hard-deletion capabilities from finalized orders in the database. Finalized orders can only be "cancelled" or marked "refunded", ensuring audit records are kept intact for 10 years.
