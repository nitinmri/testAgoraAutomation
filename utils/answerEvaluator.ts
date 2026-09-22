import type { GoldenQuestion } from '../data/goldenQuestions';

export type AnswerEvaluation = {
  score: number;
  passed: boolean;
  criteria: Record<string, number>;
  review: string;
  missingConcepts: string[];
  evidence: string[];
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'be', 'by', 'for', 'from', 'if', 'in', 'into', 'is',
  'it', 'of', 'on', 'or', 'the', 'then', 'to', 'up', 'with', 'you', 'your', 'this',
  'that', 'these', 'those', 'their', 'there', 'where', 'when', 'which', 'who', 'why',
  'how', 'more', 'not', 'also', 'can', 'do', 'does', 'should', 'after', 'before', 'about',
  'allowing', 'allow', 'as', 'such', 'etc'
]);

const SYNONYM_MAP: Record<string, string[]> = {
  'new coi': ['new coi', 'tenant certificates', 'certificates of insurance', 'add coi'],
  'tenant': ['tenant', 'tenant details'],
  'three characters': ['three characters', '3 characters', 'at least 3 characters', 'at least three characters'],
  'coi title': ['coi title', 'title'],
  '4 mb': ['4 mb', '4mb', 'attachment limit', 'attachment size limit'],
  'lease': ['lease', 'applicable lease'],
  'policies': ['policies', 'policy', 'update policies', 'edit policies', 'add policy'],
  'preventive maintenance': ['preventive maintenance', 'pm'],
  'task library': ['task library', 'tasks list'],
  'add task': ['add task', 'click add task'],
  'property': ['property', 'where the task applies'],
  'task name': ['task name', 'name for the task'],
  'trade': ['trade', 'trades'],
  'more options': ['more options', 'custom interval', 'frequency', 'specific interval'],
  'estimated time': ['estimated time', 'estimated completion time'],
  'instructions': ['instructions', 'general instructions'],
  'create and view': ['create and view', 'create to save', 'click create', 'create or create and view'],
  'create': ['create', 'save the task'],
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value: string): string[] =>
  normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));

const containsAnyVariant = (answer: string, variants: string[]): boolean =>
  variants.some((variant) => {
    const normalizedVariant = normalize(variant);
    return (
      normalizedVariant.length > 0 &&
      (answer.includes(normalizedVariant) ||
        answer.includes(normalizedVariant.replace(/\s+/g, '')))
    );
  });

const buildConceptVariants = (concept: string): string[] => {
  const normalizedConcept = normalize(concept);
  const variants = new Set<string>([normalizedConcept]);

  for (const [key, aliases] of Object.entries(SYNONYM_MAP)) {
    const normalizedKey = normalize(key);
    if (normalizedConcept.includes(normalizedKey)) {
      aliases.forEach((alias) => variants.add(normalize(alias)));
    }
  }

  const tokens = tokenize(normalizedConcept);
  if (tokens.length > 0) {
    const keywordSet = tokens.filter((token) => token.length > 2);
    if (keywordSet.length > 0) {
      variants.add(keywordSet.join(' '));
      variants.add(keywordSet.slice(0, Math.min(3, keywordSet.length)).join(' '));
    }
  }

  return [...variants].filter(Boolean);
};

const conceptMatchesAnswer = (concept: string, answer: string): boolean => {
  const normalizedAnswer = normalize(answer);
  const variants = buildConceptVariants(concept);

  if (containsAnyVariant(normalizedAnswer, variants)) {
    return true;
  }

  const answerTokens = new Set(tokenize(normalizedAnswer));
  const conceptTokens = tokenize(concept).filter((token) => token.length > 2);

  if (conceptTokens.length === 0) {
    return false;
  }

  const matchedCount = conceptTokens.filter((token) => answerTokens.has(token)).length;
  const requiredMatches = Math.max(1, Math.ceil(conceptTokens.length * 0.6));

  return matchedCount >= requiredMatches;
};

export async function evaluateAnswer(
  goldenQuestion: GoldenQuestion,
  actualAnswer: string,
): Promise<AnswerEvaluation> {
  const matchingConcepts: string[] = [];
  const missingConcepts: string[] = [];

  for (const concept of goldenQuestion.requiredConcepts) {
    if (conceptMatchesAnswer(concept, actualAnswer)) {
      matchingConcepts.push(concept);
    } else {
      missingConcepts.push(concept);
    }
  }

  const score = matchingConcepts.length;
  const passed = score >= goldenQuestion.passingScore;
  const criteria = {
    matchedConcepts: score,
    requiredConcepts: goldenQuestion.requiredConcepts.length,
  };

  const review = passed
    ? `Passed: matched ${score} of ${goldenQuestion.requiredConcepts.length} required concepts.`
    : `Needs improvement: matched ${score} of ${goldenQuestion.requiredConcepts.length} required concepts.`;

  return {
    score,
    passed,
    criteria,
    review,
    missingConcepts,
    evidence:
      matchingConcepts.length > 0
        ? matchingConcepts
        : ['No matching required concepts were found in the answer.'],
  };
}
