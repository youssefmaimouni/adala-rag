from flask import Flask, render_template, request, jsonify, make_response, g, session, redirect, url_for, abort
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import uuid, json, os, datetime, hashlib
from rag_pipeline import ask_question

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'devkey')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/adala')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ------------------------------
# models
# ------------------------------

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email_ciphertext = db.Column(db.LargeBinary, nullable=False)
    email_hash = db.Column(db.String(128), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Conversation(db.Model):
    id = db.Column(db.String, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    messages = db.relationship('Message', backref='conversation', cascade='all, delete-orphan')

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    conv_id = db.Column(db.String, db.ForeignKey('conversation.id'), nullable=False)
    role = db.Column(db.String, nullable=False)
    text = db.Column(db.Text)
    time = db.Column(db.DateTime)
    sources = db.Column(db.JSON)

# create tables if they don't exist
with app.app_context():
    db.create_all()


@app.before_request
def ensure_logged_in():
    # allow public endpoints
    if request.endpoint in ('login', 'static', 'register', 'logout'):
        return
    if 'user_id' not in session:
        return redirect(url_for('login'))
    # load current user into g
    g.user = User.query.get(session['user_id'])

# conversation helper


def get_or_create_conversation(sid=None):
    if sid:
        conv = Conversation.query.filter_by(id=sid, owner_id=g.user.id).first()
        if conv:
            return conv
        # conversation not found or not owned
        abort(404)
    # create new conversation
    new_id = str(uuid.uuid4())
    conv = Conversation(id=new_id, owner_id=g.user.id)
    db.session.add(conv)
    db.session.commit()
    return conv

# attach handler
app.before_request(ensure_logged_in)


@app.route("/")
def home():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return redirect(url_for('accueil'))

@app.route("/accueil")
def accueil():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template("accueil.html", user_email=g.user.email_ciphertext.decode(), user_id=g.user.id)


@app.route('/register', methods=['GET','POST'])
def register():
    error = None
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        if not email or not password:
            error = 'Email and password required'
        else:
            h = hashlib.sha256(email.encode()).hexdigest()
            if User.query.filter_by(email_hash=h).first():
                error = 'Email already registered'
            else:
                user = User(
                    email_ciphertext=email.encode(),
                    email_hash=h,
                    password_hash=generate_password_hash(password)
                )
                db.session.add(user)
                db.session.commit()
                session['user_id'] = user.id
                return redirect(url_for('home'))
    return render_template('register.html', error=error)


@app.route('/login', methods=['GET','POST'])
def login():
    error = None
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        h = hashlib.sha256(email.encode()).hexdigest()
        user = User.query.filter_by(email_hash=h).first()
        if not user or not check_password_hash(user.password_hash, password):
            error = 'Invalid credentials'
        else:
            session['user_id'] = user.id
            return redirect(url_for('home'))
    return render_template('login.html', error=error)


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route("/chat", methods=["GET"])
def chat_base():
    return render_template("chat.html")


@app.route("/chat/<sid>", methods=["GET"])
def chat_page(sid=None):
    # serve the main interface; client-side will handle the conversation ID
    return render_template("chat.html")


@app.route("/chat", methods=["POST"])
@app.route("/chat/<sid>", methods=["POST"])
def chat(sid=None):
    user_message = request.json.get("message")

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    # ask_question now injects source links into the returned string
    answer, sources = ask_question(user_message)

    # determine which conversation to write to
    conv = get_or_create_conversation(sid)

    # save the user message first
    msg1 = Message(conv_id=conv.id, role="user", text=user_message,
                   time=datetime.datetime.utcnow(), sources=[])
    db.session.add(msg1)

    # record bot message along with any source metadata so that history
    # playback can recreate the links
    msg2 = Message(conv_id=conv.id, role="bot", text=answer,
                   time=datetime.datetime.utcnow(), sources=sources or [])
    db.session.add(msg2)
    db.session.commit()

    # always include sources key in the response (empty list if none)
    return jsonify({"answer": answer, "sources": sources or [], "conversation_id": conv.id})


# --- new helper route to serve PDFs from the legal_DOCS folder ---
from flask import send_from_directory

@app.route('/pdf/<path:filename>')
def serve_pdf(filename):
    """Return a file from the corpus directory.  Files are referenced
    in the RAG metadata and exposed to the chat interface as links.
    """
    # the directory is fixed; avoid escaping by joining with os.path.normpath
    base = os.path.abspath('legal_DOCS')
    return send_from_directory(base, filename)

@app.route("/api/clear", methods=["POST"])
def clear():
    # delete the entire conversation and all its messages
    sid = request.args.get('sid')
    if not sid:
        # use last active conv if not specified
        conv = Conversation.query.filter_by(owner_id=g.user.id).order_by(Conversation.created.desc()).first()
    else:
        conv = Conversation.query.filter_by(id=sid, owner_id=g.user.id).first()
    if conv:
        db.session.delete(conv)
        db.session.commit()
    return ("", 204)


@app.route("/api/new_session", methods=["POST"])
def new_session():
    # create a fresh conversation and return its id
    conv = get_or_create_conversation(None)
    return jsonify({"id": conv.id}), 201


@app.route("/api/history")
def history():
    # return a list of conversation metadata for current user
    hist = []
    convs = Conversation.query.filter_by(owner_id=g.user.id).order_by(Conversation.created.desc()).all()
    for conv in convs:
        first = Message.query.filter_by(conv_id=conv.id).order_by(Message.id).first()
        title = conv.created.strftime("%Y-%m-%d %H:%M") + " - " + first.text if first else "محادثة فارغة"
        hist.append({"id": conv.id, "title": title, "timestamp": conv.created.isoformat()})
    return jsonify(hist)


@app.route("/api/session/<sid>")
def get_session(sid):
    conv = Conversation.query.filter_by(id=sid, owner_id=g.user.id).first()
    if not conv:
        return jsonify({"error": "not found"}), 404
    msgs = []
    for m in Message.query.filter_by(conv_id=conv.id).order_by(Message.id).all():
        msgs.append({
            "role": m.role,
            "text": m.text,
            "time": m.time.isoformat() if m.time else None,
            "sources": m.sources or []
        })
    return jsonify({"id": conv.id, "created": conv.created.isoformat(), "messages": msgs})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)