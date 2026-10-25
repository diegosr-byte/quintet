# Voiceover script

Every line below is timed to a clip in the video. **Read each line at a natural pace; it fits its window.** Alex's two clips and the live call have their own sound, so nobody talks over them.

## How to record (about 5 minutes each)
1. Quiet room, phone about a hand's width from your mouth. Open **Voice Memos**.
2. Read **your lines in order**, one after another, with **about 2 seconds of silence between lines**. Don't speak during the pause; it's how the lines are told apart.
3. If you flub a line, stop talking for 2 seconds and read it again from the start, then tell Diego which line to keep. (Or just redo the whole recording; it's short.)
4. Name the file with your name (`Diego`, `Kai` or `Josiah`) and AirDrop it to Diego. Diego drops it in `~/projects/quintet-voiceovers/`.
5. Any line can be read by anyone. If Kai or Josiah can't record, Diego reads their lines.

Alternative: record each line as its own file, named by its id (`K03.m4a`). Both ways work.

## Diego

| Id | On screen | Say this | Room |
|---|---|---|---|
| **D01** | 0:00, the landing page, then the console | One person pays the bills, and nobody checks their work. This is Quintet. | 6.8 s |
| **D02** | 0:37, Ask Cora | Why was this stopped? | 2.2 s |
| **D03** | 1:06, the receipt on the phone | Receipts work the same way. I snap one on my phone and send it to Ivy. | 8.0 s |
| **D04** | 1:36, the closing landing page | Read, verify, call, decide, pay: five steps, five seats. Claude proposes, code countersigns. | 6.3 s |

## Kai

| Id | On screen | Say this | Room |
|---|---|---|---|
| **K01** | 0:08, the red flags fill in | Looks routine. But the bank changed, the callback isn't theirs, and hidden text tells the AI to pay. Frozen. | 9.2 s |
| **K02** | 0:18, the call rings | Cal calls the number we have on file, not the invoice's. | 5.5 s |
| **K03** | 0:18, the call rings | Blocked. | 1.5 s |
| **K04** | 0:37, Ask Cora | Every decision is explained from the case's own record. | 5.5 s |
| **K05** | 0:47, the failed checks | Identity fails, fraud score 85, and the phone isn't theirs. | 5.5 s |
| **K06** | 1:15, Ivy reads it | Ivy reads it in seconds: who, when, how much. If she isn't sure, a person signs. | 8.5 s |

## Josiah

| Id | On screen | Say this | Room |
|---|---|---|---|
| **J01** | 0:53, break the payment | Now a real invoice. I'm breaking the payment on purpose. | 5.0 s |
| **J02** | 0:53, break the payment | The transfer fails, Penny retries, and it pays exactly once. | 4.8 s |
| **J03** | 1:27, the scorecard | We test 25 cases every run. Every attack stopped, every good bill paid, no wrongful holds. | 8.2 s |

## After you've recorded
Run `python3 scripts/voiceover/mix.py` (Claude can do this). It splits each person's recording into lines, evens out the volume, places every line at its clip, and writes `rough-cut-vo.mp4` with a report that flags any line that runs too long or is missing.

The call clip (0:18) is replaced by the real call take, which changes the timings after it. Lines are tied to their clips, not to clock times, so they move with the cut.
