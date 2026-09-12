import os
import json
import time
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ServerError

# -------------------------------------------------------------
# RETRY LOGIC (STDLIB)
# -------------------------------------------------------------

def retry_on_server_error(max_attempts=3, initial_delay=2):
    def decorator(func):
        def wrapper(*args, **kwargs):
            delay = initial_delay
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except ServerError:
                    if attempt == max_attempts - 1:
                        raise
                    time.sleep(delay)
                    delay *= 2
        return wrapper
    return decorator

# -------------------------------------------------------------
# AGENTIC CONCEPT 1: SCHEMA-DRIVEN STATE
# -------------------------------------------------------------

class WorkExperience(BaseModel):
    company: str = Field(description="Name of the company or organization")
    role: str = Field(description="Job title or designation")
    duration: Optional[str] = Field(None, description="Start and end dates (e.g., Jan 2023 - Present)")
    highlights: List[str] = Field(default_factory=list, description="Key responsibilities and bullet points")
    impact_metrics: List[str] = Field(
        default_factory=list, 
        description="Quantified outcomes (e.g., 'Increased retention by 15%'). Often empty initially."
    )

class Project(BaseModel):
    title: str = Field(description="Title of the project")
    tech_stack: List[str] = Field(default_factory=list, description="Tools, frameworks, and languages used")
    description: str = Field(description="Summary of the project")
    metrics_or_outcome: Optional[str] = Field(None, description="Measurable achievements or results")

class Education(BaseModel):
    institution: str = Field(description="School, College, or University name")
    degree: str = Field(description="Degree or certification obtained")
    year_or_duration: Optional[str] = Field(None, description="Year of graduation or time period")

class ResumeState(BaseModel):
    """The central state of the BEACON agent."""
    full_name: str = Field(description="Candidate's full legal name")
    email: Optional[str] = Field(None, description="Email address")
    social_links: List[str] = Field(default_factory=list, description="GitHub, LinkedIn, Portfolio URLs")
    skills: List[str] = Field(default_factory=list, description="Technical and soft skills")
    work_experience: List[WorkExperience] = Field(default_factory=list)
    projects: List[Project] = Field(default_factory=list)
    education: List[Education] = Field(default_factory=list)

class StatePatch(BaseModel):
    """Schema for targeted memory updates to prevent full-state rewrites."""
    company_name: str = Field(description="The exact company name this answer applies to")
    new_metrics: List[str] = Field(description="Professional, quantifiable resume bullet points extracted from the candidate's answer")

# -------------------------------------------------------------
# AGENTIC CONCEPT 2 & 4: NATIVE MULTIMODAL INGESTION (INLINE)
# -------------------------------------------------------------

load_dotenv()

# Lazy Gemini client initialization to avoid crashes at module import time
def get_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY environment variable is not configured. "
            "Please set GEMINI_API_KEY in your Vercel Project Settings > Environment Variables."
        )
    return genai.Client(api_key=api_key)

class _LazyGenAIClient:
    """Lazily initializes the Gemini client on first access to prevent import-time crashes."""
    _client = None

    def __getattr__(self, name):
        if self._client is None:
            self._client = get_client()
        return getattr(self._client, name)

client = _LazyGenAIClient()

# -------------------------------------------------------------
# AGENTIC CONCEPT 10: UNIVERSAL TOOLS & FUNCTION CALLING
# -------------------------------------------------------------

# AGENTIC CONCEPT 11: ATS INDUSTRY RUBRICS
# ---------------------------------------------------------
INDUSTRY_RUBRICS = {
    "tech": "Computer Science standards: Focus heavily on system architecture, API design, scalability metrics (e.g., 'reduced latency by 40%'), and clean version control.",
    "medical": "Medical/Healthcare standards (BHMS/Allied): Emphasize clinical diagnostics accuracy, patient record maintenance, adherence to safety compliance protocols, and compassionate care.",
    "finance": "Business/Finance standards: Highlight financial modeling, data-driven market research, stakeholder communication, and clear ROI or percentage-based growth tracking.",
    "marketing": "Content Creator/Marketing standards: Highlight subscriber growth percentages, conversion rates, engagement metrics, A/B testing results, and affiliate revenue generation."
}

def retrieve_industry_knowledge(query: str) -> str:
    """
    Searches for precise technical requirements and ATS guidelines based on the candidate's target role.
    """
    print(f"\n📚 [RAG TRIGGERED] Searching ATS industry knowledge for: '{query}'...")
    import re
    words = set(re.findall(r"[a-z0-9]+", query.lower()))
    
    med_terms = {"medical", "medicine", "med", "health", "healthcare", "doctor", "physician", "bhms", "clinic", "clinical", "patient", "allied"}
    fin_terms = {"finance", "financial", "banking", "bank", "invest", "investment", "roi", "accounting", "accountant", "money", "equity", "wealth", "portfolio", "business"}
    mkt_terms = {"marketing", "market", "content", "social", "growth", "seo", "media", "creator", "youtube", "affiliate", "campaign"}
    tech_terms = {"code", "coding", "software", "dev", "developer", "tech", "technical", "cs", "computer", "engineer", "engineering", "data", "web", "api", "backend", "frontend"}

    if words & med_terms or any(w.startswith("medic") or w.startswith("clinic") for w in words):
        return INDUSTRY_RUBRICS["medical"]
    elif words & fin_terms or any(w.startswith("financ") or w.startswith("invest") for w in words):
        return INDUSTRY_RUBRICS["finance"]
    elif words & mkt_terms or any(w.startswith("market") for w in words):
        return INDUSTRY_RUBRICS["marketing"]
    elif words & tech_terms or any(w.startswith("softw") or w.startswith("develop") or w.startswith("comput") or w.startswith("engine") for w in words):
        return INDUSTRY_RUBRICS["tech"]

    return "General professional standards: Focus on clarity, quantifiable impact, ownership of projects, and team leadership."

# -------------------------------------------------------------
# AGENTIC CONCEPT 12: URL SCRAPER (DIRECT TOOL)
# -------------------------------------------------------------
import requests
from bs4 import BeautifulSoup

def inspect_project_link(url: str) -> str:
    """
    Directly fetches and extracts text from any public URL.
    Use this tool whenever a student provides a link to their portfolio, GitHub, or project website.
    """
    print(f"\n🌍 [SCRAPER TRIGGERED] Fetching content from: {url}...")
    
    try:
        # We use a user-agent so websites don't block us as a bot
        headers = {'User-Agent': 'Mozilla/5.0 (BEACON-Resume-Agent)'}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Parse the HTML and extract just the text
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove scripts and styles
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.extract()
            
        text = soup.get_text(separator=' ', strip=True)
        
        # Cap at 1500 characters so we don't overwhelm the LLM's context window
        return text[:1500]
        
    except Exception as e:
        return f"Fetch Failed: {str(e)}"

@retry_on_server_error()
def parse_resume_native(pdf_path: str) -> str:
    """Reads the PDF locally and sends it inline to Gemini to avoid File API permission issues."""
    print(f"📄 Reading {pdf_path} locally...")
    
    # 1. Read the file directly into memory as raw bytes
    with open(pdf_path, "rb") as doc_file:
        doc_bytes = doc_file.read()
        
    print("🧠 AI is analyzing document structure and extracting structured data...")
    
    prompt = """
    You are an expert technical recruiter and resume auditor.
    Analyze the uploaded resume document thoroughly.
    Extract the candidate's details strictly conforming to the provided schema.
    If specific information (e.g., impact metrics or dates) is missing or vague, leave those lists empty or fields as null.
    Do not hallucinate or extrapolate details not present in the document.
    """
    
    response = client.models.generate_content(
        model='gemini-3.6-flash',
        contents=[
            types.Part.from_bytes(
                data=doc_bytes,
                mime_type='application/pdf',
            ),
            prompt
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ResumeState,
        ),
    )
    
    return response.text

# -------------------------------------------------------------
# AGENTIC CONCEPT 8: MEMORY & STATE MUTATION (THE LOOP)
# -------------------------------------------------------------

# AGENTIC CONCEPT 8: MEMORY & STATE MUTATION (DELTA PATCHING)
# ---------------------------------------------------------

def update_state_with_answer(current_state_json: str, question: str, user_answer: str) -> str:
    """
    Extracts ONLY the new information from the user and safely patches the 
    existing JSON state via Python, preventing data loss or hallucination.
    """
    print("\n🧠 [MEMORY MUTATION] Agent is synthesizing your answer and patching its memory...")
    
    prompt = f"""
    You are an expert technical resume writer.
    Question Asked: {question}
    Candidate's Answer: {user_answer}
    
    Task: 
    1. Identify the company name this applies to based on the context.
    2. Extract the candidate's raw answer into highly professional, quantifiable resume bullet points starting with strong action verbs.
    """
    
    # Notice we use StatePatch here, NOT ResumeState
    response = client.models.generate_content(
        model='gemini-3.6-flash', # <--- Change this to 2.5
        contents=prompt,
    # ... rest of your code
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=StatePatch,
            temperature=0.2
        )
    )
    
    patch_data = json.loads(response.text)
    state_data = json.loads(current_state_json)
    
    # Safely mutate the state using deterministic Python logic, NOT the LLM
    work_exps = state_data.get("work_experience", [])
    target_comp = patch_data.get("company_name", "").strip().lower()
    for experience in work_exps:
        exp_comp = experience.get("company", "").strip().lower()
        # Loose match or fallback if only one experience exists
        if (target_comp and (target_comp in exp_comp or exp_comp in target_comp)) or len(work_exps) == 1:
            if "impact_metrics" not in experience:
                experience["impact_metrics"] = []
            experience["impact_metrics"].extend(patch_data.get("new_metrics", []))
            print(f"✅ Successfully patched metrics for {experience.get('company', 'role')}")
            break
            
    return json.dumps(state_data, indent=4)

# -------------------------------------------------------------
# AGENTIC CONCEPT 9: SYNTHESIS & CONTENT GENERATION
# -------------------------------------------------------------

def generate_final_resume(final_state_json: str) -> str:
    """Takes the fully enriched JSON state and drafts a polished, ATS-friendly resume."""
    print("\n✍️ Agent is drafting the final optimized resume...")
    
    prompt = f"""
    You are an expert resume writer. Take the following structured candidate data (JSON) 
    and format it into a clean, professional, and highly impactful Markdown resume.
    
    Candidate Data:
    {final_state_json}
    
    Rules for drafting:
    1. Start with the candidate's Name and Contact Info at the top.
    2. Create clear sections: SKILLS, WORK EXPERIENCE, PROJECTS, and EDUCATION.
    3. For Work Experience, combine the 'highlights' and 'impact_metrics' into powerful, bulleted achievement statements. Start every bullet with a strong action verb.
    4. Ensure the formatting uses Markdown headers (##), bold text (**), and bullet points (-) cleanly.
    """
    
    # We do NOT use structured JSON output here, because we want raw Markdown text.
    response = client.models.generate_content(
        model='gemini-3.6-flash',
        contents=prompt
    )
    
    return response.text


# if __name__ == "__main__":
# Define the exact workflow stages from BEACON architecture
class WorkflowStage(Enum):
    VALIDATION = 2      # Step 2: Structured Data Validation
    DEEP_DIVE = 3       # Step 3: Proactive Deep Dive (Work/Projects)
    BEHAVIORAL = 4      # Step 4: Behavioral & Skills Interview
    CLARIFICATION = 5   # Step 5: Collaborative Clarification Loop
    DRAFTING = 6        # Step 6: AI-Powered Content Drafting

class BeaconOrchestrator:
    def __init__(self, initial_state_json: str):
        self.state_json = initial_state_json
        self.current_stage = WorkflowStage.VALIDATION
        self.chat_history = []

    @retry_on_server_error()
    
    def determine_next_action(self) -> dict:
        """
        Evaluates the current JSON state and chat history to decide whether to 
        ask a question in the current stage or advance to the next stage.
        """
        prompt = f"""
        You are BEACON, an elite Agentic Resume Engineer.

        Current Workflow Stage: {self.current_stage.name}
        Current Resume State: {self.state_json}
        Recent Chat History: {self.chat_history[-4:] if self.chat_history else "None"}

        Your goals based on the stage:
        - VALIDATION: Check for missing education dates, broken URLs, or missing basic info. USE inspect_project_link to verify URLs if present.
        - DEEP_DIVE: Ask for impact metrics and technical specifics for Work/Projects.
        - BEHAVIORAL: Ask one targeted question about soft skills, leadership, or problem-solving.
        - CLARIFICATION: Ask if the user has any final things to add before drafting.

        Analyze the Resume State. Are there gaps relevant to the Current Stage?
        If YES: Generate a natural, engaging interview question to get that data.
        If NO (or if the user answered sufficiently): Output the exact string "STAGE_COMPLETE".
        """

        response = client.models.generate_content(
            model='gemini-3.6-flash', # <--- Change this to 2.5
            contents=prompt,
    # ... rest of your code
            config=types.GenerateContentConfig(
                tools=[inspect_project_link, retrieve_industry_knowledge], 
                temperature=0.3
            )
        )
        
        # Check if the AI decided this stage is fully complete
        text_out = response.text or ""
        if "STAGE_COMPLETE" in text_out:
            return {"action": "advance"}
        else:
            return {"action": "ask", "question": text_out.strip()}

    def process_user_answer(self, question: str, answer: str):
        """Records the conversation and triggers the memory mutation."""
        self.chat_history.append({"role": "agent", "content": question})
        self.chat_history.append({"role": "user", "content": answer})

        # Use the updated state mutation function with Delta Patching
        self.state_json = update_state_with_answer(
            current_state_json=self.state_json,
            question=question,
            user_answer=answer
        )

    def advance_stage(self):
        """Moves the orchestrator to the next logical workflow stage."""
        current_val = self.current_stage.value
        if current_val < WorkflowStage.DRAFTING.value:
            self.current_stage = WorkflowStage(current_val + 1)
            print(f"⏩ Advanced to stage: {self.current_stage.name}")
if __name__ == "__main__":
    sample_pdf_path = "sample_resume.pdf"
    
    if os.path.exists(sample_pdf_path):
        print("\n🚀 INITIALIZING BEACON WORKFLOW...")
        
        # Step 1: Parse
        structured_json = parse_resume_native(sample_pdf_path)
        orchestrator = BeaconOrchestrator(structured_json)
        
        # The Main Agent Loop (Steps 2 through 5)
        while orchestrator.current_stage != WorkflowStage.DRAFTING:
            action_data = orchestrator.determine_next_action()
            
            if action_data["action"] == "advance":
                print(f"\n✅ Completed Stage: {orchestrator.current_stage.name}")
                # Move to the next enum stage natively
                orchestrator.current_stage = WorkflowStage(orchestrator.current_stage.value + 1)
                continue
                
            elif action_data["action"] == "ask":
                question = action_data["question"]
                print(f"\n🤖 BEACON [{orchestrator.current_stage.name}]:")
                print(question)
                
                # Get terminal input from you (the user)
                user_answer = input("\n👤 YOU (Type your answer): ")
                
                # Update the state based on your answer
                orchestrator.process_user_answer(question, user_answer)
                
        # Step 6 & 7: Drafting and Delivery
        print("\n✍️ All stages complete. Drafting final optimized resume...")
        final_markdown = generate_final_resume(orchestrator.state_json)
        
        with open("optimized_resume.md", "w") as f:
            f.write(final_markdown)
            
        print("\n🎉 SUCCESS! Resume saved to 'optimized_resume.md'.")