import { test, expect } from '../utils/fixtures';
import { generalElements } from '../pages/generalElements';
import { getGoldenQuestions } from '../data/goldenQuestions';
import { evaluateAnswer } from '../utils/answerEvaluator';
import { restoreOrLogin } from '../utils/sessionManager';
import { retryOnExecutionError } from '../utils/executionRetry';

test.describe('Ask Agora golden questions for Angus', () => {
  test.beforeEach(async ({ page, takeScreenshot }) => {
    await retryOnExecutionError(async () => {
      await restoreOrLogin(page);
      await takeScreenshot('authenticated');
    }, async () => {
      if (!page.isClosed()) await restoreOrLogin(page);
    });
  });

  for (const [questionIndex, goldenQuestion] of getGoldenQuestions('angus').slice(0,1).entries()) {
    test(`validates ${goldenQuestion.id} (${questionIndex + 1})`, async ({ page, takeScreenshot }, testInfo) => {
      const { actualAnswer, evaluation } = await retryOnExecutionError(async () => {
        const askAgora = new generalElements(page);
        await askAgora.openAskAgora();
        await takeScreenshot('ask-agora-open');
        await page.waitForTimeout(1000)
        const actualAnswer = await askAgora.askQuestion(goldenQuestion.question);
        await takeScreenshot('answer-rendered');
        const evaluation = await evaluateAnswer(goldenQuestion, actualAnswer);
        return { actualAnswer, evaluation };
      }, async () => {
        if (!page.isClosed()) await restoreOrLogin(page);
      });
      console.log('\nAsk Agora golden question evaluation');
      console.log(`Question: ${goldenQuestion.question}`);
      console.log(`Expected response: ${goldenQuestion.expectedAnswer}`);
      console.log(`Received response: ${actualAnswer}`);
      console.log(`Score: ${evaluation.score}/${Object.keys(evaluation.criteria).length}`);
      console.log('Token usage:', evaluation.usage);
      await testInfo.attach('answer-evaluation.json', {
        body: JSON.stringify(
          {
            question: goldenQuestion.question,
            expectedAnswer: goldenQuestion.expectedAnswer,
            actualAnswer,
            score: evaluation.score,
            passingScore: goldenQuestion.passingScore,
            passed: evaluation.passed,
            criteria: evaluation.criteria,
            review: evaluation.review,
            missingConcepts: evaluation.missingConcepts,
            evidence: evaluation.evidence,
            tokenUsage: evaluation.usage ?? null,
          },
          null,
          2,
        ),
        contentType: 'application/json',
      });

      expect(evaluation.score, evaluation.review).toBeGreaterThanOrEqual(
        goldenQuestion.passingScore,
      );
      expect(evaluation.passed, evaluation.review).toBe(true);
    });
  }
});