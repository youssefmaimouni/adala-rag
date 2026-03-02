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
            "title": doc.get("title"),
            "source": doc.get("source"),
            "chunk_id": doc.get("chunk_id"),
            "corpus": doc.get("corpus"),
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

def _format_source(src: str) -> dict:
    """Return a dict with ``name`` and ``url`` for a source path.

    The frontend expects a list of such dicts; when the source file lives
    under ``legal_DOCS`` we compute a URL via our ``/pdf`` helper route.
    Otherwise ``url`` stays ``None`` and the client may simply display the
    basename without making it clickable.
    """
    info = {"name": "", "url": None}
    if not src:
        return info

    # normalize to forward slashes for URLs
    src_path = os.path.normpath(src)
    try:
        rel = os.path.relpath(src_path, start=os.getcwd())
    except Exception:
        rel = src_path

    info["name"] = os.path.basename(src_path)
    if rel.startswith(os.path.normpath('legal_DOCS')):
        # strip leading directory portion
        rel_path = rel[len(os.path.normpath('legal_DOCS') + os.sep) :]
        url = f"/pdf/{rel_path.replace(os.sep, '/') }"
        info["url"] = url
    return info


def ask_question(question: str):
    # request the chain and explicitly ask for source_documents
    result = qa_chain({"query": question})
    answer = result.get("result", "")

    # gather unique source links from the retrieved documents
    seen = set()
    sources = []

    for doc in result.get("source_documents", []):
        src = doc.metadata.get("source")
        if not src or src in seen:
            continue
        seen.add(src)
        sources.append(src)

    # sources is now a list of dicts {name,url}
    return answer, sources

# ==========================
# EXAMPLE USAGE
# ==========================
if __name__ == "__main__":
    question = "ما هي عقوبة تجاوز السرعة القصوى"
    answer, sources = ask_question(question)
    print("❓ Question:", question)
    print("💡 Answer:", answer)
    print("📁 Sources:", sources)