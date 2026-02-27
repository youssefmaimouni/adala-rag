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

# # ---- Load your FAISS index ----
# index = faiss.read_index("./Legal_RAG/faiss.index")

# # ---- Load your docs ----
# with open("./Legal_RAG/docs.pkl", "rb") as f:
#     all_docs = pickle.load(f)
# print(embedding_model)
# # ---- Build LangChain FAISS vectorstore manually ----
# vectorstore = FAISS(
#     index=index,      # FAISS index object
#     docstore=all_docs, # list of dicts
#     embedding_function=embedding_model, # embedding function for retriever
#     index_to_docstore_id={i: doc for i, doc in enumerate(all_docs)}
# )

from langchain_community.docstore import InMemoryDocstore
from langchain.schema import Document

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

retriever = vectorstore.as_retriever(search_kwargs={"k": 5})


# (The vectorstore has already been constructed above with the proper
# embedding function, index, and docstore.  There is no need to recreate
# it a second time, which was causing the TypeError.)

# ==========================
# BUILD QA CHAIN
# ==========================
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever
)

def ask_question(question: str):
    result = qa_chain.invoke({"query": question})
    
    return result["result"]

# ==========================
# EXAMPLE USAGE
# ==========================
if __name__ == "__main__":
    question = "ما هي أحكام المادة 23 من قانون المسطرة الجنائية؟"
    answer = ask_question(question)
    print("❓ Question:", question)
    print("💡 Answer:", answer)