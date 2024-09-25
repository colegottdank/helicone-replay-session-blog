import { resolve } from "path";
require("dotenv").config({ path: resolve(__dirname, "../.env") });
import OpenAI from "openai";
import readline from "readline";
import fetch from "node-fetch"; // Make sure to install node-fetch
import { ChatCompletionMessageParam } from "openai/resources";
import { v4 as uuidv4 } from "uuid";

const HELICONE_API_KEY = process.env.HELICONE_API_KEY || "";
const SESSION_NAME = "Debate_Session";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://oai.helicone.ai/v1",
  defaultHeaders: {
    // Include your Helicone API key if needed
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
  },
});

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const action = await new Promise<string>((resolve) => {
    rl.question(
      "Do you want to (1) start a new debate or (2) replay an existing session? Enter 1 or 2: ",
      (answer) => {
        resolve(answer.trim());
      }
    );
  });

  if (action === "1") {
    await startNewDebate(rl);
  } else if (action === "2") {
    await replaySession(rl);
  } else {
    console.log("Invalid option selected.");
  }

  rl.close();
}

async function startNewDebate(rl: readline.Interface) {
  // Get the debate topic from the user
  const topic = await new Promise<string>((resolve) => {
    rl.question("Please enter the debate topic: ", (answer) => {
      resolve(answer);
    });
  });

  const sessionId = uuidv4(); // Generate a unique session ID
  const sessionName = `Debate`;
  const sessionPath = `/debate/${topic.replace(/\s+/g, "-").toLowerCase()}`;

  const conversation: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You're a debating professional. You're engaging in a structured debate with the user. Each of you will present arguments for or against the topic. Do not get stuck on one argument, be dynamic and present multiple arguments. Keep responses concise and to the point. 1 paragraph max.",
    },
    {
      role: "assistant",
      content: `Welcome to our debate! Today's topic is: "${topic}". I will argue in favor, and you will argue against. Please present your opening argument.`,
    },
  ];

  console.log("\n=== Assistant ===");
  console.log(conversation[1].content);

  let turn = 1;
  while (true) {
    // Get user's argument
    const userArgument = await new Promise<string>((resolve) => {
      rl.question("\nYour argument (or type 'exit' to end): ", (answer) => {
        resolve(answer);
      });
    });

    if (userArgument.toLowerCase() === "exit") {
      break;
    }

    conversation.push({ role: "user", content: userArgument });

    // Score the user's argument
    await evaluateArgument(
      userArgument,
      sessionId,
      sessionName,
      `${sessionPath}/turn-${turn}`,
      "Your Argument"
    );

    // Assistant responds with a counter-argument
    const assistantResponse = await generateAssistantResponse(
      conversation,
      sessionId,
      sessionName,
      `${sessionPath}/turn-${turn}`
    );

    conversation.push(assistantResponse);

    console.log("\n=== Assistant ===");
    console.log(assistantResponse.content);

    // Score the assistant's argument
    await evaluateArgument(
      assistantResponse.content as string,
      sessionId,
      sessionName,
      `${sessionPath}/turn-${turn}`,
      "Assistant's Argument"
    );

    turn++;
  }

  console.log("\n=== Debate Session Completed ===");
  console.log(`Session ID: ${sessionId}`);
}

async function generateAssistantResponse(
  conversation: ChatCompletionMessageParam[],
  sessionId: string,
  sessionName: string,
  sessionPath: string
): Promise<ChatCompletionMessageParam> {
  const { data } = await openai.chat.completions
    .create(
      {
        model: "gpt-4o-mini",
        messages: conversation,
      },
      {
        headers: {
          "Helicone-Session-Id": sessionId,
          "Helicone-Session-Name": sessionName,
          "Helicone-Session-Path": sessionPath,
          "Helicone-Prompt-Id": "assistant-argument",
        },
      }
    )
    .withResponse();

  return data.choices[0].message as ChatCompletionMessageParam;
}

async function evaluateArgument(
  argument: string,
  sessionId: string,
  sessionName: string,
  sessionPath: string,
  evaluatorTitle: string
) {
  const scoringPrompt: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are an impartial judge evaluating debate arguments. Given the argument, provide a score from 1 to 10 based on validity and persuasiveness, and give constructive feedback.",
    },
    {
      role: "user",
      content: argument,
    },
  ];

  const scoringResponse = await openai.chat.completions.create(
    {
      model: "gpt-4o-mini",
      messages: scoringPrompt,
    },
    {
      headers: {
        "Helicone-Session-Id": sessionId,
        "Helicone-Session-Name": sessionName,
        "Helicone-Session-Path": sessionPath,
        "Helicone-Prompt-Id": "argument-evaluation",
      },
    }
  );

  const scorerMessage = scoringResponse.choices[0].message;

  console.log(`\n=== Evaluator's Feedback on ${evaluatorTitle} ===`);
  console.log(scorerMessage.content);
}

async function replaySession(rl: readline.Interface) {
  const SESSION_ID_TO_REPLAY = await new Promise<string>((resolve) => {
    rl.question("Please enter the SESSION_ID to replay: ", (answer) => {
      resolve(answer.trim());
    });
  });

  if (!SESSION_ID_TO_REPLAY) {
    console.error("Error: SESSION_ID cannot be empty.");
    return;
  }

  const requests = await queryHeliconeSession(SESSION_ID_TO_REPLAY);

  if (requests.length === 0) {
    console.log("No sessions found with the provided SESSION_ID.");
    return;
  }

  await rerunSession(requests);
}

type ParsedRequestData = {
  created_at: string;
  session: string;
  signed_body_url: string;
  request_path: string;
  path: string;
  prompt_id: string;
  body: RequestBody;
};

type RequestBody = {
  model?: string;
  messages?: any[];
  input?: string | string[];
};

type HeliconeMetadata = {
  sessionId: string;
  sessionName: string;
  path: string;
  promptId: string;
};

async function queryHeliconeSession(
  SESSION_ID_TO_REPLAY: string
): Promise<ParsedRequestData[]> {
  const response = await fetch("https://api.helicone.ai/v1/request/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HELICONE_API_KEY}`,
    },
    body: JSON.stringify({
      filter: {
        properties: {
          "Helicone-Session-Id": {
            equals: SESSION_ID_TO_REPLAY,
          },
        },
      },
    }),
  });

  const data = await response.json();

  return data.data.map((request: any) => ({
    created_at: request.request_created_at,
    session: request.request_properties?.["Helicone-Session-Id"] || "",
    signed_body_url: request.signed_body_url || "",
    request_path: request.request_path || "",
    path: request.request_properties?.["Helicone-Session-Path"] || "/",
    prompt_id: request.prompt_id || "",
    body: request.body || {},
  }));
}

function modifyRequestBody(request: ParsedRequestData) {
  if (request.prompt_id === "argument-evaluation") {
    // Find and modify the system message
    const systemMessage = request.body.messages?.find(
      (message: any) => message.role === "system"
    );

    if (systemMessage) {
      systemMessage.content += " Keep the feedback short and concise.";
    }
  } else if (request.prompt_id === "assistant-argument") {
    const systemMessage = request.body.messages?.find(
      (message: any) => message.role === "system"
    );

    if (systemMessage) {
      systemMessage.content +=
        " Take the persona of a genius in this field when responding.";
    }
  }

  return request;
}

async function rerunSession(requests: ParsedRequestData[]) {
  const newSessionId = uuidv4();

  // Sort the requests by created_at timestamp
  requests.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Process each request sequentially
  for (const request of requests) {
    await processSingleRequest(request, newSessionId);
  }
}

async function processSingleRequest(
  request: ParsedRequestData,
  newSessionId: string
): Promise<void> {
  const bodyResponse = await fetch(request.signed_body_url);
  const bodyData = await bodyResponse.json();
  const requestBody: RequestBody = bodyData.request;
  request.body = requestBody;

  const modifiedRequest = modifyRequestBody(request);

  // Optionally modify the request body if needed
  // For the debate session, we might not need to modify it

  const metadata: HeliconeMetadata = {
    sessionId: newSessionId,
    sessionName: SESSION_NAME,
    path: request.path,
    promptId: request.prompt_id,
  };

  if (request.request_path.includes("chat/completions")) {
    await handleChatCompletion(
      request.request_path,
      modifiedRequest.body,
      metadata
    );
  } else {
    console.log(`Unknown request type for ${metadata.path}`);
  }
}

async function handleChatCompletion(
  requestPath: string,
  body: RequestBody,
  metadata: HeliconeMetadata
) {
  console.log(`Replaying chat/completions for ${metadata.path}`);
  const response = await fetch(requestPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Helicone-Auth": `Bearer ${HELICONE_API_KEY}`,
      "Helicone-Session-Id": metadata.sessionId,
      "Helicone-Session-Name": metadata.sessionName,
      "Helicone-Session-Path": metadata.path,
      "Helicone-Prompt-Id": metadata.promptId,
    },
    body: JSON.stringify(body),
  });

  const responseData = await response.json();
  console.log(`Response for ${metadata.path}:`, responseData);
}

main().catch((error) => {
  console.error("An error occurred:", error);
});
