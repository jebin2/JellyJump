from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import os
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def init_db():
    conn = sqlite3.connect('audio_captions.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS audio_files
                 (id TEXT PRIMARY KEY,
                  filename TEXT NOT NULL,
                  filepath TEXT NOT NULL,
                  status TEXT NOT NULL,
                  caption TEXT,
                  created_at TEXT NOT NULL,
                  processed_at TEXT)''')
    conn.commit()
    conn.close()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/upload', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    
    file = request.files['audio']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400
    
    file_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, f"{file_id}_{filename}")
    file.save(filepath)
    
    conn = sqlite3.connect('audio_captions.db')
    c = conn.cursor()
    c.execute('''INSERT INTO audio_files 
                 (id, filename, filepath, status, created_at)
                 VALUES (?, ?, ?, ?, ?)''',
              (file_id, filename, filepath, 'not_started', datetime.now().isoformat()))
    conn.commit()
    conn.close()
    
    return jsonify({
        'id': file_id,
        'filename': filename,
        'status': 'not_started',
        'message': 'File uploaded successfully'
    }), 201

@app.route('/api/files', methods=['GET'])
def get_files():
    conn = sqlite3.connect('audio_captions.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM audio_files ORDER BY created_at DESC')
    rows = c.fetchall()
    conn.close()
    
    files = []
    for row in rows:
        files.append({
            'id': row['id'],
            'filename': row['filename'],
            'status': row['status'],
            'caption': row['caption'],
            'created_at': row['created_at'],
            'processed_at': row['processed_at']
        })
    
    return jsonify(files)

@app.route('/api/files/<file_id>', methods=['GET'])
def get_file(file_id):
    conn = sqlite3.connect('audio_captions.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM audio_files WHERE id = ?', (file_id,))
    row = c.fetchone()
    conn.close()
    
    if row is None:
        return jsonify({'error': 'File not found'}), 404
    
    return jsonify({
        'id': row['id'],
        'filename': row['filename'],
        'status': row['status'],
        'caption': row['caption'],
        'created_at': row['created_at'],
        'processed_at': row['processed_at']
    })

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)