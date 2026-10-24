# Sponsor-table pitches (Sat 7-9 AM, ~20 seconds each)

Goal at each table: (1) say what Quintet does with *their* tech, (2) ask what would make a judge pick us, (3) collect credits and the right contact. Post what you learn in the team chat.

Open the same way every time: "We built Quintet: five AI seats that check every invoice a small business pays, and it phones the vendor's number on file before paying a 'we changed banks' invoice."

## Hyphenate (primary; $8k / $5k / $3k)
- **Pitch:** "Your four questions are our design. Each seat has limited access and a log. It asks a human when unsure. The moment: a fake bank-change invoice freezes, the Caller phones the number on file, and the Controller defends the decision from the audit log. We'll take any scenario you give us."
- **Ask:**
  1. Can we get the track doc and the exact judging format (video first, then the table)?
  2. What counts as "real enough": must the bank be real, or is a sandbox bank with a real API okay?
  3. What kinds of scenarios might you try live? (We have a console that renders any invoice.)
- **Also:** attend their workshop. Get one concrete fact they care about (their vocabulary: procure-to-pay, "audit-ready by default").

## CRS Credit ($1k / $500 / interview prizes)
- **Pitch:** "CRS is the verification analyst's eyes. On every new payee and every change of details we run identity, Fraud Finder and reverse phone, only on your test identities, behind an allowlist, because your sandbox forwards unknown requests to the real bureau."
- **Ask:**
  1. Is there an OFAC or business (KYB) check in the sandbox? (The landing page lists them; the spec doesn't.)
  2. What rate limits should we plan around for a live demo?
  3. Which test identity shows a deceased flag, and does identity verification fail for it?
  4. Which prize fits us best: Financial AI Agent or Identity/Fraud Innovation?

## Cartesia (Meta glasses, TBD)
- **Pitch:** "Voice is the control, not a garnish. Our Caller seat phones the number on file, the step humans skip. It says it's automated, asks yes/no only and never reads out account numbers. We deliberately don't allow approving payments by voice, because voices can be cloned."
- **Ask:**
  1. Does the free plan allow outbound calls, or do we need Pro? Any credits?
  2. Best way to get a clean recording of the call for our video?
  3. Which agent webhook tool shape is most reliable under venue wifi?

## Convex (EP-133 + ESP32 board)
- **Pitch:** "One reactive backend: every seat's work appears live on the board; the pipeline runs on the scheduler; webhooks bring in the call result."
- **Ask:** What's their criteria (still "coming soon")? Any limits we should know about on the free plan during a live demo?

## Capital One (Nessie)
- **Pitch:** "Nessie is the business's bank: accounts, payees and idempotent transfers, with retries that never pay twice."
- **Ask:** What does "complexity" mean to the judges? Is POST reliability known to vary? (We test first thing.)

## Anthropic (prize TBD)
- **Pitch:** "For owner-operated small businesses with no finance team. Claude reads messy documents but can't move money. We have a written list of where it could go wrong and the guard for each."
- **Ask:** Which criteria matter most (named community, real problem, working, thoughtful Claude use)? Any API credits for the team? When is the prize posted on Devpost?

## Microsoft (Built for the Real World)
- **Pitch:** "A production-minded agent in finance: a tested rules gate the model can't loosen, a full audit log, human sign-off, and a path to production."
- **Ask:** What would "customer understanding" look like when we haven't interviewed customers yet? How do they weigh a measured eval versus customer quotes?

## Factory and Apify (only if we reach the stretch)
- **Factory:** "Droid turns a published expense policy into tested policy changes; a human approves the diff and any loosening is flagged." Ask what scores best on "control over what Droid can touch".
- **Apify:** "We crawl public policy templates into the compiler and publish the actor." Ask for credits.

## After each table
Write one line in the team chat: sponsor, what they said they want, credits/contact, anything we should change.
