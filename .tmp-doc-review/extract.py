from docx import Document
from pathlib import Path
for name in ['Primer Parcial Documentacion con evidencias.docx','Primer Parcial Documentacion actualizado.docx']:
    path=Path(name)
    doc=Document(path)
    print('\n###', name)
    for i,p in enumerate(doc.paragraphs):
        t=p.text.strip()
        if t:
            style=p.style.name if p.style else ''
            print(f'{i:04d} [{style}] {t[:300]}')
