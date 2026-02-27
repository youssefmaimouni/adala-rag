<<<<<<< HEAD
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
=======
# Adala RAG



## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

* [Create](https://docs.gitlab.com/user/project/repository/web_editor/#create-a-file) or [upload](https://docs.gitlab.com/user/project/repository/web_editor/#upload-a-file) files
* [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://gitlab.com/youssefmaimouni03-group/techpal/adala-rag.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

* [Set up project integrations](https://gitlab.com/youssefmaimouni03-group/techpal/adala-rag/-/settings/integrations)

## Collaborate with your team

* [Invite team members and collaborators](https://docs.gitlab.com/user/project/members/)
* [Create a new merge request](https://docs.gitlab.com/user/project/merge_requests/creating_merge_requests/)
* [Automatically close issues from merge requests](https://docs.gitlab.com/user/project/issues/managing_issues/#closing-issues-automatically)
* [Enable merge request approvals](https://docs.gitlab.com/user/project/merge_requests/approvals/)
* [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

* [Get started with GitLab CI/CD](https://docs.gitlab.com/ci/quick_start/)
* [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/user/application_security/sast/)
* [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/topics/autodevops/requirements/)
* [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/user/clusters/agent/)
* [Set up protected environments](https://docs.gitlab.com/ci/environments/protected_environments/)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.
>>>>>>> 6491fab0f1716ad6575ff631f50bb6e305a6a0cd
