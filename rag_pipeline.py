#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Moroccan Legal RAG QA Script
Loads precomputed FAISS index + docs and allows querying via Qwen 2.5.
"""

import os
import pickle
from langchain.llms.base import LLM
from langchain.chains import RetrievalQA
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
import faiss

from dotenv import load_dotenv
import os
import re

load_dotenv()

# ==========================
# CONFIG
# ==========================
SAVE_DIR = "./legal_RAG"
EMBED_MODEL = "BAAI/bge-m3"

# ==========================
# LOAD DOCS & FAISS INDEX
# ==========================
with open(f"{SAVE_DIR}/docs.pkl", "rb") as f:
    all_docs = pickle.load(f)

index = faiss.read_index(f"{SAVE_DIR}/faiss.index")

# ==========================
# DEFINE LLM
# ==========================
from langchain.llms.base import LLM
import os

class OpenRouterLLM(LLM):
    """Wrapper for OpenRouter LLMs like Qwen."""
    model_name: str  # declare as pydantic field

    def __init__(self, model_name: str):
        # assign pydantic field normally
        super().__init__(model_name=model_name)

        from openai import OpenAI
        # bypass pydantic to store client
        object.__setattr__(self, "_client", OpenAI(
            api_key=os.getenv("OPENROUTER_API_KEY"),
            base_url="https://openrouter.ai/api/v1"
        ))

    @property
    def _llm_type(self):
        return "openrouter"

    def _call(self, prompt, stop=None):
        completion = self._client.chat.completions.create(
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        return completion.choices[0].message.content

# Initialize LLM
llm = OpenRouterLLM(model_name="arcee-ai/trinity-large-preview:free")

# ==========================
# CREATE FAISS RETRIEVER
# ==========================
# Load embeddings
# import faiss
# import pickle
# from langchain_community.vectorstores import FAISS
# from langchain_huggingface import HuggingFaceEmbeddings

# # ---- Load your embeddings (needed for retriever, even if FAISS already has vectors) ----
embedding_model = HuggingFaceEmbeddings(
     model_name="BAAI/bge-m3",
     encode_kwargs={"normalize_embeddings": True},
)

# ---- Convert your loaded docs into Document objects (if needed) ----
# If docs.pkl already contains Document objects, skip conversion

from langchain_community.docstore import InMemoryDocstore
from langchain.schema import Document

docstore_dict = {}

for i, doc in enumerate(all_docs):
    docstore_dict[str(i)] = Document(
        page_content=doc["text"], 
        metadata={
            "source": doc.get("source"),
            "article": doc.get("article"),  
            "chunk_id": doc.get("chunk_id"),
            "folder": doc.get("folder"),
            "file_name": doc.get("file_name"),
            "type": doc.get("type")
        }
    )

docstore = InMemoryDocstore(docstore_dict)

index_to_docstore_id = {i: str(i) for i in range(len(docstore_dict))}

vectorstore = FAISS(
    index=index,
    docstore=docstore,
    index_to_docstore_id=index_to_docstore_id,
    embedding_function=embedding_model,
)

retriever = vectorstore.as_retriever(search_kwargs={"k": 10})


# (The vectorstore has already been constructed above with the proper
# embedding function, index, and docstore.  There is no need to recreate
# it a second time, which was causing the TypeError.)

# ==========================
# BUILD QA CHAIN
# ==========================
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever,
    return_source_documents=True    # ensure retrieved docs are included in result
)

def ask_question(question: str):

    docs_and_scores = vectorstore.similarity_search_with_score(question, k=10)

    docs = [doc for doc, score in docs_and_scores]

    # generate answer from retrieved docs
    answer = qa_chain.combine_documents_chain.run(
        input_documents=docs,
        question=question
    )

    source_map = {}
    print("Docs and Scores:", docs_and_scores)
    print("="*40)
    for doc, score in docs_and_scores:
        
        src = doc.metadata.get("source")
        article = doc.metadata.get("article")
        pattern = r'^(المادة\s*\d+|الفصل\s*\d+)$'
        if article and not re.match(pattern, article):
            continue
        if not src:
            continue

        if src not in source_map:
            source_map[src] = {
                "source": src,
                "articles": set(),
                "scores": []
            }

        if article:
            source_map[src]["articles"].add(article)

        source_map[src]["scores"].append(score)

    sources = []

    for src in source_map.values():

        avg_score = sum(src["scores"]) / len(src["scores"])

        # convert similarity → trust %
        trust = max(0, min(100, int((1 - avg_score) * 100)))
        if trust < 30:
            continue
        sources.append({
            "source": src["source"],
            "articles": sorted(list(src["articles"])),
            "trust": trust
        })

    return answer, sources

# def ask_question(question: str):

#     result = qa_chain({"query": question})
#     answer = result.get("result", "")

#     source_map = {}

#     for doc in result.get("source_documents", []):

#         src = doc.metadata.get("source")
#         article = doc.metadata.get("article")

#         if not src:
#             continue

#         # create entry if source not seen
#         if src not in source_map:
#             source_map[src] = {
#                 "source": src,
#                 "articles": set()
#             }

#         if article:
#             source_map[src]["articles"].add(article)

#     # convert sets → list
#     sources = []
#     for src in source_map.values():
#         sources.append({
#             "source": src["source"],
#             "articles": sorted(list(src["articles"]))
#         })

#     return answer, sources

# ==========================
# EXAMPLE USAGE
# ==========================
if __name__ == "__main__":
    question = "هل يجوز السياقة برخصة أجنبية"
    answer, sources = ask_question(question)
    print("❓ Question:", question)
    print("💡 Answer:", answer)
    print("📁 Sources:", sources)