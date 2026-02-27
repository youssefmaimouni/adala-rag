# Moroccan Legal RAG Assistant

This repository implements a Retrieval-Augmented Generation (RAG) question‑answering
system targeted at Moroccan legal texts.  It combines pre‑computed FAISS indexes,
LangChain retrievers and a Qwen‑style LLM served via OpenRouter.  A lightweight
Flask frontend provides a chat interface in Arabic with session history.

---

## 🔍 Project Structure

```
app.py                    # Flask application
rag_pipeline.py           # core RAG pipeline (load index, retriever, LLM)
merge_indexes.py          # helper script that merges multiple FAISS stores
index.html                # simple static chat page (alternative front-end)
requirements.txt          # Python dependencies
conversations.json        # runtime store for chat history

global_legal_rag/         # notebooks and indexes for various corpora
    dostor-*.ipynb        # PDF parsing & index-building ("دستور")
    justice-*.ipynb       # justice system corpus
    lois-reglementaires-* # regulatory laws
    *.index / *_docs.pkl  # FAISS indexes and pickled documents

Legal_RAG/                # production index used by `rag_pipeline.py`
unified_rag/              # alternate combined indexes (v1, v2)
static/                   # assets served by Flask
templates/                # Jinja2 templates (chat UI)
images/                   # miscellaneous images used by UI
```

> Most of the heavy lifting (pdf scraping, chunking, embedding, indexing) is
> performed inside the Jupyter notebooks under `global_legal_rag`.  Those
> notebooks demonstrate how the various corpora were created and can be
> re‑executed if you wish to rebuild or extend the dataset.

---

## 🛠️ Prerequisites

1. **Python 3.11+** (venv/conda recommended)
2. Install dependencies:
   ```sh
   python -m pip install -r requirements.txt
   ```
3. Create a `.env` file or export environment variables:
   ```sh
   OPENROUTER_API_KEY=<your key>
   ```
   The pipeline currently uses the `arcee-ai/trinity-large-preview:free` model
   through the OpenRouter API.  You may replace the model name in
   `rag_pipeline.py`.

4. (Optional) build or merge indexes using the provided notebooks or
   `merge_indexes.py`.

---

## 🚀 Running the Application

Start the Flask server:

```sh
python app.py
```

By default the application listens on `0.0.0.0:5000`.  Visit
`http://localhost:5000` to access the chat interface.  A simpler single‑page
version is available at the root `index.html` if you prefer a minimal client.

### API Endpoints

- `POST /chat`: send a JSON payload `{ "message": "..." }`; returns
  `{ "answer": "..." }`.
- `/api/history` / `/api/session/<sid>`: conversation management.  See
  `app.py` for details.
- `/api/clear` and `/api/new_session` control the stored conversation for the
  current cookie session.

Conversation state is stored in `conversations.json` and keyed by cookies;
a new user/session id is created automatically.

---

## 📁 Data & Indexing

- **Corpus files** (PDFs, text) are processed in the notebooks contained in
  `global_legal_rag` and `Legal_RAG`.  Each notebook outlines steps such as
  text extraction, splitting into chunks, embedding with a sentence-transformer
  model and writing out a FAISS index and a pickled document list.
- `merge_indexes.py` demonstrates how to load existing FAISS indexes (and
  associated pickled docs) and combine them into a single global store.  This
  is useful when you acquire new corpora and want to update the searchable
  index without rebuilding from scratch.
- The production pipeline in `rag_pipeline.py` expects a folder structure like
  `Legal_RAG/faiss.index` and `Legal_RAG/docs.pkl`; change `SAVE_DIR` if you
  want to point to a different location.

For experimentation you can also inspect the `unified_rag` folder which holds
alternate merged indexes (v1 and v2) along with their `meta.json`.

---

## 🧠 RAG Pipeline Details

The pipeline does the following when answering a query:

1. Load pre‑computed FAISS index (`faiss.index`) and the accompanying
   pickled document list (`docs.pkl`).
2. Instantiate a LangChain `FAISS` vectorstore, providing a
   `HuggingFaceEmbeddings` model (`BAAI/bge-m3`) to ensure the retriever can
   compute new vectors when necessary.
3. Wrap an OpenRouter LLM in `OpenRouterLLM`, satisfying LangChain's `LLM`
   interface and passing the API key from environment.
4. Create a `RetrievalQA` chain that fetches the top‑k documents and passes the
   query to the LLM along with the retrieved context.
5. The `ask_question()` helper returns the final text response.

> ⚠️ The LLM and embeddings models can be swapped easily by editing the
> corresponding constants at the top of `rag_pipeline.py`.

---

## 📝 Development Notes

- The UI is fully right‑to‑left (Arabic) and includes an on‑screen Arabic
  keyboard for mobile support.  Static assets (CSS/JS/images) live under
  `static/` and are served by Flask.
- `app.py` handles cookie management for simple session persistence; no external
  database is required.
- `test.py` is a quick script used during development to validate the
  `OPENROUTER_API_KEY` and check connectivity.

---

## ✅ Future Improvements

- Add support for automatic index rebuilding when new PDFs are added.
- Integrate additional LLM providers (OpenAI, HuggingFace inference, etc.)
- Improve chat history export (currently a rudimentary download button).
- Add Dockerfile / deployment configuration.

---

## 📚 License & Attribution

This project is provided "as-is" for educational/demo purposes.  It builds on
open‑source tools such as [LangChain](https://github.com/langchain-ai/langchain),
[FAISS](https://github.com/facebookresearch/faiss) and uses freely available
Arabic language models.

---

Feel free to explore the notebooks, extend the corpus with additional legal
texts, or adapt the pipeline to your own domain.

---
