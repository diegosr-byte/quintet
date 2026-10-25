#!/usr/bin/env python3
"""Lay the team's voiceover onto the cut.

  python3 scripts/voiceover/mix.py [--audio ~/projects/quintet-voiceovers] [--cut ~/projects/quintet-demo-cut]

Drop recordings in the audio folder, either one file per person (Diego.m4a, Kai.m4a, Josiah.m4a: read your lines in
ID order with a pause of about 2 seconds between lines) or one file per line (D01.m4a, K03.wav ...). Any audio or
video format ffmpeg reads (m4a, wav, mp3, caf, mov, mp4) works. Output: <cut>/rough-cut-vo.mp4 plus a timing report.
"""
import argparse, glob, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("--audio", default=os.path.expanduser("~/projects/quintet-voiceovers"))
ap.add_argument("--cut", default=os.path.expanduser("~/projects/quintet-demo-cut"))
ap.add_argument("--video", default="rough-cut-v3.mp4", help="the cut to put the voices on (inside --cut)")
ap.add_argument("--out", default="rough-cut-vo.mp4")
ap.add_argument("--gap", type=float, default=1.0, help="seconds of silence that separate two lines in a one-file-per-person recording")
args = ap.parse_args()

manifest = json.load(open(f"{HERE}/lines.json"))
lines = manifest["lines"]
names = manifest["speakers"]
tmp = tempfile.mkdtemp(prefix="vo-")

def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)

def duration(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).stdout.strip())

# Where each segment of the cut starts, from the order of the parts list.
starts, ends, t = {}, {}, 0.0
for ln in open(f"{args.cut}/parts/list.txt"):
    m = re.search(r"/([^/]+)\.mp4'", ln)
    if not m: continue
    d = duration(m.group(1) and f"{args.cut}/parts/{m.group(1)}.mp4")
    starts[m.group(1)], ends[m.group(1)] = t, t + d
    t += d

def find(stem):
    for ext in ("m4a", "wav", "mp3", "aac", "caf", "aiff", "mov", "mp4", "MOV", "M4A", "WAV", "MP3"):
        p = f"{args.audio}/{stem}.{ext}"
        if os.path.exists(p): return p
    hits = [p for p in glob.glob(f"{args.audio}/{stem}.*") if not p.endswith(".txt")]
    return hits[0] if hits else None

def audio_duration(path):
    """Length of the audio track only (a video file's container can be longer than its sound)."""
    r = run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=duration", "-of", "csv=p=0", path]).stdout.strip()
    try: return float(r)
    except ValueError: return duration(path)

def speech_chunks(path, noise=-38, gap=1.0, min_len=0.3):
    """Split a long recording into spoken stretches wherever there is a pause of `gap` seconds below `noise` dB."""
    out = run(["ffmpeg", "-hide_banner", "-i", path, "-vn", "-af", f"silencedetect=noise={noise}dB:d={gap}", "-f", "null", "-"]).stderr
    total = audio_duration(path)
    starts_ = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    ends_ = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    if len(starts_) > len(ends_): ends_.append(total)
    chunks, cur = [], 0.0
    for s, e in zip(starts_, ends_):
        if s - cur > min_len: chunks.append((cur, s))
        cur = e
    if total - cur > min_len: chunks.append((cur, total))
    return chunks

def split_lines(path, expected):
    """Try several noise levels and pause lengths until the number of spoken parts matches the number of lines."""
    for noise in (-38, -34, -42, -30, -46, -50, -26):
        for gap in (args.gap, 0.8, 1.3, 0.6, 1.6):
            ch = speech_chunks(path, noise, gap)
            if len(ch) == expected: return ch, None
    return None, [round(b - a, 1) for a, b in speech_chunks(path)]

def clean(src, a, b, dest):
    """Cut a..b out of src, trim edges, even out the loudness, mono 48 kHz."""
    af = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11"
    r = run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{max(a-0.1,0):.3f}", "-to", f"{b+0.1:.3f}", "-i", src, "-vn", "-af", af, "-ar", "48000", "-ac", "1", dest])
    if r.returncode: print("ffmpeg error:", r.stderr[:300]); sys.exit(1)

clips, problems = {}, []
for key, person in names.items():
    mine = [l for l in lines if l["id"].startswith(key)]
    per_line = {l["id"]: find(l["id"]) for l in mine}
    combined = find(person)
    for i, l in enumerate(mine):
        if per_line[l["id"]]:
            dest = f"{tmp}/{l['id']}.wav"
            clean(per_line[l["id"]], 0, audio_duration(per_line[l["id"]]), dest)
            clips[l["id"]] = dest
    missing = [l for l in mine if l["id"] not in clips]
    if missing and combined:
        ch, lengths = split_lines(combined, len(missing))
        if ch is None:
            problems.append(f"{person}: couldn't find {len(missing)} separate lines in {os.path.basename(combined)} (spoken parts found at the default setting, in seconds: {lengths}). Leave about 2 seconds of silence between lines and don't speak in the pauses, or record each line as its own file.")
        else:
            for l, (a, b) in zip(missing, ch):
                dest = f"{tmp}/{l['id']}.wav"
                clean(combined, a, b, dest)
                clips[l["id"]] = dest

report, inputs, filters, labels = [], [], [], []
for l in lines:
    if l["id"] not in clips:
        report.append(f"{l['id']:4} MISSING  ({names[l['id'][0]]})  \"{l['text']}\"")
        continue
    seg = l["segment"]
    if seg not in starts:
        report.append(f"{l['id']:4} segment {seg} is not in the cut"); continue
    t0 = (ends[seg] if l.get("anchor") == "end" else starts[seg]) + l["offset"]
    d = duration(clips[l["id"]])
    over = " TOO LONG for its window" if d > l["maxSeconds"] else ""
    spill = " runs past its clip" if t0 + d > ends[seg] + 0.05 else ""
    report.append(f"{l['id']:4} at {t0:6.1f}s  {d:4.1f}s of {l['maxSeconds']}s{over}{spill}  ({names[l['id'][0]]})")
    n = len(labels); inputs += ["-i", clips[l["id"]]]
    filters.append(f"[{n+1}:a]adelay={int(t0*1000)}|{int(t0*1000)},apad[v{n}]"); labels.append(f"[v{n}]")

print("\n".join(report))
for p in problems: print("PROBLEM:", p)
if not labels:
    print("No voice files found in", args.audio); sys.exit(1)

video = f"{args.cut}/{args.video}"
total = duration(video)
fc = ";".join(filters) + f";{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest[vo];[0:a][vo]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]"
out = f"{args.cut}/{args.out}"
r = run(["ffmpeg", "-loglevel", "error", "-y", "-i", video] + inputs + ["-filter_complex", fc, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.3f}", out])
if r.returncode: print("ffmpeg error:", r.stderr[:500]); sys.exit(1)
print(f"\nWrote {out} ({len(labels)} of {len(lines)} lines placed)")
