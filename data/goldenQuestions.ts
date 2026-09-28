import angusGoldenQuestionRecords from './angusGoldenQuestions.json';
import secureSignGoldenQuestionRecords from './secureSignGoldenQuestions.json';
import elConnectGoldenQuestionRecords from './elConnectGoldenQuestions.json';
import elApplyGoldenQuestionRecords from './elApplyGoldenQuestions.json'
import elBroadcastGoldenQuestionRecords from './elBroadcastGoldenQuestions.json'
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

const mapGoldenQuestions = (
  records: GoldenQuestionRecord[] | undefined,
  product: string,
): GoldenQuestion[] => {
  if (!Array.isArray(records)) {
    throw new Error(`No golden questions are registered for product "${product}".`);
  }

  return records.map(({ baselineResponse, ...question }) => ({
    ...question,
    expectedAnswer: baselineResponse,
  }));
};

const goldenQuestionRecords = {
  angus: angusGoldenQuestionRecords,
  secureSign: secureSignGoldenQuestionRecords,
  elConnect: elConnectGoldenQuestionRecords,
  elApply:elApplyGoldenQuestionRecords,
  elBroadcast:elBroadcastGoldenQuestionRecords
};

export type GoldenQuestionProduct = keyof typeof goldenQuestionRecords;

export const getGoldenQuestions = (product: GoldenQuestionProduct): GoldenQuestion[] =>
  mapGoldenQuestions(
    goldenQuestionRecords[product] as GoldenQuestionRecord[] | undefined,
    product,
  );