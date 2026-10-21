import { test, expect } from '../utils/fixtures';
import { generalElements } from '../pages/generalElements';
import { getGoldenQuestions } from '../data/goldenQuestions';
import { evaluateBaselineAnswer } from '../utils/answerEvaluator';
import { restoreOrLogin } from '../utils/sessionManager';
import { retryOnExecutionError } from '../utils/executionRetry';

test.describe('DocBot golden questions for ara', () => {
  test.beforeEach(async ({ page, takeScreenshot }) => {
    await retryOnExecutionError(async () => {
      await restoreOrLogin(page);
      await takeScreenshot('authenticated');
    }, async () => {
      if (!page.isClosed()) await restoreOrLogin(page);
    });
  });

  for (const [questionIndex, goldenQuestion] of getGoldenQuestions('repairs').entries()) {
    test(`validates ${goldenQuestion.id} (${questionIndex + 1})`, async ({ page, takeScreenshot }, testInfo) => {
      const { actualAnswer, evaluation } = await retryOnExecutionError(async () => {
        const docBot = new generalElements(page);
        await takeScreenshot('docbot-open');
        const actualAnswer = await docBot.askQuestionFordocBot(goldenQuestion.question);
        await takeScreenshot('answer-rendered');
        const evaluation = await evaluateBaselineAnswer(goldenQuestion, actualAnswer);
        return { actualAnswer, evaluation };
      }, async () => {
        if (!page.isClosed()) await restoreOrLogin(page);
      });

      console.log('\nDocBot golden question evaluation');
      console.log(`Question: ${goldenQuestion.question}`);
      console.log(`Expected response: ${goldenQuestion.expectedAnswer}`);
      console.log(`Received response: ${actualAnswer}`);
      console.log(`Score: ${evaluation.score}`);
      console.log('Token usage:', evaluation.usage);
      await testInfo.attach('answer-evaluation.json', {
        body: JSON.stringify(
          {
            id: goldenQuestion.id,
            question: goldenQuestion.question,
            expectedAnswer: goldenQuestion.expectedAnswer,
            actualAnswer,
            score: evaluation.score,
            passingScore: goldenQuestion.passingScore,
            passed: evaluation.passed,
            review: evaluation.review,
            evidence: evaluation.evidence,
            tokenUsage: evaluation.usage ?? null,
          },
          null,
          2,
        ),
        contentType: 'application/json',
      });

      expect(evaluation.passed, evaluation.review).toBe(true);
    });
  }
});