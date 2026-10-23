import fs from 'node:fs/promises';
import path from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import type { BaselineAnswerScore } from './answerEvaluator';

type Evaluation = {
  id: string;
  question: string;
  expectedAnswer: string;
  actualAnswer: string;
  passed: boolean;
  review: string;
  score: number | BaselineAnswerScore;
  latencyMs?: number;
  totalTimeMs?: number;
};

type ReportRow = {
  evaluation: Evaluation;
};

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default class CsvReporter implements Reporter {
  private rows = new Map<string, ReportRow>();

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

    this.rows.set(test.id, {
      evaluation: JSON.parse(content) as Evaluation,
    });
  }

  async onEnd(): Promise<void> {
    const outputPath = path.resolve('test-results', 'golden-questions.csv');

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const header = [
      'ID',
      'questions',
      'Expected Answer',
      'Generated Answer',
      'score',
      'passed',
      'review',
      'Latency (ms)',
      'Total Time (ms)',
    ];

    const lines = [...this.rows.values()].map(({ evaluation }) =>
      [
        evaluation.id,
        evaluation.question,
        evaluation.expectedAnswer,
        evaluation.actualAnswer,
        evaluation.score,
        evaluation.passed,
        evaluation.review,
        evaluation.latencyMs,
        evaluation.totalTimeMs,
      ]
        .map(csvCell)
        .join(','),
    );

    await fs.writeFile(
      outputPath,
      '\uFEFF' + [header.map(csvCell).join(','), ...lines].join('\n') + '\n',
      'utf8',
    );

    console.log(`CSV report written to ${outputPath}`);
  }
}