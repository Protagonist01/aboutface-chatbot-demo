# about-face cosmetics RAG chatbot

An unofficial portfolio demo for about-face cosmetics. "the muse" answers product,
shade, shipping, returns, and brand questions from a curated knowledge base.

## RAG pipeline

1. `seed-knowledge.js` splits the knowledge base into atomic product, subsection,
   and FAQ records.
2. Pinecone embeds each record with `multilingual-e5-large`.
3. Each question retrieves 15 vector candidates and reranks the best 5 with
   `bge-reranker-v2-m3`.
4. The app sends only those records to a fixed OpenRouter model.
5. A strict JSON schema and response validator reject incomplete output or
   exposed model planning.
6. Pinecone and model failures use explicit fallbacks instead of choosing a
   random model.

The default model is `nvidia/nemotron-3-super-120b-a12b:free`. The named free
fallbacks are `google/gemma-4-26b-a4b-it:free` and
`qwen/qwen3-next-80b-a3b-instruct:free`.

## Setup

Requirements: Node.js 18+, an OpenRouter API key, and a Pinecone API key.

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm test
npm run evaluate
```

`npm test` checks atomic chunking, local retrieval, and generated-response
validation. `npm run evaluate` checks live Pinecone retrieval across product,
brand, shade, shopping, shipping, returns, promotions, and support questions.

## Main environment variables

```env
OPENROUTER_API_KEY=your-openrouter-api-key
CHAT_MODEL=nvidia/nemotron-3-super-120b-a12b:free
CHAT_FALLBACK_MODELS=google/gemma-4-26b-a4b-it:free,qwen/qwen3-next-80b-a3b-instruct:free
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=about-face-kb
PINECONE_EMBEDDING_MODEL=multilingual-e5-large
PINECONE_CANDIDATE_K=15
PINECONE_TOP_K=5
PINECONE_RERANK_MODEL=bge-reranker-v2-m3
```

See `.env.example` for the response, history, and basic abuse-control settings.
The in-memory request counters are suitable for a demo, but a public production
deployment should use a shared rate-limit store such as Vercel KV or Upstash.

## API

`POST /api/chat`

```json
{
  "message": "what are the best sellers?",
  "history": []
}
```

```json
{
  "reply": "matte fluid eye paint is the award-winning fan favorite."
}
```

`GET /api/health` returns the server status and timestamp.

## Deployment

The repository includes `vercel.json`. Add the variables from `.env.example` to
the Vercel project, seed Pinecone once, and deploy the repository.

This project is an unofficial demonstration and is not affiliated with
about-face or Halsey.
