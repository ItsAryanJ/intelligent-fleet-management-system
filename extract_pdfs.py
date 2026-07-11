import PyPDF2
import os

def extract_pdf(path, output):
    reader = PyPDF2.PdfReader(path)
    text = []
    for i, page in enumerate(reader.pages):
        t = page.extract_text()
        if t:
            text.append(f"--- PAGE {i+1} ---\n{t}")
    with open(output, 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(text))
    print(f"Extracted {len(reader.pages)} pages from {os.path.basename(path)} -> {output}")

extract_pdf(r'd:\projects\intelligent-fleet-management-system\NCRTC_BMS_Evaluation_v3.pdf',
            r'd:\projects\intelligent-fleet-management-system\_eval_v3.txt')
extract_pdf(r'd:\projects\intelligent-fleet-management-system\NCRTC_BMS_Roadmap_to_9.5.pdf',
            r'd:\projects\intelligent-fleet-management-system\_roadmap.txt')
