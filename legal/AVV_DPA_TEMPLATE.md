# DATA PROCESSING AGREEMENT (DPA / AVV)
## Pursuant to Article 28 GDPR (General Data Protection Regulation)

Between:

1. **The Restaurant Client** (hereinafter **"Controller"** / **"Verantwortlicher"**),
2. **Farman GmbH**, Berliner Str. 179, 42277 Wuppertal, Germany (hereinafter **"Processor"** / **"Auftragsverarbeiter"**).

---

### § 1 Subject Matter, Duration and Specification of Data Processing
1. The Processor provides SaaS restaurant ordering and customer relationship software (Farman FoodSuite). In doing so, the Processor processes personal data on behalf of and under the instructions of the Controller.
2. The duration of this DPA corresponds to the duration of the main SaaS Subscription Agreement.
3. The types of personal data processed include:
   - **Customer Master Data:** Name, WhatsApp telephone number, email, delivery address.
   - **Order and Payment Data:** Order history, ordered dishes, order notes, payment methods, transaction references, billing totals.
   - **Reservation Data:** Reservation dates, party sizes, and notes.
4. The categories of data subjects are:
   - Customers, guest users, and staff of the Controller.

---

### § 2 Scope and Instructions
1. The Processor shall process personal data only on documented instructions from the Controller, unless required to do so by Union or Member State law.
2. The Controller reserves the right to issue amendments or additional instructions at any time.

---

### § 3 Technical and Organizational Measures (Art. 32 GDPR)
The Processor shall implement appropriate technical and organizational measures (TOMs) to ensure a level of security appropriate to the risk. These measures include:

1. **Confidentiality (Vertraulichkeit):**
   - **Physical Access Control (Zutrittskontrolle):** Secured VPS data center operations (e.g. Host Europe, Hetzner, or AWS) with ISO 27001 certifications.
   - **System Access Control (Zugangskontrolle):** Multi-tenant isolation at database level, secure SSH keys for server administration, strict firewall configurations, and hashed passwords.
   - **Data Access Control (Zugriffskontrolle):** Role-Based Access Control (RBAC) in the admin panel (Super-Admin, Branch-Manager, Cashier), restricting view access of user data.
2. **Integrity (Integrität):**
   - Encryption of data in transit via HTTPS/SSL (Let's Encrypt).
   - Database order immutability features preventing arbitrary modification of finalized records.
3. **Availability and Resilience (Verfügbarkeit):**
   - Daily automatic database backups.
   - Process monitoring via systemd/PM2 with automated restart policies.

---

### § 4 Rectification, Restriction and Erasure of Data
1. The Processor shall assist the Controller by appropriate technical and organizational measures in fulfilling the Controller’s obligation to respond to requests for exercising data subject rights (Art. 12-23 GDPR).
2. Upon termination of the SaaS agreement, the Processor shall, at the choice of the Controller, delete or return all personal data, unless statutory retention laws apply.

---

### § 5 Sub-processors (Unterauftragsverarbeiter)
1. The Controller hereby consents to the engagement of the following sub-processors for infrastructure operations:
   - VPS Hosting Provider (e.g., Host Europe / Contabo / Hetzner)
   - Stripe Inc. (if payment features are active)
   - OpenAI / Google Gemini (if NLP chatbot integration is active)
2. The Processor shall inform the Controller of any intended changes concerning the addition or replacement of sub-processors, giving the Controller the opportunity to object.

---

### § 6 Audit Rights
1. The Processor shall make available to the Controller all information necessary to demonstrate compliance with the obligations laid down in Article 28 GDPR and allow for and contribute to audits conducted by the Controller or an auditor mandated by the Controller.

---

### § 7 Final Provisions
1. In the event of discrepancies between this DPA and the main SaaS Subscription Agreement, the provisions of this DPA shall prevail.

\
**Signatures:**

\
__________________________________\
**For Controller (Restaurant)**\
Date:

\
__________________________________\
**For Processor (Farman GmbH)**\
Date:
