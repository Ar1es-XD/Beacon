# server.py
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Any
import uvicorn
import json
import os
import uuid
import tempfile
import hashlib

# Import our agent logic from main.py
from main import parse_resume_native, BeaconOrchestrator, WorkflowStage, generate_final_resume

app = FastAPI(title="BEACON Agent API")

# Allow the frontend to talk to the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global dictionary to hold active sessions (In production, use Redis/Database)
active_sessions = {}

def _get_cache_path(session_id: str) -> str:
    """Derives safe cache path using sha256 to prevent path traversal."""
    safe_key = hashlib.sha256(str(session_id).encode("utf-8")).hexdigest()
    return os.path.join(tempfile.gettempdir(), f"beacon_session_{safe_key}.json")

def save_session_cache(session_id: str, orchestrator: BeaconOrchestrator):
    """Persist session state in temp directory for serverless warmup resilience."""
    try:
        cache_path = _get_cache_path(session_id)
        data = {
            "state_json": orchestrator.state_json,
            "stage": orchestrator.current_stage.name,
            "chat_history": orchestrator.chat_history
        }
        with open(cache_path, "w") as f:
            json.dump(data, f)
    except Exception as e:
        print(f"Notice: Session caching skipped: {e}")

def get_or_restore_session(session_id: str):
    """Retrieves session from memory or restores from serverless temp cache."""
    if session_id in active_sessions:
        return active_sessions[session_id]
    
    cache_path = _get_cache_path(session_id)
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                data = json.load(f)
            orchestrator = BeaconOrchestrator(data.get("state_json", "{}"))
            orchestrator.chat_history = data.get("chat_history", [])
            stage_name = data.get("stage")
            for stage in WorkflowStage:
                if stage.name == stage_name:
                    orchestrator.current_stage = stage
                    break
            active_sessions[session_id] = orchestrator
            return orchestrator
        except Exception as e:
            print(f"Notice: Session restoration skipped: {e}")
    return None

class ChatMessage(BaseModel):
    session_id: str
    user_answer: str
    current_state: Optional[Any] = None
    current_stage: Optional[str] = None
    chat_history: Optional[List[dict]] = None

def safe_parse_state(state_json):
    if isinstance(state_json, dict):
        return state_json
    try:
        return json.loads(state_json) if state_json else {}
    except Exception:
        return {}

@app.get("/api/health")
async def health_check():
    """Health and configuration check for frontend."""
    return {
        "status": "online",
        "has_gemini_key": bool(os.environ.get("GEMINI_API_KEY")),
        "sample_available": os.path.exists("sample_resume.pdf"),
        "active_sessions": len(active_sessions)
    }

@app.post("/api/upload")
async def upload_resume(file: UploadFile = File(...)):
    """Handles the initial PDF upload and kicks off the agent workflow."""
    safe_filename = f"beacon_upload_{uuid.uuid4().hex}.pdf"
    file_location = os.path.join(tempfile.gettempdir(), safe_filename)
    with open(file_location, "wb+") as file_object:
        file_object.write(await file.read())
        
    try:
        clean_name = os.path.basename(file.filename or "uploaded_resume.pdf")
        print(f"Processing uploaded file: {clean_name}")
        initial_state = parse_resume_native(file_location)
        session_id = f"session_{uuid.uuid4().hex[:12]}"
        orchestrator = BeaconOrchestrator(initial_state)
        action_data = orchestrator.determine_next_action()
        question = action_data.get("question", "Resume parsed successfully. Let's begin.")
        orchestrator.chat_history.append({"role": "agent", "content": question})
        active_sessions[session_id] = orchestrator
        save_session_cache(session_id, orchestrator)
        
        return {
            "status": "success", 
            "session_id": session_id,
            "stage": orchestrator.current_stage.name,
            "parsed_state": safe_parse_state(orchestrator.state_json),
            "chat_history": orchestrator.chat_history,
            "agent_message": question
        }
    except Exception as e:
        print(f"Error parsing upload: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})
    finally:
        if os.path.exists(file_location):
            try:
                os.remove(file_location)
            except OSError:
                pass

@app.post("/api/sample")
async def load_sample():
    """Immediately loads and parses the sample_resume.pdf for quick testing."""
    sample_path = "sample_resume.pdf"
    if not os.path.exists(sample_path):
        return JSONResponse(status_code=404, content={"status": "error", "message": "sample_resume.pdf not found"})
    try:
        print("Processing sample resume...")
        initial_state = parse_resume_native(sample_path)
        session_id = f"sample_{uuid.uuid4().hex[:12]}"
        orchestrator = BeaconOrchestrator(initial_state)
        action_data = orchestrator.determine_next_action()
        question = action_data.get("question", "Resume parsed successfully. Let's begin.")
        orchestrator.chat_history.append({"role": "agent", "content": question})
        active_sessions[session_id] = orchestrator
        save_session_cache(session_id, orchestrator)
        
        return {
            "status": "success", 
            "session_id": session_id,
            "stage": orchestrator.current_stage.name,
            "parsed_state": safe_parse_state(orchestrator.state_json),
            "chat_history": orchestrator.chat_history,
            "agent_message": question
        }
    except Exception as e:
        print(f"Error loading sample: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

@app.post("/api/chat")
async def chat_with_agent(message: ChatMessage):
    """Handles the back-and-forth interview loop with stateless serverless support."""
    orchestrator = None
    if message.current_state:
        try:
            state_str = message.current_state if isinstance(message.current_state, str) else json.dumps(message.current_state)
            orchestrator = BeaconOrchestrator(state_str)
            if message.chat_history:
                orchestrator.chat_history = list(message.chat_history)
            if message.current_stage:
                for stage in WorkflowStage:
                    if stage.name == message.current_stage:
                        orchestrator.current_stage = stage
                        break
        except Exception as e:
            print(f"Notice: Stateless orchestrator reconstruction failed: {e}")

    if not orchestrator:
        orchestrator = get_or_restore_session(message.session_id)
        
    if not orchestrator:
        return JSONResponse(status_code=404, content={"status": "error", "error": "Session not found or expired. Please upload a resume first."})
        
    try:
        last_question = "Let's begin."
        for msg in reversed(orchestrator.chat_history):
            if isinstance(msg, dict) and msg.get("role") == "agent":
                last_question = msg.get("content", "Let's begin.")
                break

        if orchestrator.chat_history and orchestrator.chat_history[-1].get("role") == "agent":
            orchestrator.chat_history.pop()

        orchestrator.process_user_answer(last_question, message.user_answer)
        save_session_cache(message.session_id, orchestrator)
        
        action_data = orchestrator.determine_next_action()
        
        # Handle stage progression loop
        while action_data.get("action") == "advance":
            orchestrator.advance_stage()
            if orchestrator.current_stage == WorkflowStage.DRAFTING:
                final_md = generate_final_resume(orchestrator.state_json)
                try:
                    with open("optimized_resume.md", "w") as f:
                        f.write(final_md)
                except OSError:
                    pass
                save_session_cache(message.session_id, orchestrator)
                return {
                    "status": "complete", 
                    "stage": "DRAFTING",
                    "parsed_state": safe_parse_state(orchestrator.state_json),
                    "chat_history": orchestrator.chat_history,
                    "final_resume": final_md
                }
            action_data = orchestrator.determine_next_action()
            
        question = action_data.get("question", "Could you provide more details about your accomplishments?")
        orchestrator.chat_history.append({"role": "agent", "content": question})
        save_session_cache(message.session_id, orchestrator)
            
        return {
            "status": "interviewing",
            "stage": orchestrator.current_stage.name,
            "parsed_state": safe_parse_state(orchestrator.state_json),
            "chat_history": orchestrator.chat_history,
            "agent_message": question
        }
    except Exception as e:
        err_msg = str(e)
        print(f"Error in chat_with_agent: {err_msg}")
        if "RESOURCE_EXHAUSTED" in err_msg or "429" in err_msg:
            return JSONResponse(status_code=429, content={
                "status": "rate_limited",
                "message": "Gemini API free tier rate limit reached (5 requests/minute). Please wait 30 seconds before sending your next answer.",
                "error": err_msg
            })
        return JSONResponse(status_code=500, content={"status": "error", "message": err_msg})

@app.get("/api/state/{session_id}")
async def get_session_state(session_id: str):
    orchestrator = get_or_restore_session(session_id)
    if not orchestrator:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Session not found"})
    return {
        "status": "success",
        "stage": orchestrator.current_stage.name,
        "parsed_state": safe_parse_state(orchestrator.state_json),
        "chat_history": orchestrator.chat_history
    }

# Static file delivery for frontend
if os.path.exists("index.html"):
    app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    print("🚀 Starting BEACON Backend Server on port 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)