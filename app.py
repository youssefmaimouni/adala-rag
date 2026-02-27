from flask import Flask, render_template, request, jsonify, make_response, g
import uuid, json, os, datetime
from rag_pipeline import ask_question

app = Flask(__name__)

# ------------------------------
# conversation persistence
# ------------------------------
CONV_FILE = "conversations.json"


def load_conversations():
    if os.path.exists(CONV_FILE):
        with open(CONV_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_conversations(conversations):
    with open(CONV_FILE, "w", encoding="utf-8") as f:
        json.dump(conversations, f, ensure_ascii=False, indent=2)

# load existing data at startup
conversations = load_conversations()


@app.before_request
# ensure every visitor has a persistent user id and a session id

def ensure_session():
    # user id is stable across sessions; helps filter history
    uid = request.cookies.get("user_id")
    if not uid:
        uid = str(uuid.uuid4())
        g.new_user = True
    else:
        g.new_user = False
    g.user_id = uid

    # active conversation id; may change when creating new chat
    sid = request.cookies.get("session_id")
    if not sid or sid not in conversations:
        sid = str(uuid.uuid4())
        conversations[sid] = {
            "owner": g.user_id,
            "created": datetime.datetime.utcnow().isoformat(),
            "messages": []
        }
        save_conversations(conversations)
        g.new_session = True
    else:
        g.new_session = False
        # ensure owner field exists for backwards compatibility
        if "owner" not in conversations[sid]:
            conversations[sid]["owner"] = g.user_id
            save_conversations(conversations)
    g.session_id = sid


@app.after_request

def set_session_cookie(response):
    # always update session cookie to current active id
    response.set_cookie("session_id", g.session_id)
    # if user id is new attach it once
    if getattr(g, 'new_user', False):
        response.set_cookie("user_id", g.user_id)
    return response


@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    user_message = request.json.get("message")

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    answer = ask_question(user_message)

    # log into conversation store for current session
    sid = g.session_id
    conversations.setdefault(sid, {"owner": g.user_id, "created": datetime.datetime.utcnow().isoformat(), "messages": []})
    conversations[sid]["messages"].append({
        "role": "user",
        "text": user_message,
        "time": datetime.datetime.utcnow().isoformat()
    })
    conversations[sid]["messages"].append({
        "role": "bot",
        "text": answer,
        "time": datetime.datetime.utcnow().isoformat()
    })
    save_conversations(conversations)

    return jsonify({"answer": answer})

@app.route("/api/clear", methods=["POST"])
def clear():
    sid = g.session_id
    if sid in conversations:
        conversations[sid]["messages"] = []
        save_conversations(conversations)
    return ("", 204)


@app.route("/api/new_session", methods=["POST"])
def new_session():
    # create a fresh session and override cookie
    sid = str(uuid.uuid4())
    conversations[sid] = {"owner": g.user_id, "created": datetime.datetime.utcnow().isoformat(), "messages": []}
    save_conversations(conversations)
    resp = make_response(("", 204))
    resp.set_cookie("session_id", sid)
    return resp


@app.route("/api/history")
def history():
    # return a list of conversation metadata
    hist = []
    for sid, data in conversations.items():
        # only include convos belonging to this user
        if data.get("owner") != g.user_id:
            continue
        title = data["messages"][0]["text"][:40] + "..." if data["messages"] else "محادثة فارغة"
        hist.append({"id": sid, "title": title, "timestamp": data.get("created")})
    hist.sort(key=lambda x: x["timestamp"], reverse=True)
    return jsonify(hist)


@app.route("/api/session/<sid>")
def get_session(sid):
    data = conversations.get(sid)
    if not data or data.get("owner") != g.user_id:
        return jsonify({"error": "not found"}), 404
    return jsonify(data)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)