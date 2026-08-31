# server.py
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import json
import os

# Import our agent logic from main.py
from main import parse_resume_native, BeaconOrchestrator

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

class ChatMessage(BaseModel):
    session_id: str
    user_answer: str

@app.post("/api/upload")
async def upload_resume(file: UploadFile = File(...)):
    """Handles the initial PDF upload and kicks off the agent workflow."""
    
    # 1. Save the uploaded file temporarily
    file_location = f"temp_{file.filename}"
    with open(file_location, "wb+") as file_object:
        file_object.write(await file.read())
        
    try:
        # 2. Parse the PDF using our GenAI function
        print(f"Processing uploaded file: {file.filename}")
        initial_state = parse_resume_native(file_location)
        
        # 3. Create a unique session and initialize the Orchestrator
        session_id = "user_123" # Hardcoded for prototype
        orchestrator = BeaconOrchestrator(initial_state)
        
        # 4. Get the very first question from the agent
        action_data = orchestrator.determine_next_action()
        
        # 5. Store the orchestrator in memory so we can talk to it later
        active_sessions[session_id] = orchestrator
        
        return {
            "status": "success", 
            "session_id": session_id,
            "agent_message": action_data.get("question", "Resume parsed successfully. Let's begin.")
        }
        
    finally:
        # Clean up the temp file
        if os.path.exists(file_location):
            os.remove(file_location)

@app.post("/api/chat")
async def chat_with_agent(message: ChatMessage):
    """Handles the back-and-forth interview loop."""
    
    orchestrator = active_sessions.get(message.session_id)
    if not orchestrator:
        return {"error": "Session not found or expired."}
        
    # 1. Update the agent's memory with the user's answer
    last_question = orchestrator.chat_history[-1]["content"] if orchestrator.chat_history else "Let's begin."
    orchestrator.process_user_answer(last_question, message.user_answer)
    
    # 2. Determine the next move
    action_data = orchestrator.determine_next_action()
    
    # 3. Handle stage progression loop
    while action_data["action"] == "advance":
        if orchestrator.current_stage.name == "DRAFTING":
            # WE ARE DONE! Generate the final resume.
            from main import generate_final_resume
            final_md = generate_final_resume(orchestrator.state_json)
            return {"status": "complete", "final_resume": final_md}
            
        # Move to next stage and evaluate again automatically
        orchestrator.advance_stage()
        action_data = orchestrator.determine_next_action()
        
    # 4. Save the agent's new question to history
    orchestrator.chat_history.append({"role": "agent", "content": action_data["question"]})
        
    return {
        "status": "interviewing",
        "agent_message": action_data["question"]
    }

if __name__ == "__main__":
    print("🚀 Starting BEACON Backend Server on port 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)


    