import goldenQuestionRecords from './goldenQuestions.json';

export type GoldenQuestion = {
  id: string;
  question: string;
  expectedAnswer: string;
  requiredConcepts: string[];
  passingScore: number;
};

type GoldenQuestionRecord = Omit<GoldenQuestion, 'expectedAnswer'> & {
  baselineResponse: string;
}

export const goldenQuestions: GoldenQuestion[] = (
  goldenQuestionRecords as GoldenQuestionRecord[]
).map(({ baselineResponse, ...question }) => ({
  ...question,
  expectedAnswer: baselineResponse,
}));