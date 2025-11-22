import sqlite3
import time
import os
import subprocess
import json
import shlex
from datetime import datetime

CWD = "./"
PYTHON_PATH = "stt-transcribe"
STT_MODEL_NAME = "fasterwhispher"
POLL_INTERVAL = 5  # seconds

def process_audio(file_id, filepath):
    """Process audio file using STT and return the transcription"""
    try:
        print(f"Processing file: {filepath}")
        
        # Run STT command
        command = f"""cd {CWD} && {PYTHON_PATH} --input {shlex.quote(os.path.abspath(filepath))} --model {STT_MODEL_NAME}"""
        
        subprocess.run(
            command,
            shell=True,
            executable="/bin/bash",
            check=True,
            cwd=CWD,
            env={
                **os.environ,
                'PYTHONUNBUFFERED': '1',
                'CUDA_LAUNCH_BLOCKING': '1',
                'USE_CPU_IF_POSSIBLE': 'true'
            }
        )
        
        # Read transcription result
        output_path = f'{CWD}/temp_dir/output_transcription.json'
        with open(output_path, 'r') as file:
            result = json.loads(file.read().strip())
        
        # Extract caption text (adjust based on your actual output format)
        caption = result.get('text', '') or result.get('transcription', '') or str(result)
        
        return caption, None
        
    except Exception as e:
        print(f"Error processing file {file_id}: {str(e)}")
        return None, str(e)

def update_status(file_id, status, caption=None, error=None):
    """Update the status of a file in the database"""
    conn = sqlite3.connect('audio_captions.db')
    c = conn.cursor()
    
    if status == 'completed':
        c.execute('''UPDATE audio_files 
                     SET status = ?, caption = ?, processed_at = ?
                     WHERE id = ?''',
                  (status, caption, datetime.now().isoformat(), file_id))
    elif status == 'failed':
        c.execute('''UPDATE audio_files 
                     SET status = ?, caption = ?, processed_at = ?
                     WHERE id = ?''',
                  (status, f"Error: {error}", datetime.now().isoformat(), file_id))
    else:
        c.execute('UPDATE audio_files SET status = ? WHERE id = ?', (status, file_id))
    
    conn.commit()
    conn.close()

def worker_loop():
    """Main worker loop that processes audio files"""
    print("STT Worker started. Polling for new audio files...")
    
    while True:
        try:
            # Get next unprocessed file
            conn = sqlite3.connect('audio_captions.db')
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute('''SELECT * FROM audio_files 
                         WHERE status = 'not_started' 
                         ORDER BY created_at ASC 
                         LIMIT 1''')
            row = c.fetchone()
            conn.close()
            
            if row:
                file_id = row['id']
                filepath = row['filepath']
                filename = row['filename']
                
                print(f"\n{'='*60}")
                print(f"Processing: {filename}")
                print(f"ID: {file_id}")
                print(f"{'='*60}")
                
                # Update status to processing
                update_status(file_id, 'processing')
                
                # Process the audio file
                caption, error = process_audio(file_id, filepath)
                
                if caption:
                    print(f"✓ Successfully processed: {filename}")
                    print(f"Caption: {caption[:100]}...")
                    update_status(file_id, 'completed', caption=caption)
                else:
                    print(f"✗ Failed to process: {filename}")
                    print(f"Error: {error}")
                    update_status(file_id, 'failed', error=error)
            else:
                # No files to process, sleep for a bit
                time.sleep(POLL_INTERVAL)
                
        except Exception as e:
            print(f"Worker error: {str(e)}")
            time.sleep(POLL_INTERVAL)

if __name__ == '__main__':
    # Initialize database if it doesn't exist
    if not os.path.exists('audio_captions.db'):
        print("Database not found. Please run app.py first to initialize.")
    else:
        worker_loop()