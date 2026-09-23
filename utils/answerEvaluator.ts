import OpenAI, { AzureOpenAI } from 'openai';
import type { GoldenQuestion } from '../data/goldenQuestions';

export type AnswerEvaluation = {
  score: number;
  passed: boolean;
  criteria: Record<string, number>;
  review: string;
  missingConcepts: string[];
  evidence: string[];
  usage?: TokenUsage;
};

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type ConceptStatus = 'matched' | 'partial' | 'missing';

type ConceptResult = {
  concept: string;
  status: ConceptStatus;
  score: number;
  reason: string;
};

type AIValidationResult = {
  passed: boolean;
  score: number;
  maxScore: number;
  threshold: number;
  confidence: number;
  matchedConcepts: string[];
  partialConcepts: string[];
  missingConcepts: string[];
  hallucinatedClaims: string[];
  conceptResults: ConceptResult[];
  review: string;
  evidence: string[];
  usage?: TokenUsage;
};

const SYSTEM_PROMPT = `
You are a strict answer validator for a workflow QA system.

Goal:
Validate whether a candidate answer correctly describes the required workflow steps for the given user question.

Rules:
1. Use the provided requiredConcepts as the rubric.
2. Do not require the exact original words. Semantic correctness is more important than wording.
3. Mark a concept as:
   - matched: clearly present and correct
   - partial: partially covered but missing required detail or action
   - missing: absent or incorrect
4. Detect hallucinations:
   - invented steps
   - unsupported UI labels or actions
   - incorrect numeric constraints or flags
   - false claims that are not part of the workflow
5. Score each concept independently:
   - matched = 1.0
   - partial = 0.5
   - missing = 0.0
6. Overall pass is true only if:
   - total score meets the passing threshold
   - no critical hallucinations are present
   - critical required concepts are not missing
7. Be strict on behavior, not on keyword overlap.

Return only JSON matching the response schema.
`;

const createOpenAIClient = () => {
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureDeployment = process.env.AZURE_DEPLOYMENT_NAME;
  const azureApiVersion = process.env.AZURE_API_VERSION;

  if (azureApiKey && azureEndpoint && azureDeployment && azureApiVersion) {
    try {
      return new AzureOpenAI({
        apiKey: azureApiKey,
        endpoint: azureEndpoint,
        deployment: azureDeployment,
        apiVersion: azureApiVersion,
      });
    } catch {
      throw new Error('Unable to initialize the Azure OpenAI client.');
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Azure OpenAI configuration is required for answer evaluation.');
  }

  try {
    return new OpenAI({ apiKey });
  } catch {
    throw new Error('Unable to initialize the OpenAI client.');
  }
};

const getEvaluationModel = (): string => {
  return process.env.AZURE_DEPLOYMENT_NAME || process.env.OPENAI_EVAL_MODEL || 'gpt-4o-mini';
};

const evaluateWithAI = async (
  goldenQuestion: GoldenQuestion,
  actualAnswer: string,
): Promise<AIValidationResult> => {
  const client = createOpenAIClient();

  const payload = {
    question: goldenQuestion.question,
    expectedAnswer: goldenQuestion.expectedAnswer,
    requiredConcepts: goldenQuestion.requiredConcepts,
    passingScore: goldenQuestion.passingScore,
    actualAnswer,
  };

  const prompt = `
Question:
${payload.question}

Expected answer (ground truth / workflow baseline):
${payload.expectedAnswer}

Required concepts:
${payload.requiredConcepts.map((concept, index) => `${index + 1}. ${concept}`).join('\n')}

Candidate answer:
${payload.actualAnswer}

Passing score threshold:
${payload.passingScore}
`;

  const response = await client.chat.completions.create({
    model: getEvaluationModel(),
    max_completion_tokens: 600,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'validation_result',
        schema: {
          type: 'object',
          properties: {
            passed: { type: 'boolean' },
            score: { type: 'number' },
            maxScore: { type: 'number' },
            threshold: { type: 'number' },
            confidence: { type: 'number' },
            matchedConcepts: { type: 'array', items: { type: 'string' } },
            partialConcepts: { type: 'array', items: { type: 'string' } },
            missingConcepts: { type: 'array', items: { type: 'string' } },
            hallucinatedClaims: { type: 'array', items: { type: 'string' } },
            conceptResults: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  concept: { type: 'string' },
                  status: { type: 'string', enum: ['matched', 'partial', 'missing'] },
                  score: { type: 'number' },
                  reason: { type: 'string' },
                },
                required: ['concept', 'status', 'score', 'reason'],
                additionalProperties: false,
              },
            },
            review: { type: 'string' },
            evidence: { type: 'array', items: { type: 'string' } },
          },
          required: [
            'passed',
            'score',
            'maxScore',
            'threshold',
            'confidence',
            'matchedConcepts',
            'partialConcepts',
            'missingConcepts',
            'hallucinatedClaims',
            'conceptResults',
            'review',
            'evidence',
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const responseText = response.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error('OpenAI returned an empty answer evaluation response.');
  }

  const parsed = JSON.parse(responseText) as AIValidationResult;
  return {
    ...parsed,
    usage: response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined,
  };
};

export async function evaluateAnswer(
  goldenQuestion: GoldenQuestion,
  actualAnswer: string,
): Promise<AnswerEvaluation> {
  const aiResult = await evaluateWithAI(goldenQuestion, actualAnswer);
  const criteria = {
    matchedConcepts: aiResult.score,
    requiredConcepts: aiResult.maxScore,
  };

  const missingConcepts = aiResult.missingConcepts.length > 0
    ? aiResult.missingConcepts
    : Array.from(new Set(
        goldenQuestion.requiredConcepts.filter(
          (concept) => !aiResult.matchedConcepts.includes(concept) && !aiResult.partialConcepts.includes(concept),
        ),
      ));

  const evidence = aiResult.evidence.length > 0
    ? aiResult.evidence
    : aiResult.matchedConcepts.length > 0
      ? aiResult.matchedConcepts
      : ['No matching required concepts were found in the answer.'];

  return {
    score: aiResult.score,
    passed: aiResult.passed,
    criteria,
    review: aiResult.review,
    missingConcepts,
    evidence,
    usage: aiResult.usage,
  };
}
