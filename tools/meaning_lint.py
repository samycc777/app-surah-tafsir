import pathlib, re, sys
d = pathlib.Path('harakat/meaning/out')
H = 'ً-ْٰ'
rules = [
 ('sukun before wasl', re.compile(r'\S*ْ[»"\)]? ا[^ ]*')),
 ('mina before non-al wasl', re.compile(r'(?<![ء-ي])مِنَ ا(?!ل)[^ ]*')),
 ('mini before al', re.compile(r'(?<![ء-ي])مِنِ ال[^ ]*')),
 ('an + al without kasra', re.compile(r'(?<![ء-ي])عَنْ? ا[^ ]*')),
]
tot = {}
for f in sorted(d.glob('*.txt')):
    for l in f.read_text(encoding='utf-8').splitlines():
        n, _, t = l.partition('\t')
        for name, rx in rules:
            for m in rx.finditer(t):
                tot[name] = tot.get(name, 0) + 1
                if '-v' in sys.argv: print(f.stem, n, name, m.group(), sep='\t')
print(tot)
