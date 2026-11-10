# Task: put FULL harakat on the word meanings

The reader's pop-up shows a short meaning for each Qur'an word (Tafsir Center's texts, unvowelled). You only ADD
harakat. Input: `harakat/meaning/chunks/NNN.txt`, one meaning per line:
`number <TAB> the Qur'an word it explains (surah:ayah) <TAB> the meaning`.
Output: `harakat/meaning/out/NNN.txt`, one line per input line: `number <TAB> the meaning with marks`
(the same numbers, the same order; no Qur'an-word column).

## Rules
1. Change NOTHING but the marks. Same words, letters, spelling (even odd spellings and typos), punctuation, quote
   marks, brackets, digits and spaces. A « ⏎ » inside a meaning stays where it is. Marks already in the text may be
   corrected. Never "fix" a typo: vowel a misspelt word as written as best you can.
2. FULL harakat on every word, as in a carefully vowelled scholarly edition: fatha/damma/kasra/sukun/shadda/tanween on
   every letter that takes one, correct i'rab endings, hamzat al-wasl joining vowels (مِنَ الْ… but مِنِ اتِّبَاعِ، عَنِ الْ…،
   هُمُ الْ…), لفظ الجلالة as اللهُ/اللهِ/اللهَ. Each line is a gloss of its Qur'an word: use that word and its ayah to
   read the gloss right (which verb form, active or passive, singular or plural, which noun), and think about the
   grammar of every sentence; a wrong haraka is worse than none. A gloss that is a lone word or phrase standing for
   the Qur'an word takes the same case as that word in its ayah when the gloss plainly mirrors it («الْجَائِرِينَ»);
   an explanation that is its own sentence takes its own i'rab. Grammar terms right (حَرْفُ جَرٍّ، اسْمٌ مَوْصُولٌ…).
3. A Qur'an phrase quoted inside { } or " ": keep the line's letters and take the harakat from the mushaf
   (`src/data/quran-uthmani.txt`, one ayah per line; find it with python3 after stripping the marks), never from
   memory. Roots and letter names written apart («الهمزة والخاء والذال») are vowelled as words.
4. Never a haraka on a bare alif (ا): where the text dropped a hamza, leave the alif unmarked. Never a sukun right
   before a hamzat al-wasl word. Where an accusative's alif is missing, put the fathatan on the last letter, adding
   no alif.
5. Formulae written out (سبحانه وتعالى، عز وجل، صلى الله عليه وسلم…) are vowelled like any words; ﷺ stays.

## Method
For each chunk: Read `harakat/meaning/chunks/NNN.txt`, then ONE Write of `harakat/meaning/out/NNN.txt` (every line,
vowelled), then run `python3 tools/meaning_harakat.py check NNN` from the repo folder. If it says BAD, fix the named
lines with Edit and run it again until it prints OK. Then reread your file once against the chunk for wrong
endings. Vowel every word yourself: no subagents, no tashkeel libraries or scripts that add marks. Do not run git
and change no other files.

When done, reply in 3 lines max: which chunks are OK, and the numbers of lines you were unsure of. Do not paste the
text back.
