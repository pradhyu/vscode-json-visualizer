import * as fs from 'fs';
import * as path from 'path';

export async function validateJsonFile(filePath: string): Promise<void> {
  // Check if file exists
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
  } catch (error) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Check if file is readable
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch (error) {
    throw new Error(`File is not readable: ${filePath}`);
  }

  // Check file extension
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.json') {
    throw new Error(`Invalid file type: ${ext}. Expected .json file`);
  }

  // Check if file is valid JSON
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in file: ${filePath}. ${error.message}`);
    }
    throw error;
  }

  // Check file size (warn if very large)
  const stats = await fs.promises.stat(filePath);
  const fileSizeMB = stats.size / (1024 * 1024);
  
  if (fileSizeMB > 100) {
    console.warn(`Warning: Large file detected (${fileSizeMB.toFixed(1)}MB). Processing may take some time.`);
  }
}

export async function validateOutputPath(outputPath: string): Promise<void> {
  const outputDir = path.dirname(outputPath);
  
  // Check if output directory exists, create if it doesn't
  try {
    await fs.promises.access(outputDir, fs.constants.F_OK);
  } catch (error) {
    try {
      await fs.promises.mkdir(outputDir, { recursive: true });
    } catch (mkdirError) {
      throw new Error(`Cannot create output directory: ${outputDir}`);
    }
  }

  // Check if output directory is writable
  try {
    await fs.promises.access(outputDir, fs.constants.W_OK);
  } catch (error) {
    throw new Error(`Output directory is not writable: ${outputDir}`);
  }

  // Check if output file already exists and warn
  try {
    await fs.promises.access(outputPath, fs.constants.F_OK);
    console.warn(`Warning: Output file already exists and will be overwritten: ${outputPath}`);
  } catch (error) {
    // File doesn't exist, which is fine
  }

  // Validate output file extension
  const ext = path.extname(outputPath).toLowerCase();
  if (ext !== '.html' && ext !== '.htm') {
    throw new Error(`Invalid output file type: ${ext}. Expected .html or .htm file`);
  }
}

export function validateDateFormat(format: string): boolean {
  const validFormats = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD-MM-YYYY', 'YYYY/MM/DD', 'DD/MM/YYYY', 'MM-DD-YYYY'];
  return validFormats.includes(format);
}

export function validateHexColor(color: string): boolean {
  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexColorRegex.test(color);
}

export function validateTheme(theme: string): boolean {
  const validThemes = ['light', 'dark', 'auto'];
  return validThemes.includes(theme);
}

export function validateDimensions(width: string, height: string): { width: number; height: number } {
  const widthNum = parseInt(width, 10);
  const heightNum = parseInt(height, 10);

  if (isNaN(widthNum) || widthNum < 400 || widthNum > 5000) {
    throw new Error(`Invalid width: ${width}. Must be between 400 and 5000 pixels`);
  }

  if (isNaN(heightNum) || heightNum < 300 || heightNum > 3000) {
    throw new Error(`Invalid height: ${height}. Must be between 300 and 3000 pixels`);
  }

  return { width: widthNum, height: heightNum };
}