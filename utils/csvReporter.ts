import fs from 'node:fs/promises';
import path from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

type Evaluation = {
  question: string;
  expectedAnswer: string;
  actualAnswer: string;
  passed: boolean;
  review: string;
  missingConcepts: string[];
  evidence: string[];
  score: number;
  tokenUsage?: {
    totalTokens?: number;
  } | null;
};

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default class CsvReporter implements Reporter {
  private rows = new Map<string, Evaluation>();

  async onTestEnd(test: TestCase, result: TestResult): Promise<void> {
    const attachment = result.attachments.find(
      (item) => item.name === 'answer-evaluation.json',
    );

    this.rows.delete(test.id);

    if (!attachment) {
      return;
    }

    const content = attachment.body
      ? attachment.body.toString('utf8')
      : attachment.path
        ? await fs.readFile(attachment.path, 'utf8')
        : null;

    if (!content) {
      return;
    }

    this.rows.set(test.id, JSON.parse(content) as Evaluation);
  }

  async onEnd(): Promise<void> {
    const outputPath = path.resolve('test-results', 'golden-questions.csv');

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const header = [
      'questions',
      'baselineResponses(expectedAnswers)',
      'actual answers',
      'passed',
      'review',
      'missingConcepts',
      'evidence',
      'score',
      'token used',
    ];

    const lines = [...this.rows.values()].map((row) =>
      [
        row.question,
        row.expectedAnswer,
        row.actualAnswer,
        row.passed,
        row.review,
        row.missingConcepts.join('; '),
        row.evidence.join('; '),
        row.score,
        row.tokenUsage?.totalTokens ?? '',
      ]
        .map(csvCell)
        .join(','),
    );

    await fs.writeFile(
      outputPath,
      [header.map(csvCell).join(','), ...lines].join('\n') + '\n',
      'utf8',
    );

    console.log(`CSV report written to ${outputPath}`);
  }
}