import angusGoldenQuestionRecords from './angusGoldenQuestions.json';
import secureSignGoldenQuestionRecords from './secureSignGoldenQuestions.json';
import elConnectGoldenQuestionRecords from './elConnectGoldenQuestions.json';
import elApplyGoldenQuestionRecords from './elApplyGoldenQuestions.json'
import elBroadcastGoldenQuestionRecords from './elBroadcastGoldenQuestions.json'
import icGoldenQuestionRecords from './icGoldenQuestions.json'
import contractIntelligenceGoldenQuestionRecords from './contractIntelligenceGoldenQuestions.json'
export type GoldenQuestion = {
  id: string;
  question: string;
  expectedAnswer: string;
  requiredConcepts?: string[];
  passingScore: number;
};

type GoldenQuestionRecord = Omit<GoldenQuestion, 'expectedAnswer' | 'passingScore'> & {
  baselineResponse: string;
  passingScore?: number;
};

const mapGoldenQuestions = (
  records: GoldenQuestionRecord[] | undefined,
  product: string,
): GoldenQuestion[] => {
  if (!Array.isArray(records)) {
    throw new Error(`No golden questions are registered for product "${product}".`);
  }

  return records.map(({ baselineResponse, ...question }) => {
    const passingScore = question.passingScore;
    if (passingScore === undefined || Number.isNaN(Number(passingScore))) {
      throw new Error(`Golden question "${question.id}" for product "${product}" has no valid passing score.`);
    }

    return {
      ...question,
      passingScore: Number(passingScore),
      expectedAnswer: baselineResponse,
    };
  });
};

const goldenQuestionRecords = {
  angus: angusGoldenQuestionRecords,
  secureSign: secureSignGoldenQuestionRecords,
  elConnect: elConnectGoldenQuestionRecords,
  elApply:elApplyGoldenQuestionRecords,
  elBroadcast:elBroadcastGoldenQuestionRecords,
  iCentral:icGoldenQuestionRecords,
  cIntelligence:contractIntelligenceGoldenQuestionRecords
};

export type GoldenQuestionProduct = keyof typeof goldenQuestionRecords;

export const getGoldenQuestions = (product: GoldenQuestionProduct): GoldenQuestion[] =>
  mapGoldenQuestions(
    goldenQuestionRecords[product] as GoldenQuestionRecord[] | undefined,
    product,
  );