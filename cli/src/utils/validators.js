"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDimensions = exports.validateTheme = exports.validateHexColor = exports.validateDateFormat = exports.validateOutputPath = exports.validateJsonFile = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function validateJsonFile(filePath) {
    // Check if file exists
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
    }
    catch (error) {
        throw new Error(`File not found: ${filePath}`);
    }
    // Check if file is readable
    try {
        await fs.promises.access(filePath, fs.constants.R_OK);
    }
    catch (error) {
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
    }
    catch (error) {
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
exports.validateJsonFile = validateJsonFile;
async function validateOutputPath(outputPath) {
    const outputDir = path.dirname(outputPath);
    // Check if output directory exists, create if it doesn't
    try {
        await fs.promises.access(outputDir, fs.constants.F_OK);
    }
    catch (error) {
        try {
            await fs.promises.mkdir(outputDir, { recursive: true });
        }
        catch (mkdirError) {
            throw new Error(`Cannot create output directory: ${outputDir}`);
        }
    }
    // Check if output directory is writable
    try {
        await fs.promises.access(outputDir, fs.constants.W_OK);
    }
    catch (error) {
        throw new Error(`Output directory is not writable: ${outputDir}`);
    }
    // Check if output file already exists and warn
    try {
        await fs.promises.access(outputPath, fs.constants.F_OK);
        console.warn(`Warning: Output file already exists and will be overwritten: ${outputPath}`);
    }
    catch (error) {
        // File doesn't exist, which is fine
    }
    // Validate output file extension
    const ext = path.extname(outputPath).toLowerCase();
    if (ext !== '.html' && ext !== '.htm') {
        throw new Error(`Invalid output file type: ${ext}. Expected .html or .htm file`);
    }
}
exports.validateOutputPath = validateOutputPath;
function validateDateFormat(format) {
    const validFormats = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD-MM-YYYY', 'YYYY/MM/DD', 'DD/MM/YYYY', 'MM-DD-YYYY'];
    return validFormats.includes(format);
}
exports.validateDateFormat = validateDateFormat;
function validateHexColor(color) {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(color);
}
exports.validateHexColor = validateHexColor;
function validateTheme(theme) {
    const validThemes = ['light', 'dark', 'auto'];
    return validThemes.includes(theme);
}
exports.validateTheme = validateTheme;
function validateDimensions(width, height) {
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
exports.validateDimensions = validateDimensions;
//# sourceMappingURL=validators.js.map