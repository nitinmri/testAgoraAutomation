const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const REQUIRED_HEADERS = ['question', 'baselineResponse', 'passingScore'];

function createId(question: string, rowNumber: number, usedIds: Set<string>): string {
  const baseId = question
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `question-row-${rowNumber}`;

  let id = baseId;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(id);
  return id;
}

function convertWorkbook(inputPath: string, outputPath: string, requestedSheet?: string): number {
  const workbook = XLSX.readFile(inputPath, { cellDates: false });
  const sheetName = requestedSheet || workbook.SheetNames[0];
  if (!sheetName || !workbook.Sheets[sheetName]) {
    throw new Error(`Worksheet "${sheetName || ''}" was not found in "${inputPath}".`);
  }

  if (!requestedSheet && workbook.SheetNames.length > 1) {
    throw new Error(
      `Workbook has multiple worksheets (${workbook.SheetNames.join(', ')}). ` +
      'Specify one with --sheet <name> to avoid skipping data.',
    );
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet['!ref']) {
    throw new Error(`Worksheet "${sheetName}" is empty.`);
  }

  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const headers = new Map<string, number>();
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })];
    if (cell && typeof cell.v === 'string') {
      if (headers.has(cell.v) && REQUIRED_HEADERS.includes(cell.v)) {
        throw new Error(`Worksheet "${sheetName}" has duplicate "${cell.v}" headers.`);
      }
      headers.set(cell.v, column);
    }
  }

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.has(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Worksheet "${sheetName}" is missing required headers: ${missingHeaders.join(', ')}.`);
  }

  const records: Array<{
    id: string;
    question: string;
    baselineResponse: string;
    passingScore: number;
  }> = [];
  const usedIds = new Set<string>();
  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    const rowNumber = row + 1;
    const values: unknown[] = REQUIRED_HEADERS.map((header) => {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: headers.get(header)! })];
      if (cell && cell.f) {
        throw new Error(`Formula found in "${header}" at row ${rowNumber}; use a literal cell value.`);
      }
      return cell ? cell.v : undefined;
    });

    if (values.every((value) => value === undefined || value === null || value === '')) {
      continue;
    }

    const [question, baselineResponse, rawPassingScore] = values;
    if (typeof question !== 'string' || question.trim().length === 0) {
      throw new Error(`Missing question text at row ${rowNumber}; no rows were converted.`);
    }
    if (typeof baselineResponse !== 'string' || baselineResponse.trim().length === 0) {
      throw new Error(`Missing baseline response at row ${rowNumber}; no rows were converted.`);
    }

    if (rawPassingScore === undefined || rawPassingScore === null || rawPassingScore === '') {
      throw new Error(`Missing passingScore at row ${rowNumber}; no rows were converted.`);
    }
    const passingScore = typeof rawPassingScore === 'number' ? rawPassingScore : Number(rawPassingScore);
    if (!Number.isFinite(passingScore)) {
      throw new Error(`Invalid passingScore at row ${rowNumber}; no rows were converted.`);
    }

    records.push({
      id: createId(question, rowNumber, usedIds),
      question,
      baselineResponse,
      passingScore,
    });
  }

  if (records.length === 0) {
    throw new Error(`Worksheet "${sheetName}" contains no question records.`);
  }

  const resolvedInput = path.resolve(inputPath);
  const resolvedOutput = path.resolve(outputPath);
  if (resolvedInput === resolvedOutput) {
    throw new Error('Input and output paths must be different.');
  }

  fs.writeFileSync(resolvedOutput, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  return records.length;
}

function main(args: string[]): void {
  const positional: string[] = [];
  let sheetName: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--sheet') {
      sheetName = args[index + 1];
      if (!sheetName) {
        throw new Error('The --sheet option requires a worksheet name.');
      }
      index += 1;
    } else {
      positional.push(args[index]);
    }
  }

  if (positional.length < 1 || positional.length > 2) {
    throw new Error(
      'Usage: npm run convert:xlsx -- <input.xlsx> [output.json] [--sheet <name>]',
    );
  }

  const inputPath = positional[0];
  const outputPath = positional[1] || path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, path.extname(inputPath))}GoldenQuestions.json`,
  );
  const recordCount = convertWorkbook(inputPath, outputPath, sheetName);
  console.log(`Converted ${recordCount} questions from "${inputPath}" to "${outputPath}".`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`XLSX conversion failed: ${message}`);
    process.exitCode = 1;
  }
}

module.exports = { convertWorkbook };
