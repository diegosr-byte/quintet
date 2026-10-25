# Judge Q&A: draft answers
Diego owns these. Update them with real eval numbers before Sunday.

1. **What's real and what's simulated?**
   - **Real:**
     - Claude reading the documents.
     - The policy gate.
     - CRS sandbox calls, using test identities.
     - Nessie sandbox transfers.
     - The phone call.
     - Convex live state.
   - **Simulated:** the business, its vendors and employees (fictional, marked SYNTHETIC), and the money (sandbox).
   - **How we know it works:** a 25-case eval with expected verdicts, re-runnable from the scorecard. Every decision traces through the audit log.

2. **Why not Ramp, Bill.com or nickel.com?**
   - They're payment and approval platforms. Quintet is an independent verification layer in front of any payment tool: it checks every invoice, bank change and receipt before money moves, calls the vendor on file, and explains each decision from an audit log.
   - A small business without a finance team can't staff that second pair of eyes.
   - nickel.com's AI agent "Penny" is the closest: it already does small-business accounts payable by email, with approvals. Our difference is independent verification: a callback to the vendor on file, CRS identity and fraud checks, a tested rules gate the model can't loosen, and injection defense.
   - *(Verify what Ramp, Bill.com and nickel.com currently offer before the event. Don't claim they lack fraud checks.)*

3. **What if the model is tricked?**
   - It can't move money. Documents are read with no tools available, through a strict schema.
   - Every payment passes a deterministic gate, and the model can only make a decision stricter.
   - A parser re-reads the critical fields (amount, account, invoice number). Any disagreement goes to a human.
   - Injection attempts are logged as evidence. Show E13 and E20.

4. **What if the vendor really did change banks?**
   - The call confirms it, and the case goes to the owner with the evidence (ASK), never auto-paid.
   - New bank details are verified before they become the record on file.

5. **How many false positives?**
   - Wrongful holds are on the scorecard, with a target of 0 across the 25 cases.
   - Ambiguous cases go to ASK, not BLOCK, so legit vendors still get paid after one click.

6. **Why voice?**
   - Calling back the number on file is the standard defense against payment-redirection fraud, and it's the step people skip. The agent does it every time.
   - It says it's automated, asks yes/no questions only, and never reads account numbers.
   - We deliberately don't allow approving payments by voice, because voices can be cloned.

7. **Why identity checks on vendors? What about FCRA?**
   - We don't pull credit. We use identity verification, a fraud score and reverse phone lookup on payees and invoice senders.
   - Only in the CRS sandbox with test identities, behind an allowlist.
   - In production: consent at vendor onboarding.

8. **Is this a real problem? Who did you validate with?**
   - Honest answer: we haven't interviewed small-business owners yet; that's the first step after the hackathon.
   - What we did instead: took the policy rules from a real published small-business expense policy (cited in the README), and built the attack scenarios from well-documented payment-redirection (business-email-compromise) fraud patterns. Cite the FBI IC3's reporting; look up the current figures, don't quote them from memory.
   - Next: a pilot with a few local small businesses.

9. **What's the path to production?**
   - Pilot with a few local small businesses.
   - Connect each business's real bank, or accounting-software exports.
   - Single sign-on.
   - Per-business policy compiled from its own expense policy.
   - Audit retention and monitoring.
   - About $X per case in model cost (from the scorecard).

10. **What breaks at scale?**
    - New document types (credit notes, foreign currency → ASK today).
    - Voicemail on calls.
    - CRS and Cartesia rate limits.
    - Multi-business tenancy.
    - Real payment-rail latency.

    Each one already has a safe default: ask a human.

**Is the call a real phone call?** (answer honestly)
   - In the demo it's a Cartesia voice-agent call that rings in the browser, with a teammate answering as the vendor. Phone-network dialing needs a purchased number, which we skipped. The agent only ever targets the vendor's number on file, and "yes, we changed it" still only reaches ASK, so a forged answer can't move money.

**Who did you talk to?** (answer honestly, and keep it short)
   - One small-business owner, at the event: a two-person locksmith company with 5 or 6 invoices a day. Before we showed him anything he told us nobody checks his payments, a vendor once changed bank details on him without him noticing, and receipts are in spreadsheets.
   - His reaction to the demo was positive and he said he'd pay for it. We treat that as one person's opinion, not demand validation.
   - His real objection was getting his data in. Today Quintet takes photos and PDFs; connecting to bank or accounting software is the first step in our path to production.

**Where does it get the information?** (the owner asked this too)
   - From the documents sent to it: invoice PDFs, receipt photos and emails. It compares them with the record we hold for each vendor. Today the vendor records are seeded; in production they'd come from the business's bank or accounting export.
