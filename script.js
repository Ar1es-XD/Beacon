// script.js
const API_BASE_URL = "http://localhost:8000/api";
let currentSessionId = null;

// UI Elements
const uploadInput = document.getElementById("resume-upload");
const uploadContainer = document.getElementById("upload-container");
const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const statusIndicator = document.getElementById("status-indicator");
const loadingOverlay = document.getElementById("loading-overlay");
const finalResumeContainer = document.getElementById("final-resume-container");

// 1. Handle File Upload
uploadInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    statusIndicator.innerText = "Parsing PDF & Initializing Agent...";
    showLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: "POST",
            body: formData
        });
        
        const data = await response.json();
        
        if (data.status === "success") {
            currentSessionId = data.session_id;
            
            // Update UI state
            uploadContainer.innerHTML = `<h2 class="text-xl font-bold text-green-400">✓ Resume Uploaded</h2><p class="text-sm text-gray-400 mt-2">${file.name}</p>`;
            statusIndicator.innerText = "Interview in Progress";
            
            // Enable chat
            userInput.disabled = false;
            sendBtn.disabled = false;
            userInput.focus();

            // Clear chat and show first agent message
            chatBox.innerHTML = "";
            appendMessage("BEACON", data.agent_message);
        } else {
            alert("Failed to initialize agent.");
        }
    } catch (error) {
        console.error("Upload Error:", error);
        alert("Server error during upload.");
    } finally {
        showLoading(false);
    }
});

// 2. Handle Chat Messages
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text || !currentSessionId) return;

    // Display user message
    appendMessage("You", text);
    userInput.value = "";
    
    // Disable inputs while waiting
    userInput.disabled = true;
    sendBtn.disabled = true;
    showLoading(true);
    statusIndicator.innerText = "Agent is reasoning...";

    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                session_id: currentSessionId,
                user_answer: text
            })
        });

        const data = await response.json();

        if (data.status === "interviewing") {
            // Display next question
            appendMessage("BEACON", data.agent_message);
            statusIndicator.innerText = "Interview in Progress";
            userInput.disabled = false;
            sendBtn.disabled = false;
            userInput.focus();
            
        } else if (data.status === "complete") {
            // The interview is over, render the final resume
            statusIndicator.innerText = "Resume Optimization Complete ✓";
            appendMessage("BEACON", "We are done! I have drafted your final, optimized resume based on our conversation. Check the left panel.");
            
            // Hide upload box, show markdown renderer
            uploadContainer.classList.add("hidden");
            finalResumeContainer.classList.remove("hidden");
            
            // Use marked.js (loaded via CDN in index.html) to render the markdown
            finalResumeContainer.innerHTML = marked.parse(data.final_resume);
            
            // Keep inputs disabled
            userInput.placeholder = "Interview Complete.";
        }

    } catch (error) {
        console.error("Chat Error:", error);
        appendMessage("System", "Failed to connect to the agent server.");
        userInput.disabled = false;
        sendBtn.disabled = false;
    } finally {
        showLoading(false);
    }
}

// 3. UI Helper Functions
function appendMessage(sender, message) {
    const isAgent = sender === "BEACON";
    const bgClass = isAgent ? "bg-gray-800 border-gray-700" : "bg-blue-900 border-blue-700";
    const alignClass = isAgent ? "text-left" : "text-right ml-auto";
    const icon = isAgent ? "⛵" : "👤";
    
    const msgDiv = document.createElement("div");
    msgDiv.className = `max-w-[80%] rounded-xl p-4 border ${bgClass} ${alignClass} mb-4`;
    
    // Simple bolding for markdown-style headers the LLM might return
    const formattedMessage = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    msgDiv.innerHTML = `
        <div class="text-xs text-gray-400 mb-1 font-semibold tracking-wider">${icon} ${sender}</div>
        <div class="text-sm leading-relaxed">${formattedMessage}</div>
    `;
    
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function showLoading(show) {
    if (show) {
        loadingOverlay.classList.remove("hidden");
    } else {
        loadingOverlay.classList.add("hidden");
    }
}

// Handle Enter key in input
userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !userInput.disabled) {
        sendMessage();
    }
});

// Handle Send button click
sendBtn.addEventListener("click", sendMessage);