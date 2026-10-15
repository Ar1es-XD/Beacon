// script.js — BEACON Agentic AI Resume Architect Frontend
// Built following Apple Design Principles & WWDC Fluid Interface Foundations

(function () {
  "use strict";

  // -------------------------------------------------------------
  // Configuration & State
  // -------------------------------------------------------------
  const API_BASE_URL = (function () {
    if (
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
      window.location.port !== "8000"
    ) {
      return "http://localhost:8000/api";
    }
    if (window.location.protocol.startsWith("http")) {
      return `${window.location.origin}/api`;
    }
    return "http://localhost:8000/api";
  })();

  let isDemoMode = false;
  let currentSessionId = null;
  let currentStage = "INGESTION";
  let currentParsedState = null;
  let chatHistory = [];
  let isWaitingForAgent = false;
  let demoStepIndex = 0;

  // -------------------------------------------------------------
  // Built-in Demo Data (Matches bundled sample_resume & optimized_resume)
  // -------------------------------------------------------------
  const DEMO_RESUME_STATE = {
    full_name: "Beacon Sangu",
    email: "sangu.h.y@example.com",
    social_links: ["youtube.com/WealthAndWisdom"],
    skills: [
      "Content Strategy",
      "Affiliate Marketing",
      "Vertical Video Production (9:16)",
      "Financial Analysis",
      "Systematic Investment Planning (SIP)",
      "UGC Creation",
      "Brand Identity Design"
    ],
    work_experience: [
      {
        company: "WEALTH & WISDOM",
        role: "Channel Founder & Lead Creator",
        duration: "Jan 2024 - Present",
        highlights: [
          "Produced and edited vertical 9:16 User Generated Content (UGC) for Instagram Reels and YouTube Shorts.",
          "Executed affiliate marketing campaigns via Cuelinks, managing live campaign statuses and driving product conversions.",
          "Maintained strict brand design language, including a gold owl logo and high-contrast focused textual design."
        ],
        impact_metrics: []
      },
      {
        company: "Independent Creator & Consultant",
        role: "UGC Fashion & Beauty Evaluator",
        duration: "Feb 2024 - Present",
        highlights: [
          "Sourced and reviewed fashion apparel (AJIO) and personal care items (Nykaa, mCaffeine, Sanfe) to create authentic consumer review sets.",
          "Directed short-form video sequences showcasing sets of four to five dresses, ensuring original patterns remained visually unaltered in post-production."
        ],
        impact_metrics: []
      }
    ],
    projects: [
      {
        title: "Portfolio & Wealth Management Strategy",
        tech_stack: ["Paytm Money", "SIP Analysis", "Risk Profiling"],
        description: "Managed an ongoing investment portfolio utilizing Systematic Investment Plans (SIPs) in small-cap mutual funds across Nippon India and Tata Mutual Funds.",
        metrics_or_outcome: "Maintained monthly unit allotments and tracked annual income updates."
      }
    ],
    education: [
      {
        institution: "Bhagwan Bhudha Homoeopathic Medical College",
        degree: "Bachelor of Homeopathic Medicine and Surgery (BHMS)",
        year_or_duration: "2021 – 2026 (Expected)"
      }
    ]
  };

  const DEMO_OPTIMIZED_MARKDOWN = `# BEACON SANGU
sangu.h.y@example.com | [youtube.com/WealthAndWisdom](https://youtube.com/WealthAndWisdom) | Bangalore, India | +91 98765 43210

---

## SKILLS

- **Content Creation & Strategy:** Vertical Video Production (9:16), Content Strategy, User Generated Content (UGC), Video Editing
- **Digital Marketing & Growth:** Affiliate Marketing (Cuelinks), Conversion Rate Optimization (12% CRO), A/B Testing
- **Financial Analysis:** Systematic Investment Planning (SIP), Portfolio Strategy, Risk Assessment

---

## WORK EXPERIENCE

### **WEALTH & WISDOM** | Channel Founder & Lead Creator
*Jan 2024 – Present*

- **Scaled YouTube and Reels audience to 50,000+ active subscribers** within 8 months via structured 9:16 short-form educational formats.
- **Drove a consistent 12% conversion rate** across Cuelinks affiliate campaigns, outperforming industry median conversion by 2.4x.
- **Architected and standardized brand visual language**, achieving 68% viewer retention through high-contrast textual hooks.

### **Independent Creator & Consultant** | UGC Fashion & Beauty Evaluator
*Feb 2024 – Present*

- **Directed and evaluated 40+ consumer-focused product campaigns** for premier brands including AJIO, Nykaa, and mCaffeine.
- **Achieved 94% sponsor re-engagement rate** through meticulous post-production fidelity and objective consumer testing.

---

## PROJECTS

### **Portfolio & Wealth Management Strategy**
*Tools & Concepts: Paytm Money, SIP Analysis, Financial Planning*

- **Managed and optimized an active investment portfolio** deploying capital across small-cap mutual funds (Nippon India, Tata Mutual).
- **Automated monthly unit allotment tracking** and yield modeling, generating an annualized IRR exceeding the benchmark index.

---

## EDUCATION

**Bhagwan Bhudha Homoeopathic Medical College**  
*Bachelor of Homeopathic Medicine and Surgery (BHMS)* | 2021 – 2026`;

  // -------------------------------------------------------------
  // DOM Elements
  // -------------------------------------------------------------
  const dropzone = document.getElementById("dropzone");
  const resumeUploadInput = document.getElementById("resume-upload");
  const browseBtn = document.getElementById("browse-btn");
  const loadSampleBtn = document.getElementById("load-sample-btn");
  const uploadCardWrapper = document.getElementById("upload-card-wrapper");
  const parsedProfileWrapper = document.getElementById("parsed-profile-wrapper");

  // Chat Elements
  const chatFeed = document.getElementById("chat-feed");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const suggestionsBar = document.getElementById("suggestions-bar");
  const sessionIdDisplay = document.getElementById("session-id-display");

  // Header & Controls
  const modeToggleBtn = document.getElementById("mode-toggle-btn");
  const modeIcon = document.getElementById("mode-icon");
  const modeLabel = document.getElementById("mode-label");
  const statusPill = document.getElementById("status-pill");
  const statusText = document.getElementById("status-text");
  const resetBtn = document.getElementById("reset-btn");
  const infoModalBtn = document.getElementById("info-modal-btn");
  const infoModal = document.getElementById("info-modal");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const modalOkBtn = document.getElementById("modal-ok-btn");
  const fileIndicator = document.getElementById("file-indicator");
  const fileIndicatorName = document.getElementById("file-indicator-name");

  // Banner
  const rateLimitBanner = document.getElementById("rate-limit-banner");
  const rateLimitMessage = document.getElementById("rate-limit-message");
  const switchToDemoBtn = document.getElementById("switch-to-demo-btn");
  const dismissBannerBtn = document.getElementById("dismiss-banner-btn");

  // Pipeline Stepper Steps
  const stepIngest = document.getElementById("step-ingest");
  const stepValidation = document.getElementById("step-validation");
  const stepDeepdive = document.getElementById("step-deepdive");
  const stepBehavioral = document.getElementById("step-behavioral");
  const stepDrafting = document.getElementById("step-drafting");

  // Tabs & Views
  const tabDocBtn = document.getElementById("tab-doc-btn");
  const tabResumeBtn = document.getElementById("tab-resume-btn");
  const tabJsonBtn = document.getElementById("tab-json-btn");
  const viewDocument = document.getElementById("view-document");
  const viewFinalResume = document.getElementById("view-final-resume");
  const viewRawJson = document.getElementById("view-raw-json");
  const finalBadge = document.getElementById("final-badge");

  // Parsed Profile Elements
  const candAvatar = document.getElementById("cand-avatar");
  const candName = document.getElementById("cand-name");
  const candEmail = document.getElementById("cand-email");
  const candLinksWrapper = document.getElementById("cand-links-wrapper");
  const skillsCloud = document.getElementById("skills-cloud");
  const skillCount = document.getElementById("skill-count");
  const experienceList = document.getElementById("experience-list");
  const projectsCard = document.getElementById("projects-card");
  const projectsList = document.getElementById("projects-list");
  const educationCard = document.getElementById("education-card");
  const educationList = document.getElementById("education-list");
  const jsonStateViewer = document.getElementById("json-state-viewer");
  const ragRubricText = document.getElementById("rag-rubric-text");

  // Resume Viewer Elements
  const resumePaper = document.getElementById("resume-paper");
  const resumeRaw = document.getElementById("resume-raw");
  const copyMarkdownBtn = document.getElementById("copy-markdown-btn");
  const downloadMdBtn = document.getElementById("download-md-btn");
  const printResumeBtn = document.getElementById("print-resume-btn");
  const toggleRawResumeBtn = document.getElementById("toggle-raw-resume-btn");
  const toggleRawLabel = document.getElementById("toggle-raw-label");
  const copyJsonBtn = document.getElementById("copy-json-btn");
  const toastContainer = document.getElementById("toast-container");

  let finalResumeMarkdown = "";
  let isRawView = false;

  // -------------------------------------------------------------
  // Mode Switcher (Live Agent vs Instant Demo)
  // -------------------------------------------------------------
  function setMode(demo) {
    isDemoMode = demo;
    if (isDemoMode) {
      modeIcon.innerText = "🚀";
      modeLabel.innerText = "Demo Mode";
      modeToggleBtn.style.borderColor = "var(--accent-amber)";
      statusPill.className = "status-pill";
      statusText.innerText = "Demo Ready (Instant)";
      showToast("Switched to Instant Demo Mode (No API quota limits)", "🚀");
    } else {
      modeIcon.innerText = "⚡";
      modeLabel.innerText = "Live Agent";
      modeToggleBtn.style.borderColor = "var(--border-subtle)";
      checkBackendHealth();
      showToast("Switched to Live Agent (Gemini 3.6 Flash)", "⚡");
    }
  }

  modeToggleBtn.addEventListener("click", () => {
    setMode(!isDemoMode);
  });

  switchToDemoBtn.addEventListener("click", () => {
    rateLimitBanner.style.display = "none";
    setMode(true);
    if (!currentParsedState) {
      loadSampleBtn.click();
    }
  });

  dismissBannerBtn.addEventListener("click", () => {
    rateLimitBanner.style.display = "none";
  });

  // -------------------------------------------------------------
  // Backend Health Check
  // -------------------------------------------------------------
  async function checkBackendHealth() {
    if (isDemoMode) return;
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        statusPill.className = "status-pill";
        statusText.innerText = data.has_gemini_key ? "Gemini 3.6 Online" : "Gemini Key Missing";
        return true;
      } else {
        statusPill.className = "status-pill offline";
        statusText.innerText = `Backend Error (${res.status})`;
        return false;
      }
    } catch (err) {
      statusPill.className = "status-pill offline";
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      statusText.innerText = isLocal ? "Backend Offline (:8000)" : "Backend Offline";
      if (window.location.protocol === "file:") {
        showToast("Open http://localhost:8000 in browser for backend access", "⚠️");
      }
      return false;
    }
  }
  checkBackendHealth();
  setInterval(checkBackendHealth, 30000);
  statusPill.addEventListener("click", () => {
    statusText.innerText = "Checking...";
    checkBackendHealth();
  });

  // -------------------------------------------------------------
  // Toast Notifications
  // -------------------------------------------------------------
  function showToast(message, icon = "ℹ️") {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = `${icon} ${message}`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px) scale(0.95)";
      toast.style.transition = "all 200ms ease";
      setTimeout(() => toast.remove(), 220);
    }, 3200);
  }

  // -------------------------------------------------------------
  // Tab Switching
  // -------------------------------------------------------------
  const tabs = [
    { btn: tabDocBtn, view: viewDocument },
    { btn: tabResumeBtn, view: viewFinalResume },
    { btn: tabJsonBtn, view: viewRawJson }
  ];

  tabs.forEach(({ btn, view }) => {
    btn.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.btn.classList.remove("active");
        t.view.classList.add("hidden");
        t.view.style.display = "none";
      });
      btn.classList.add("active");
      view.classList.remove("hidden");
      view.style.display = view === viewDocument || view === viewFinalResume ? "flex" : "block";
    });
  });

  // -------------------------------------------------------------
  // Stage Stepper Updates
  // -------------------------------------------------------------
  const stages = [
    { name: "INGESTION", el: stepIngest },
    { name: "VALIDATION", el: stepValidation },
    { name: "DEEP_DIVE", el: stepDeepdive },
    { name: "BEHAVIORAL", el: stepBehavioral },
    { name: "DRAFTING", el: stepDrafting }
  ];

  function setStage(stageName) {
    currentStage = stageName || "INGESTION";
    let activeFound = false;

    stages.forEach((stage) => {
      stage.el.classList.remove("active", "completed");
      if (stage.name === currentStage) {
        stage.el.classList.add("active");
        activeFound = true;
      } else if (!activeFound) {
        stage.el.classList.add("completed");
      }
    });
  }

  // -------------------------------------------------------------
  // Drag & Drop / File Upload Handlers
  // -------------------------------------------------------------
  browseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resumeUploadInput.click();
  });

  dropzone.addEventListener("click", () => {
    resumeUploadInput.click();
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add("drag-active");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("drag-active");
    });
  });

  dropzone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  resumeUploadInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  // -------------------------------------------------------------
  // Core Upload Flow
  // -------------------------------------------------------------
  async function handleFileUpload(file) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Please select a valid PDF file", "⚠️");
      return;
    }
    setWorkingState(true, "Extracting PDF & Initializing Agent...");
    fileIndicator.classList.remove("hidden");
    fileIndicatorName.innerText = file.name;

    if (isDemoMode) {
      setTimeout(() => {
        setWorkingState(false);
        onSessionInitialized({
          status: "success",
          session_id: "demo_user",
          stage: "VALIDATION",
          parsed_state: JSON.parse(JSON.stringify(DEMO_RESUME_STATE)),
          agent_message: `Hi there! I parsed **${file.name}** and verified your YouTube profile. To ensure your resume contact header and education sections are pristine, could you confirm your expected graduation year and current location?`
        }, file.name);
      }, 700);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      if (response.ok && data.status === "success") {
        onSessionInitialized(data, file.name);
      } else {
        throw new Error(data.message || data.error || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      showToast(err.message || "Failed to parse resume.", "❌");
      handleApiError(err);
    } finally {
      setWorkingState(false);
    }
  }

  // Sample Resume Quick Launcher
  loadSampleBtn.addEventListener("click", async () => {
    setWorkingState(true, "Parsing sample resume with Gemini...");
    fileIndicator.classList.remove("hidden");
    fileIndicatorName.innerText = "sample_resume.pdf";

    if (isDemoMode) {
      setTimeout(() => {
        setWorkingState(false);
        onSessionInitialized({
          status: "success",
          session_id: "demo_user",
          stage: "VALIDATION",
          parsed_state: JSON.parse(JSON.stringify(DEMO_RESUME_STATE)),
          agent_message: `Hi there! Thanks for sharing your details. I verified your YouTube link (**Wealth and Wisdom**)—it looks great.\n\nTo make sure your contact and education sections are complete and professional:\n1. **Education Dates:** What is your expected graduation year for your BHMS degree?\n2. **Location & Contact:** Where are you currently located (City, Country)?`
        }, "sample_resume.pdf");
      }, 500);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/sample`, {
        method: "POST"
      });

      const data = await response.json();
      if (response.ok && data.status === "success") {
        onSessionInitialized(data, "sample_resume.pdf");
      } else {
        throw new Error(data.message || data.error || "Sample load failed");
      }
    } catch (err) {
      console.error("Sample error:", err);
      showToast(err.message || "Failed to load sample resume.", "❌");
      handleApiError(err);
    } finally {
      setWorkingState(false);
    }
  });

  // -------------------------------------------------------------
  // Session Initialized Callback
  // -------------------------------------------------------------
  function onSessionInitialized(data, filename) {
    currentSessionId = data.session_id || "user_123";
    sessionIdDisplay.innerText = `Session: ${currentSessionId}`;
    setStage(data.stage || "VALIDATION");
    demoStepIndex = 1;
    chatHistory = data.chat_history || (data.agent_message ? [{ role: "agent", content: data.agent_message }] : []);

    // Switch Left Panel View to Parsed Profile
    uploadCardWrapper.classList.add("hidden");
    uploadCardWrapper.style.display = "none";
    parsedProfileWrapper.classList.remove("hidden");
    parsedProfileWrapper.style.display = "flex";

    // Update Profile View & Agent State Viewer
    if (data.parsed_state) {
      renderParsedProfile(data.parsed_state);
    }

    // Enable chat input
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.placeholder = "Type your answer or select a quick response...";
    userInput.focus();

    // Sound and Toast
    showToast(`Parsed ${filename} successfully!`, "✅");

    // Display Agent's First Question
    appendAgentMessage(data.agent_message || "Resume loaded. Let's begin the interview.");
  }

  // -------------------------------------------------------------
  // Render Structured Profile State
  // -------------------------------------------------------------
  function renderParsedProfile(state) {
    currentParsedState = state;
    jsonStateViewer.textContent = JSON.stringify(state, null, 2);

    // Candidate Header
    const name = state.full_name || "Candidate";
    candName.innerText = name;
    candEmail.innerText = state.email || "No email detected";
    candAvatar.innerText = name.charAt(0).toUpperCase();

    // Social Links
    candLinksWrapper.innerHTML = "";
    if (state.social_links && state.social_links.length > 0) {
      state.social_links.forEach((link) => {
        const a = document.createElement("a");
        a.href = link.startsWith("http") ? link : `https://${link}`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "skill-tag";
        a.style.display = "inline-flex";
        a.style.alignItems = "center";
        a.style.gap = "4px";
        a.innerHTML = `🔗 ${link.replace(/^https?:\/\/(www\.)?/, "")}`;
        candLinksWrapper.appendChild(a);
      });
    }

    // Skills Cloud
    skillsCloud.innerHTML = "";
    const skills = state.skills || [];
    skillCount.innerText = `${skills.length} skills`;
    skills.forEach((skill) => {
      const span = document.createElement("span");
      span.className = "skill-tag";
      span.innerText = skill;
      skillsCloud.appendChild(span);
    });

    // Work Experience & Impact Metrics
    experienceList.innerHTML = "";
    const workExps = state.work_experience || [];
    if (workExps.length === 0) {
      experienceList.innerHTML = `<p style="font-size: 0.78rem; color: var(--text-muted); font-style: italic;">No work experience listed.</p>`;
    } else {
      workExps.forEach((exp) => {
        const item = document.createElement("div");
        item.className = "experience-item";

        let metricsHtml = "";
        if (exp.impact_metrics && exp.impact_metrics.length > 0) {
          metricsHtml = `
            <div class="metric-badge-list">
              <span style="font-size: 0.68rem; color: var(--accent-emerald); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                ✨ Quantified Impact Metrics:
              </span>
              ${exp.impact_metrics
                .map((m) => `<div class="metric-pill"><span>📈</span><span>${escapeHtml(m)}</span></div>`)
                .join("")}
            </div>
          `;
        }

        item.innerHTML = `
          <div class="title-row">
            <span class="role-name">${escapeHtml(exp.role || "Role")}</span>
            <span class="duration">${escapeHtml(exp.duration || "")}</span>
          </div>
          <div class="company-name">🏢 ${escapeHtml(exp.company || "Organization")}</div>
          <ul style="padding-left: 1.1rem; font-size: 0.78rem; color: var(--text-secondary); line-height: 1.45;">
            ${(exp.highlights || [])
              .map((h) => `<li>${escapeHtml(h)}</li>`)
              .join("")}
          </ul>
          ${metricsHtml}
        `;
        experienceList.appendChild(item);
      });
    }

    // Projects
    projectsList.innerHTML = "";
    const projects = state.projects || [];
    if (projects.length === 0) {
      projectsCard.style.display = "none";
    } else {
      projectsCard.style.display = "block";
      projects.forEach((proj) => {
        const item = document.createElement("div");
        item.className = "experience-item";
        item.innerHTML = `
          <div class="title-row">
            <span class="role-name">🚀 ${escapeHtml(proj.title || "Project")}</span>
          </div>
          <p style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 0.35rem;">
            ${escapeHtml(proj.description || "")}
          </p>
          <div class="tag-cloud">
            ${(proj.tech_stack || []).map((t) => `<span class="skill-tag" style="font-size: 0.68rem;">${escapeHtml(t)}</span>`).join("")}
          </div>
        `;
        projectsList.appendChild(item);
      });
    }

    // Education
    educationList.innerHTML = "";
    const education = state.education || [];
    if (education.length === 0) {
      educationCard.style.display = "none";
    } else {
      educationCard.style.display = "block";
      education.forEach((edu) => {
        const item = document.createElement("div");
        item.className = "experience-item";
        item.innerHTML = `
          <div class="title-row">
            <span class="role-name">${escapeHtml(edu.degree || "Degree")}</span>
            <span class="duration">${escapeHtml(edu.year_or_duration || "")}</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-secondary);">🏛️ ${escapeHtml(edu.institution || "")}</div>
        `;
        educationList.appendChild(item);
      });
    }
  }

  // -------------------------------------------------------------
  // Chat Interaction Loop
  // -------------------------------------------------------------
  async function sendMessage(textToSend) {
    const text = (textToSend || userInput.value).trim();
    if (!text || isWaitingForAgent) return;
    if (!currentSessionId) {
      showToast("Please upload a resume first", "⚠️");
      return;
    }
    appendUserMessage(text);
    userInput.value = "";
    resizeTextarea();

    setWaitingState(true);

    if (isDemoMode) {
      handleDemoChatResponse(text);
      return;
    }

    try {
      chatHistory.push({ role: "user", content: text });
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: currentSessionId,
          user_answer: text,
          current_state: currentParsedState,
          current_stage: currentStage,
          chat_history: chatHistory
        })
      });

      const data = await response.json();
      if (!response.ok) {
        if (response.status === 429) {
          triggerRateLimitCooldown(30);
          throw new Error("Gemini free tier rate limit reached (5 req/min). Please wait a few seconds or switch to Instant Demo Mode.");
        }
        throw new Error(data.message || data.error || "Interview request failed");
      }

      if (data.chat_history) {
        chatHistory = data.chat_history;
      } else if (data.agent_message) {
        chatHistory.push({ role: "agent", content: data.agent_message });
      }

      if (data.parsed_state) {
        renderParsedProfile(data.parsed_state);
      }
      if (data.stage) {
        setStage(data.stage);
      }

      if (data.status === "complete") {
        onInterviewCompleted(data.final_resume);
      } else {
        appendAgentMessage(data.agent_message);
      }
    } catch (err) {
      console.error("Chat error:", err);
      showToast(err.message || "Communication error", "❌");
      handleApiError(err);
    } finally {
      setWaitingState(false);
    }
  }

  // -------------------------------------------------------------
  // Interactive Demo Chat Simulation
  // -------------------------------------------------------------
  function handleDemoChatResponse(userText) {
    demoStepIndex++;
    setTimeout(() => {
      setWaitingState(false);

      if (demoStepIndex === 2) {
        // Stage 3: Deep Dive
        setStage("DEEP_DIVE");
        // Patch state with new metric
        if (currentParsedState && currentParsedState.work_experience && currentParsedState.work_experience[0]) {
          currentParsedState.work_experience[0].impact_metrics = [
            "Scaled YouTube and Reels audience to 50,000+ active subscribers through optimized 9:16 vertical storytelling."
          ];
          renderParsedProfile(currentParsedState);
          showToast("Extracted new impact metric!", "✨");
        }
        appendAgentMessage(
          `Great detail! I've updated your education dates (2021 – 2026) and contact header.\n\n` +
          `Now let's dive into **Wealth & Wisdom**: What were the measurable conversion rates or revenue outcomes from your Cuelinks affiliate marketing campaigns?`
        );
      } else if (demoStepIndex === 3) {
        // Stage 4: Behavioral
        setStage("BEHAVIORAL");
        if (currentParsedState && currentParsedState.work_experience && currentParsedState.work_experience[0]) {
          currentParsedState.work_experience[0].impact_metrics.push(
            "Consistently drove a 12% conversion rate on affiliate campaigns via real-time Cuelinks performance tracking."
          );
          renderParsedProfile(currentParsedState);
          showToast("Patched affiliate metric into memory!", "✨");
        }
        appendAgentMessage(
          `Outstanding. A 12% conversion rate is exceptional for affiliate UGC.\n\n` +
          `Moving to **Leadership & Process**: How did you handle tight sponsor deadlines while ensuring multi-dress sequence quality remained uncompromised?`
        );
      } else if (demoStepIndex === 4) {
        // Stage 5: Clarification
        setStage("CLARIFICATION");
        appendAgentMessage(
          `Perfect. We now have verified achievements, strong action verbs, and clear quantifiable impact.\n\n` +
          `Before I synthesize everything into your final ATS-compliant resume, do you have any final certifications or portfolio additions? If you're ready, simply reply **"Proceed"**!`
        );
      } else {
        // Stage 6: Drafting & Completion!
        onInterviewCompleted(DEMO_OPTIMIZED_MARKDOWN);
      }
    }, 900);
  }

  function triggerRateLimitCooldown(seconds = 30) {
    rateLimitBanner.classList.remove("hidden");
    rateLimitBanner.style.display = "flex";

    let remaining = seconds;
    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        rateLimitMessage.innerText = "Quota cooldown elapsed. You can retry sending your answer now!";
      } else {
        rateLimitMessage.innerText = `Gemini API rate limit reached (5 req/min). Cooldown: ${remaining}s remaining... (or use Instant Demo Mode)`;
      }
    }, 1000);
  }

  function handleApiError(err) {
    const msg = err.message || "";
    if (msg.includes("rate limit") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
      triggerRateLimitCooldown(30);
    }
  }

  function onInterviewCompleted(markdownResume) {
    finalResumeMarkdown = markdownResume || DEMO_OPTIMIZED_MARKDOWN;
    setStage("DRAFTING");
    showToast("Resume optimization complete! ✨", "🎉");

    appendAgentMessage(
      `🎉 **Interview Complete!**\n\n` +
      `I have synthesized all your achievements, quantifiable impact metrics, and technical keywords into a clean, ATS-optimized Markdown resume.\n\n` +
      `👉 Switch to the **Final ATS Resume** tab on the left to copy or download it!`
    );

    renderMarkdownResume(finalResumeMarkdown);

    finalBadge.classList.remove("hidden");
    tabResumeBtn.click();

    userInput.disabled = true;
    sendBtn.disabled = true;
    userInput.placeholder = "Interview Complete. Resume drafted.";
  }

  function renderMarkdownResume(md) {
    resumeRaw.textContent = md;
    if (typeof marked !== "undefined" && marked.parse) {
      resumePaper.innerHTML = marked.parse(md);
    } else {
      resumePaper.innerHTML = simpleMarkdownParser(md);
    }
  }

  // -------------------------------------------------------------
  // Chat Bubble Appending & Formatting
  // -------------------------------------------------------------
  function appendAgentMessage(content) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble agent";

    const formatted = formatAgentText(content);
    bubble.innerHTML = `
      <div class="bubble-meta">
        <span>⛵ BEACON AGENT</span> · <span>${currentStage}</span>
      </div>
      <div class="bubble-body">${formatted}</div>
    `;

    chatFeed.appendChild(bubble);
    scrollChatToBottom();
  }

  function appendUserMessage(content) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble user";
    bubble.innerHTML = `
      <div class="bubble-meta">YOU</div>
      <div class="bubble-body">${escapeHtml(content).replace(/\n/g, "<br>")}</div>
    `;
    chatFeed.appendChild(bubble);
    scrollChatToBottom();
  }

  let reasoningCardEl = null;
  function setWaitingState(waiting) {
    isWaitingForAgent = waiting;
    userInput.disabled = waiting;
    sendBtn.disabled = waiting;

    if (waiting) {
      statusPill.className = "status-pill working";
      statusText.innerText = "Agent Reasoning...";

      if (!reasoningCardEl) {
        reasoningCardEl = document.createElement("div");
        reasoningCardEl.className = "reasoning-card";
        reasoningCardEl.innerHTML = `
          <div class="pulse-dots">
            <span></span><span></span><span></span>
          </div>
          <span>BEACON is analyzing context and evaluating ATS rubrics...</span>
        `;
        chatFeed.appendChild(reasoningCardEl);
        scrollChatToBottom();
      }
    } else {
      statusPill.className = "status-pill";
      statusText.innerText = isDemoMode ? "Demo Ready" : "Interview in Progress";
      if (reasoningCardEl) {
        reasoningCardEl.remove();
        reasoningCardEl = null;
      }
      userInput.focus();
    }
  }

  function setWorkingState(working, message) {
    if (working) {
      statusPill.className = "status-pill working";
      statusText.innerText = message || "Processing...";
    } else {
      statusPill.className = "status-pill";
      statusText.innerText = isDemoMode ? "Demo Ready" : "Backend Ready";
    }
  }

  function scrollChatToBottom() {
    chatFeed.scrollTo({
      top: chatFeed.scrollHeight,
      behavior: "smooth"
    });
  }

  // -------------------------------------------------------------
  // Textarea Auto-Resize & Shortcuts
  // -------------------------------------------------------------
  function resizeTextarea() {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
  }

  userInput.addEventListener("input", resizeTextarea);

  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener("click", () => sendMessage());

  suggestionsBar.addEventListener("click", (e) => {
    const chip = e.target.closest(".suggestion-chip");
    if (!chip) return;
    const text = chip.getAttribute("data-text");
    if (!text) return;
    userInput.value = text;
    resizeTextarea();
    userInput.focus();
  });

  // -------------------------------------------------------------
  // Resume Toolbar Actions
  // -------------------------------------------------------------
  copyMarkdownBtn.addEventListener("click", async () => {
    if (!finalResumeMarkdown) {
      showToast("No resume content to copy yet", "⚠️");
      return;
    }
    try {
      await navigator.clipboard.writeText(finalResumeMarkdown);
      showToast("Markdown copied to clipboard!", "📋");
    } catch (e) {
      showToast("Clipboard copy failed", "❌");
    }
  });

  downloadMdBtn.addEventListener("click", () => {
    if (!finalResumeMarkdown) {
      showToast("No resume content to download yet", "⚠️");
      return;
    }
    const blob = new Blob([finalResumeMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "optimized_resume.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded optimized_resume.md", "⬇️");
  });

  printResumeBtn.addEventListener("click", () => {
    if (!finalResumeMarkdown) {
      showToast("No resume drafted to print yet", "⚠️");
      return;
    }
    window.print();
  });

  toggleRawResumeBtn.addEventListener("click", () => {
    isRawView = !isRawView;
    if (isRawView) {
      resumePaper.style.display = "none";
      resumeRaw.classList.remove("hidden");
      resumeRaw.style.display = "block";
      toggleRawLabel.innerText = "Show Formatted Paper";
    } else {
      resumePaper.style.display = "block";
      resumeRaw.classList.add("hidden");
      resumeRaw.style.display = "none";
      toggleRawLabel.innerText = "Show Raw Source";
    }
  });

  copyJsonBtn.addEventListener("click", async () => {
    if (!currentParsedState) {
      showToast("No state loaded yet", "⚠️");
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(currentParsedState, null, 2));
      showToast("JSON state copied to clipboard!", "📋");
    } catch (e) {
      showToast("Copy failed", "❌");
    }
  });

  // -------------------------------------------------------------
  // Reset / New Session
  // -------------------------------------------------------------
  resetBtn.addEventListener("click", () => {
    if (confirm("Start a new BEACON session? Current conversation and state will be cleared.")) {
      currentSessionId = null;
      currentStage = "INGESTION";
      currentParsedState = null;
      chatHistory = [];
      finalResumeMarkdown = "";
      demoStepIndex = 0;

      uploadCardWrapper.classList.remove("hidden");
      uploadCardWrapper.style.display = "flex";
      parsedProfileWrapper.classList.add("hidden");
      parsedProfileWrapper.style.display = "none";

      fileIndicator.classList.add("hidden");
      sessionIdDisplay.innerText = "Session: None";
      setStage("INGESTION");

      resumePaper.innerHTML = `<p style="color: #64748b; font-style: italic; text-align: center; margin-top: 3rem;">The final ATS-optimized resume will be drafted once the interview is complete.</p>`;
      resumeRaw.textContent = "";
      jsonStateViewer.textContent = "";
      finalBadge.classList.add("hidden");

      chatFeed.innerHTML = `
        <div class="chat-bubble agent">
          <div class="bubble-meta">
            <span>⛵ BEACON AGENT</span> · <span>INTERVIEW COPILOT</span>
          </div>
          <div class="bubble-body">
            <p><strong>Session reset.</strong></p>
            <p style="margin-top: 0.35rem;">
              Upload your PDF resume or click <strong>✨ Load Sample</strong> to start a new interview session.
            </p>
          </div>
        </div>
      `;

      userInput.disabled = true;
      sendBtn.disabled = true;
      userInput.placeholder = "Upload a resume to begin the interview...";
      tabDocBtn.click();
      showToast("Session reset", "🔄");
    }
  });

  // -------------------------------------------------------------
  // Info Modal Handlers
  // -------------------------------------------------------------
  infoModalBtn.addEventListener("click", () => {
    infoModal.classList.remove("hidden");
    infoModal.style.display = "flex";
  });

  [closeModalBtn, modalOkBtn].forEach((btn) => {
    btn.addEventListener("click", () => {
      infoModal.classList.add("hidden");
      infoModal.style.display = "none";
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && infoModal.style.display === "flex") {
      infoModal.classList.add("hidden");
      infoModal.style.display = "none";
    }
  });

  // -------------------------------------------------------------
  // Helper Utilities
  // -------------------------------------------------------------
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatAgentText(text) {
    if (!text) return "";
    if (typeof marked !== "undefined" && marked.parseInline) {
      return marked.parse(text);
    }
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code style='background: rgba(255,255,255,0.1); padding: 1px 4px; border-radius: 4px;'>$1</code>")
      .replace(/\n\n/g, "</p><p style='margin-top: 0.5rem;'>")
      .replace(/\n/g, "<br>");
  }

  function simpleMarkdownParser(md) {
    return md
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      .replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>")
      .replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>")
      .replace(/\*(.*)\*/gim, "<em>$1</em>")
      .replace(/^\- (.*$)/gim, "<li>$1</li>")
      .replace(/\n\n/gim, "<p></p>")
      .replace(/\n/gim, "<br>");
  }
})();