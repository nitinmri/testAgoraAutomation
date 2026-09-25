import angusGoldenQuestionRecords from './angusGoldenQuestions.json';
import secureSignGoldenQuestionRecords from './secureSignGoldenQuestions.json';

export type GoldenQuestion = {
  id: string;
  question: string;
  expectedAnswer: string;
  requiredConcepts: string[];
  passingScore: number;
};

type GoldenQuestionRecord = Omit<GoldenQuestion, 'expectedAnswer'> & {
  baselineResponse: string;
};

const mapGoldenQuestions = (records: GoldenQuestionRecord[]): GoldenQuestion[] => records.map(({
  baselineResponse,
  ...question
}) => ({
  ...question,
  expectedAnswer: baselineResponse,
}));

export const getGoldenQuestions = (product: 'angus' | 'secureSign'): GoldenQuestion[] => {
  const records = product === 'angus'
    ? angusGoldenQuestionRecords
    : secureSignGoldenQuestionRecords;

  return mapGoldenQuestions(records as GoldenQuestionRecord[]);
};