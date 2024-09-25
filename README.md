# Helicone Example Project

A simple Node.js project demonstrating how to use Helicone with OpenAI's API to conduct and replay debate sessions.

## Setup

1. **Install Dependencies:**

   ```bash
   yarn install
   ```

2. **Configure Environment Variables:**

   Create a `.env` file in the root directory:

   ```
   HELICONE_API_KEY=your_helicone_api_key
   OPENAI_API_KEY=your_openai_api_key
   SESSION_ID=your_session_id
   ```

3. **Running the Script:**

   ```bash
   yarn start
   ```

## What It Does

- **Start a New Debate Session:** Engage in a debate with an AI assistant on a topic of your choice.
- **Replay an Existing Session:** Replay a previous debate session by providing its session ID.

## Note

Ensure you have valid API keys for both Helicone and OpenAI.
