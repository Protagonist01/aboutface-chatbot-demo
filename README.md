# ✦ about-face cosmetics RAG Chatbot ✦

An immersive, high-performance Retrieval-Augmented Generation (RAG) chatbot (codenamed **"the muse"**) designed for **about-face cosmetics**—the bold, clean, vegan, and cruelty-free makeup brand founded by **Halsey**. 

"the muse" is a bespoke digital companion that helps users break beauty boundaries, explore the product line, discover shade matches, review shipping/return policies, and receive professional application tips—all packaged inside a sleek, on-brand interface matching about-face's distinct visual identity.

---

## 🎨 Visual Identity & Aesthetic

The chatbot interface is styled according to the about-face brand guidelines:
*   **Color Palette**: High-contrast dark theme powered by deep charcoal/blacks, clean whites, and the signature brand accent: **Neon Green (`#00FF01`)**.
*   **Typography**: Clean sans-serif headings (**Gothic A1**) paired with developer-chic accents (**Space Mono**) for a raw, artist-driven feel.
*   **Micro-interactions**: Seamless slide-in animations, an attention-grabber indicator, interactive quick-suggestion chips, and dynamic scroll control.
*   **Tone**: Confident, inclusive, lowercase, and artistic—acting as a knowledgeable friend rather than a corporate assistant.

---

## 🛠️ Technology Stack

### Backend & RAG Pipeline
*   **Runtime**: Node.js (ES Modules, `"type": "module"`)
*   **API Framework**: Express
*   **Vector Database**: Pinecone
*   **LLM Provider**: OpenAI API
    *   **Embeddings**: `text-embedding-3-small` (512 dimensions)
    *   **Chat Generation**: `gpt-4o-mini` (temperature: `0.7` for creative but grounded answers)

### Frontend
*   **Core**: Vanilla HTML5 / JavaScript (ES6)
*   **Styles**: Raw CSS3 using dynamic variables and modern flexbox/grid layouts

### Deployment
*   **Hosting**: Pre-configured for serverless execution on **Vercel** (`vercel.json`)

---

## 🧠 System Architecture

The chatbot utilizes a standard RAG pipeline to ensure that all generated answers are strictly grounded in official brand data.

```mermaid
graph TD
    A[User Input] --> B[openai.embeddings.create]
    B -->|512-dim Vector| C[Pinecone Index Query]
    C -->|Top 5 Chunks, Score >= 0.3| D[Context Construction]
    D --> E[System Prompt + Context + Chat History]
    E --> F[openai.chat.completions.create]
    F -->|On-brand Lowercase Response| G[User Interface]
```

1.  **Ingestion & Seeding (`seed-knowledge.js`)**: 
    Reads the markdown-formatted [about-face-knowledge-base.md](./about-face-knowledge-base.md), splits it intelligently by headers into contextually cohesive chunks, assigns categories (e.g., `products`, `shipping`, `tips`), requests OpenAI embeddings, and upserts them to Pinecone.
2.  **Retrieval (`rag-engine.js`)**: 
    Translates user query into a vector, queries the Pinecone vector index (filtered by the `knowledge-base` namespace), filters out low-relevance results (cutoff `score < 0.3`), and builds a context prompt.
3.  **Generation**:
    Injects context and recent conversation history (last 6 turns) into the custom system prompt configured with the brand's lowercase, welcoming persona.

---

## 📂 Project Structure

```
about-face-chatbot/
├── .env.example                # Template for environment credentials
├── .gitignore                  # Git exclusions (node_modules, .env, logs)
├── about-face-knowledge-base.md # Core source document for RAG data
├── api/
│   └── index.js                # Serverless function entrypoint for Vercel
├── dl.mjs                      # Image downloader configuration
├── download_images.js          # Helper script for fetching demo media assets
├── download_images.ps1         # PowerShell variant of the image downloader
├── package.json                # Project dependencies and run scripts
├── rag-engine.js               # Embedding, Pinecone querying, and OpenAI generation logic
├── seed-knowledge.js           # Knowledge base parsing, chunking, and database seeding script
├── server.js                   # Express application serving frontend & API endpoint
├── vercel.json                 # Vercel rewrite configuration
└── public/                     # Static frontend assets
    ├── index.html              # Main application markup & chat UI shell
    ├── styles.css              # Custom brand-aligned stylesheets
    ├── app.js                  # Frontend controller (state, UI interactions, API)
    └── images/                 # Image assets (hero visual & textures)
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended). You will also need:
*   An **OpenAI API Key**
*   A **Pinecone API Key** and a Pinecone Index (with 512 dimensions, cosine similarity metric)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/Protagonist01/aboutface-chatbot-demo.git
cd aboutface-chatbot-demo
npm install
```

### 3. Environment Setup
Copy the template `.env.example` file and populate it with your API keys:
```bash
cp .env.example .env
```
Open `.env` and fill in the values:
```env
OPENAI_API_KEY=your-openai-api-key
OPENROUTER_API_KEY=your-openrouter-api-key
CHAT_MODEL=google/gemma-4-31b-it:free
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=about-face-kb
MAX_MESSAGE_LENGTH=800
IP_RATE_LIMIT_MAX_REQUESTS=8
DAILY_GLOBAL_REQUEST_LIMIT=250
PORT=3000
```

`OPENROUTER_API_KEY` is used for chat generation when present. `OPENAI_API_KEY`
is still required for query embeddings unless you replace the embedding pipeline,
because Pinecone search depends on vectors generated with `text-embedding-3-small`.
OpenRouter free model availability can change, so update `CHAT_MODEL` with any
current `:free` model from OpenRouter if the default is unavailable.

The public demo includes basic abuse controls:
*   `MAX_MESSAGE_LENGTH`: rejects long prompts before any model call.
*   `IP_RATE_LIMIT_MAX_REQUESTS` + `IP_RATE_LIMIT_WINDOW_MS`: caps bursts per IP.
*   `DAILY_GLOBAL_REQUEST_LIMIT`: caps total daily chat requests per running server instance.
*   `MAX_OUTPUT_TOKENS`: caps response size.

For production-grade daily limits on Vercel/serverless, use a shared store such
as Upstash Redis or Vercel KV. In-memory counters reset when a serverless
instance restarts or when traffic is split across multiple instances.

### 4. Database Seeding
To parse your knowledge base markdown file, generate vector embeddings, and populate your Pinecone Index, run the seeding script:
```bash
npm run seed
```

### 5. Running the Application
Launch the dev server with hot-reload enabled:
```bash
npm run dev
```
Open your browser and navigate to: **`http://localhost:3000`**

---

## 🔌 API Documentation

### POST `/api/chat`
Endpoint to process chat messages using the RAG pipeline.

*   **Request Body**:
    ```json
    {
      "message": "how much is the matte fluid eye paint?",
      "history": [
        { "role": "user", "content": "hello" },
        { "role": "assistant", "content": "hey ✦ welcome to about-face." }
      ]
    }
    ```
*   **Success Response** (200 OK):
    ```json
    {
      "reply": "our matte fluid eye paint is $18. it's a powerful, one-swipe liquid eye color with bold, buildable pigment that dries down to a no-budge matte finish. 💚"
    }
    ```

### GET `/api/health`
Simple check for service status and uptime.
*   **Success Response** (200 OK):
    ```json
    {
      "status": "ok",
      "timestamp": "2026-06-23T14:30:00.000Z"
    }
    ```

---

## 🛫 Deployment

The project is optimized for deployment on [Vercel](https://vercel.com/):

1.  Connect your repository to Vercel.
2.  Configure your environment variables (`OPENAI_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`) in the Vercel Dashboard.
3.  Deploy! Vercel will build the frontend assets and host the Express routes serverlessly via the `/api/index.js` bridge.

---

## 💚 License
This project is licensed under the [ISC License](package.json).
