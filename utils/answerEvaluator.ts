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

export type BaselineAnswerScore = 1 | 2 | 3 | 'N/A';

export type BaselineAnswerEvaluation = {
  score: BaselineAnswerScore;
  passed: boolean;
  review: string;
  evidence: string[];
  hallucinatedClaims: string[];
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

const BASELINE_SYSTEM_PROMPT = `
You evaluate a candidate answer against the supplied baseline answer for the same question.

Judge whether the candidate gives behaviorally equivalent guidance: it should lead the user to the same understanding, action, or outcome as the baseline. Do not compare wording, sentence structure, or keyword overlap. Accept concise answers and paraphrases when they preserve the baseline's important meaning. Do not require incidental details that do not change the behavior or outcome.

Use exactly one score:
- "3": behaviorally matches the baseline and preserves its important guidance. Different wording is fine.
- "2": partly matches, but omits or weakens important guidance in a way that reduces completeness; it does not materially contradict the baseline.
- "1": unrelated, incorrect, or materially contradictory to the baseline.
- "N/A": the candidate only requests clarification instead of answering the question. Do not use N/A for a direct answer that also asks an optional follow-up question.

As part of the same scoring judgment, check the candidate's factual claims against the baseline. Identify specific material claims that contradict the baseline or introduce unsupported facts, requirements, limitations, or instructions. Do not call a paraphrase, harmless explanation, or immaterial extra detail a hallucination. A material hallucination makes the answer incorrect and should result in "1"; account for its impact when selecting the score rather than applying a separate score adjustment afterward. Include the detected claims in hallucinatedClaims. The review must explain both the behavioral match and any hallucinations, or explicitly say no material hallucinations were detected. Cite concise evidence from the candidate answer. Return only JSON matching the response schema.
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
  const requiredConcepts = goldenQuestion.requiredConcepts ?? [];

  const payload = {
    question: goldenQuestion.question,
    expectedAnswer: goldenQuestion.expectedAnswer,
    requiredConcepts,
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

  const finishReason = response.choices[0]?.finish_reason;
  if (finishReason === 'length') {
    throw new Error('OpenAI truncated the answer evaluation response before returning complete JSON.');
  }

  let parsed: AIValidationResult;
  try {
    parsed = JSON.parse(responseText) as AIValidationResult;
  } catch (error) {
    throw new Error(
      `OpenAI returned invalid JSON for answer evaluation (finish reason: ${finishReason ?? 'unknown'}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }

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
        (goldenQuestion.requiredConcepts ?? []).filter(
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

export async function evaluateBaselineAnswer(
  goldenQuestion: GoldenQuestion,
  actualAnswer: string,
): Promise<BaselineAnswerEvaluation> {
  const client = createOpenAIClient();
  const prompt = `
Compare the candidate answer with the baseline answer for the question. Judge semantic meaning, not exact wording. Use only the baseline answer as the reference; do not use or infer a separate checklist.

Question:
${goldenQuestion.question}

Baseline answer:
${goldenQuestion.expectedAnswer}

Candidate answer:
${actualAnswer}

Choose exactly one score:
3 = same answer in meaning, including the important information from the baseline; paraphrasing is acceptable.
2 = partially matches the baseline but omits or weakens important information, without a material contradiction.
1 = does not match, is unrelated, or materially contradicts the baseline.
N/A = asks the user for clarification instead of providing a substantive answer.

While making that same score decision, identify specific material claims that contradict the baseline or introduce unsupported facts, requirements, limitations, or instructions. Do not flag harmless explanation or equivalent paraphrasing. If a material hallucination changes the answer's correctness, reflect that in both the score and review. Return the score as one of the strings "3", "2", "1", or "N/A", a review that explains the behavioral comparison and hallucination check, brief evidence from the candidate answer, and a hallucinatedClaims array (empty when none are found).
`;

  const response = await client.chat.completions.create({
    model: getEvaluationModel(),
    messages: [
      {
        role: 'system',
        content: BASELINE_SYSTEM_PROMPT,
      },
      { role: 'user', content: prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'baseline_answer_evaluation',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            score: { type: 'string', enum: ['3', '2', '1', 'N/A'] },
            review: { type: 'string' },
            evidence: { type: 'array', items: { type: 'string' } },
            hallucinatedClaims: { type: 'array', items: { type: 'string' } },
          },
          required: ['score', 'review', 'evidence', 'hallucinatedClaims'],
          additionalProperties: false,
        },
      },
    },
  });

  const responseText = response.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error('OpenAI returned an empty baseline answer evaluation response.');
  }

  if (response.choices[0]?.finish_reason === 'length') {
    throw new Error('OpenAI truncated the baseline answer evaluation response before returning complete JSON.');
  }

  let parsed: { score: string; review: string; evidence: string[]; hallucinatedClaims: string[] };
  try {
    parsed = JSON.parse(responseText) as typeof parsed;
  } catch (error) {
    throw new Error(
      `OpenAI returned invalid JSON for baseline answer evaluation: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!['3', '2', '1', 'N/A'].includes(parsed.score)) {
    throw new Error(`OpenAI returned an unsupported baseline answer score: ${parsed.score}`);
  }

  const score: BaselineAnswerScore = parsed.score === 'N/A'
    ? 'N/A'
    : Number(parsed.score) as 1 | 2 | 3;

  return {
    score,
    passed: typeof score === 'number' && score >= goldenQuestion.passingScore,
    review: parsed.review,
    evidence: parsed.evidence,
    hallucinatedClaims: parsed.hallucinatedClaims,
    usage: response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined,
  };
}
