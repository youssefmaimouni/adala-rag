import os
import re
import json
from pypdf import PdfReader

ROOT_DIR = "legal_DOCS"
OUTPUT_FILE = "structured_legal_data.json"

def extract_text(pdf_path):
    reader = PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text

def clean_text(text):
    text = re.sub(r"\n+", "\n", text)
    text = re.sub(r"\s+", " ", text)
    return text

def split_articles_arabic(text):
    pattern = r"(المادة\s+\d+|الفصل\s+\d+)"
    splits = re.split(pattern, text)
    
    articles = []
    for i in range(1, len(splits), 2):
        article_title = splits[i]
        article_text = splits[i+1].strip()
        
        articles.append({
            "article": article_title,
            "text": article_text
        })
    return articles

all_data = []

for root, dirs, files in os.walk(ROOT_DIR):
    for file in files:
        if file.endswith(".pdf"):
            pdf_path = os.path.join(root, file)
            category = os.path.basename(root)
            
            print("Processing:", pdf_path)
            
            text = extract_text(pdf_path)
            text = clean_text(text)
            
            articles = split_articles_arabic(text)
            
            for art in articles:
                all_data.append({
                    "document": file,
                    "category": category,
                    "article": art["article"],
                    "text": art["text"],
                    # include full path so callers can construct metadata
                    "source": pdf_path
                })

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(all_data, f, ensure_ascii=False, indent=4)

print("Done. Total articles:", len(all_data))