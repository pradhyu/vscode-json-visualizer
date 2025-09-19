import { describe, it, expect, vi } from 'vitest';
import {
    setupFsMocks,
    setupVSCodeMocks,
    setupParserMocks,
    setupExtensionContextMock,
    createTestEnvironment,
    setupIntegrationTestEnvironment,
    createMockJsonData
} from './mockUtils';

describe('Mock Utilities', () => {
    describe('setupFsMocks', () => {
        it('should create fs mock with all required methods', () => {
            const fsMock = setupFsMocks();
            
            expect(fsMock.existsSync).toBeDefined();
            expect(fsMock.readFileSync).toBeDefined();
            expect(fsMock.writeFileSync).toBeDefined();
            expect(fsMock.promises.readFile).toBeDefined();
            expect(fsMock.constants.F_OK).toBe(0);
        });
    });

    describe('setupVSCodeMocks', () => {
        it('should create VSCode mock with all required APIs', () => {
            const vscodeMock = setupVSCodeMocks();
            
            expect(vscodeMock.window.createWebviewPanel).toBeDefined();
            expect(vscodeMock.window.showErrorMessage).toBeDefined();
            expect(vscodeMock.workspace.openTextDocument).toBeDefined();
            expect(vscodeMock.commands.registerCommand).toBeDefined();
            expect(vscodeMock.ViewColumn.One).toBe(1);
        });
    });

    describe('setupIntegrationTestEnvironment', () => {
        it('should create comprehensive test environment', () => {
            const env = setupIntegrationTestEnvironment({
                expectCommandRegistration: true,
                mockFileContent: '{"test": "data"}'
            });
            
            expect(env.vscode).toBeDefined();
            expect(env.fs).toBeDefined();
            expect(env.context).toBeDefined();
            expect(env.reset).toBeDefined();
        });
    });

    describe('createMockJsonData', () => {
        it('should create valid JSON data', () => {
            const data = createMockJsonData('valid');
            const parsed = JSON.parse(data);
            
            expect(parsed.rxTba).toBeDefined();
            expect(parsed.rxHistory).toBeDefined();
            expect(parsed.medHistory).toBeDefined();
        });

        it('should create non-medical JSON data', () => {
            const data = createMockJsonData('non-medical');
            const parsed = JSON.parse(data);
            
            expect(parsed.users).toBeDefined();
            expect(parsed.products).toBeDefined();
            expect(parsed.rxTba).toBeUndefined();
        });
    });
});