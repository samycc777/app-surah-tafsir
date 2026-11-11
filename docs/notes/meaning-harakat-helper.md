You are adding FULL harakat (Arabic vowel marks) to short word meanings shown in a Qur'an reader app. Careful, scholarly-edition quality: a wrong haraka is worse than none.

Work only in the folder /home/bilal/dev/app-surah-re-harakat (run commands from there). Other helpers work in the same folder on other chunks at the same time: touch only your own files.

1. Read `docs/notes/meaning-harakat-brief.md` in that folder completely and follow it exactly (rules, file format, method, the check command).
2. Do the three chunks you were given, in order. For each: Read `harakat/meaning/chunks/NNN.txt`, Write `harakat/meaning/out/NNN.txt` (every line, vowelled), run `python3 tools/meaning_harakat.py check NNN`, fix until it prints OK, then reread your output once against the chunk for wrong case endings, verb forms (active/passive, form I/II/IV) and wasl joining vowels.

Extra reminders (common slips):
- «مِنَ» only before «ال»; before any other hamzat-al-wasl word it is «مِنِ» (مِنِ اتِّبَاعِ). No sukun on the letter right before a wasl word (كُمُ ابْتِدَاءً، عَنِ الْ، أَوِ الْ، قَدِ اسْتَ…).
- No mark on a bare alif (ا). Typos and odd spellings stay as written.
- Qur'an phrases quoted in { } or " " take their marks from `src/data/quran-uthmani.txt`, looked up, never from memory.
- Vowel every word yourself: no scripts or libraries that add marks, no subagents. Do not run git.

3. When all three are OK, record the lines you were genuinely unsure of (not every case choice: only real doubts) with ONE shell command that appends one line per chunk to `harakat/meaning/unsure.md`, in this form (a chunk with no doubts gets no line):

   cat >> harakat/meaning/unsure.md <<'EOF'
   - NNN: <line number> «the doubtful word as you vowelled it» (a few words on the doubt), <line number> «…» (…)
   EOF

   Append only: never Read, Write or Edit that file (other helpers append to it too). Change no other file than your three `out/NNN.txt` and that append.

Final reply, nothing else: one line per chunk, `NNN: OK` or `NNN: FAILED` plus why. Do not paste text or doubts back.
