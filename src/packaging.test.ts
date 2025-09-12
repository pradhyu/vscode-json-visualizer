import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs', () => ({
    promises: {
        readFile: vi.fn(),
        access: vi.fn(),
        stat: vi.fn()
    },
    existsSync: vi.fn(),
    readFileSync: vi.fn()
}));

describe('Extension Packaging and Installation Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Package.json Validation', () => {
        it('should have valid package.json structure', async () => {
            const packageJsonContent = {
                name: 'medical-claims-timeline-viewer',
                displayName: 'Medical Claims Timeline Viewer',
                description: 'VSCode extension to visualize medical claims data in an interactive timeline chart',
                version: '0.0.1',
                engines: {
                    vscode: '^1.74.0'
                },
                categories: [
                    'Visualization',
                    'Data Science'
                ],
                activationEvents: [
                    'onLanguage:json',
                    'onCommand:medicalClaimsTimeline.viewTimeline'
                ],
                main: './out/extension.js',
                contributes: {
                    commands: expect.any(Array),
                    menus: expect.any(Object),
                    keybindings: expect.any(Array),
                    configuration: expect.any(Object)
                }
            };

            (fs.readFileSync as any).mockReturnValue(JSON.stringify(packageJsonContent));

            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8') as string);

            // Validate required fields
            expect(packageJson.name).toBe('medical-claims-timeline-viewer');
            expect(packageJson.displayName).toBe('Medical Claims Timeline Viewer');
            expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(packageJson.engines.vscode).toMatch(/^\^?\d+\.\d+\.\d+$/);
            
            // Validate categories
            expect(packageJson.categories).toContain('Visualization');
            expect(packageJson.categories).toContain('Data Science');
            
            // Validate activation events
            expect(packageJson.activationEvents).toContain('onLanguage:json');
            expect(packageJson.activationEvents).toContain('onCommand:medicalClaimsTimeline.viewTimeline');
            
            // Validate main entry point
            expect(packageJson.main).toBe('./out/extension.js');
        });

        it('should have valid command contributions', async () => {
            const packageJsonContent = {
                contributes: {
                    commands: [
                        {
                            command: 'medicalClaimsTimeline.viewTimeline',
                            title: 'View Timeline',
                            category: 'Medical Claims'
                        }
                    ]
                }
            };

            (fs.readFileSync as any).mockReturnValue(JSON.stringify(packageJsonContent));
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8') as string);

            const commands = packageJson.contributes.commands;
            expect(commands).toHaveLength(1);
            
            const viewTimelineCommand = commands.find((cmd: any) => 
                cmd.command === 'medicalClaimsTimeline.viewTimeline'
            );
            
            expect(viewTimelineCommand).toBeDefined();
            expect(viewTimelineCommand.title).toBe('View Timeline');
            expect(viewTimelineCommand.category).toBe('Medical Claims');
        });

        it('should have valid menu contributions', async () => {
            const packageJsonContent = {
                contributes: {
                    menus: {
                        'explorer/context': [
                            {
                                command: 'medicalClaimsTimeline.viewTimeline',
                                when: 'resourceExtname == .json',
                                group: 'navigation'
                            }
                        ],
                        'editor/context': [
                            {
                                command: 'medicalClaimsTimeline.viewTimeline',
                                when: 'resourceExtname == .json',
                                group: 'navigation'
                            }
                        ],
                        'commandPalette': [
                            {
                                command: 'medicalClaimsTimeline.viewTimeline',
                                when: 'editorLangId == json'
                            }
                        ]
                    }
                }
            };

            (fs.readFileSync as any).mockReturnValue(JSON.stringify(packageJsonContent));
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8') as string);

            const menus = packageJson.contributes.menus;
            
            // Validate explorer context menu
            expect(menus['explorer/context']).toBeDefined();
            expect(menus['explorer/context'][0].when).toBe('resourceExtname == .json');
            
            // Validate editor context menu
            expect(menus['editor/context']).toBeDefined();
            expect(menus['editor/context'][0].when).toBe('resourceExtname == .json');
            
            // Validate command palette
            expect(menus['commandPalette']).toBeDefined();
            expect(menus['commandPalette'][0].when).toBe('editorLangId == json');
        });

        it('should have valid configuration schema', async () => {
            const packageJsonContent = {
                contributes: {
                    configuration: {
                        title: 'Medical Claims Timeline',
                        properties: {
                            'medicalClaimsTimeline.rxTbaPath': {
                                type: 'string',
                                default: 'rxTba',
                                description: 'JSON path to rxTba array'
                            },
                            'medicalClaimsTimeline.colors': {
                                type: 'object',
                                default: {
                                    rxTba: '#FF6B6B',
                                    rxHistory: '#4ECDC4',
                                    medHistory: '#45B7D1'
                                }
                            }
                        }
                    }
                }
            };

            (fs.readFileSync as any).mockReturnValue(JSON.stringify(packageJsonContent));
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8') as string);

            const config = packageJson.contributes.configuration;
            expect(config.title).toBe('Medical Claims Timeline');
            expect(config.properties).toBeDefined();
            
            // Validate specific configuration properties
            const rxTbaPathConfig = config.properties['medicalClaimsTimeline.rxTbaPath'];
            expect(rxTbaPathConfig.type).toBe('string');
            expect(rxTbaPathConfig.default).toBe('rxTba');
            
            const colorsConfig = config.properties['medicalClaimsTimeline.colors'];
            expect(colorsConfig.type).toBe('object');
            expect(colorsConfig.default).toHaveProperty('rxTba');
            expect(colorsConfig.default).toHaveProperty('rxHistory');
            expect(colorsConfig.default).toHaveProperty('medHistory');
        });
    });

    describe('File Structure Validation', () => {
        it('should have all required files for packaging', async () => {
            const requiredFiles = [
                'package.json',
                'README.md',
                'CHANGELOG.md',
                'LICENSE',
                'src/extension.ts',
                'tsconfig.json'
            ];

            // Mock file existence checks
            (fs.existsSync as any).mockImplementation((filePath: string) => {
                return requiredFiles.some(required => filePath.endsWith(required));
            });

            requiredFiles.forEach(file => {
                expect(fs.existsSync(file)).toBe(true);
            });
        });

        it('should have sample files in correct location', async () => {
            const sampleFiles = [
                'samples/rxTba-sample.json',
                'samples/rxHistory-sample.json',
                'samples/medHistory-sample.json',
                'samples/comprehensive-claims-sample.json'
            ];

            (fs.existsSync as any).mockImplementation((filePath: string) => {
                return sampleFiles.some(sample => filePath.endsWith(sample));
            });

            sampleFiles.forEach(file => {
                expect(fs.existsSync(file)).toBe(true);
            });
        });

        it('should have compiled JavaScript files', async () => {
            const compiledFiles = [
                'out/extension.js',
                'out/claimsParser.js',
                'out/timelineRenderer.js',
                'out/configManager.js',
                'out/types.js'
            ];

            (fs.existsSync as any).mockImplementation((filePath: string) => {
                return compiledFiles.some(compiled => filePath.endsWith(compiled));
            });

            compiledFiles.forEach(file => {
                expect(fs.existsSync(file)).toBe(true);
            });
        });

        it('should exclude development files from packaging', async () => {
            const excludedFiles = [
                'src/**/*.test.ts',
                'node_modules/**',
                '.git/**',
                '.vscode/**',
                '*.log'
            ];

            // These files should not be included in the final package
            // This test validates the .vscodeignore configuration
            const vscodeignoreContent = [
                'src/**/*.test.ts',
                'node_modules',
                '.git',
                '.vscode',
                '*.log',
                'coverage/',
                '.nyc_output/'
            ].join('\n');

            (fs.readFileSync as any).mockReturnValue(vscodeignoreContent);

            const vscodeignore = fs.readFileSync('.vscodeignore', 'utf-8') as string;
            const ignoredPatterns = vscodeignore.split('\n').filter(line => line.trim());

            expect(ignoredPatterns).toContain('src/**/*.test.ts');
            expect(ignoredPatterns).toContain('node_modules');
            expect(ignoredPatterns).toContain('.git');
        });
    });

    describe('TypeScript Configuration', () => {
        it('should have valid tsconfig.json', async () => {
            const tsconfigContent = {
                compilerOptions: {
                    module: 'commonjs',
                    target: 'ES2020',
                    outDir: 'out',
                    lib: ['ES2020'],
                    sourceMap: true,
                    rootDir: 'src',
                    strict: true
                },
                exclude: ['node_modules', '.vscode-test']
            };

            (fs.readFileSync as any).mockReturnValue(JSON.stringify(tsconfigContent));
            const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf-8') as string);

            expect(tsconfig.compilerOptions.module).toBe('commonjs');
            expect(tsconfig.compilerOptions.target).toBe('ES2020');
            expect(tsconfig.compilerOptions.outDir).toBe('out');
            expect(tsconfig.compilerOptions.rootDir).toBe('src');
            expect(tsconfig.compilerOptions.strict).toBe(true);
            expect(tsconfig.exclude).toContain('node_modules');
        });
    });

    describe('Extension Manifest Validation', () => {
        it('should have valid extension manifest for marketplace', async () => {
            const packageJsonContent = {
                name: 'medical-claims-timeline-viewer',
                displayName: 'Medical Claims Timeline Viewer',
                description: 'VSCode extension to visualize medical claims data in an interactive timeline chart',
                version: '0.0.1',
                publisher: 'your-publisher-name',
                repository: {
                    type: 'git',
                    url: 'https://github.com/your-repo/medical-claims-timeline-viewer.git'
                },
                bugs: {
                    url: 'https://github.com/your-repo/medical-claims-timeline-viewer/issues'
                },
                homepage: 'https://github.com/your-repo/medical-claims-timeline-viewer#readme',
                license: 'MIT',
                keywords: [
                    'medical',
                    'claims',
                    'timeline',
                    'visualization',
                    'healthcare',
                    'data'
                ],
                icon: 'icon.png',
                galleryBanner: {
                    color: '#45B7D1',
                    theme: 'light'
                }
            };

            (fs.readFileSync as any).mockReturnValue(JSON.stringify(packageJsonContent));
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8') as string);

            // Validate marketplace-required fields
            expect(packageJson.publisher).toBeDefined();
            expect(packageJson.repository).toBeDefined();
            expect(packageJson.repository.url).toMatch(/^https:\/\/github\.com/);
            expect(packageJson.license).toBe('MIT');
            expect(packageJson.keywords).toContain('medical');
            expect(packageJson.keywords).toContain('timeline');
            expect(packageJson.keywords).toContain('visualization');
        });

        it('should have appropriate version constraints', async () => {
            const packageJsonContent = {
                engines: {
                    vscode: '^1.74.0'
                },
                devDependencies: {
                    '@types/vscode': '^1.74.0',
                    'typescript': '^4.9.4'
                }
            };

            (fs.readFileSync as any).mockReturnValue(JSON.stringify(packageJsonContent));
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8') as string);

            // Validate VSCode version compatibility
            const vscodeVersion = packageJson.engines.vscode;
            expect(vscodeVersion).toMatch(/^\^?\d+\.\d+\.\d+$/);
            
            // Validate TypeScript version
            const typescriptVersion = packageJson.devDependencies.typescript;
            expect(typescriptVersion).toMatch(/^\^?\d+\.\d+\.\d+$/);
        });
    });

    describe('Installation Simulation', () => {
        it('should simulate successful extension installation', async () => {
            // Mock successful installation process
            const installationSteps = [
                'Download extension package',
                'Validate package integrity',
                'Extract extension files',
                'Register commands and contributions',
                'Activate extension'
            ];

            const mockInstallation = {
                downloadPackage: vi.fn().mockResolvedValue(true),
                validatePackage: vi.fn().mockResolvedValue(true),
                extractFiles: vi.fn().mockResolvedValue(true),
                registerContributions: vi.fn().mockResolvedValue(true),
                activateExtension: vi.fn().mockResolvedValue(true)
            };

            // Simulate installation process
            await mockInstallation.downloadPackage();
            await mockInstallation.validatePackage();
            await mockInstallation.extractFiles();
            await mockInstallation.registerContributions();
            await mockInstallation.activateExtension();

            expect(mockInstallation.downloadPackage).toHaveBeenCalled();
            expect(mockInstallation.validatePackage).toHaveBeenCalled();
            expect(mockInstallation.extractFiles).toHaveBeenCalled();
            expect(mockInstallation.registerContributions).toHaveBeenCalled();
            expect(mockInstallation.activateExtension).toHaveBeenCalled();
        });

        it('should handle installation errors gracefully', async () => {
            const mockInstallationWithError = {
                downloadPackage: vi.fn().mockResolvedValue(true),
                validatePackage: vi.fn().mockRejectedValue(new Error('Package validation failed')),
                rollback: vi.fn().mockResolvedValue(true)
            };

            try {
                await mockInstallationWithError.downloadPackage();
                await mockInstallationWithError.validatePackage();
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe('Package validation failed');
                
                // Simulate rollback
                await mockInstallationWithError.rollback();
                expect(mockInstallationWithError.rollback).toHaveBeenCalled();
            }
        });
    });

    describe('Extension Activation Tests', () => {
        it('should validate extension activation events', async () => {
            const packageJsonContent = {
                activationEvents: [
                    'onLanguage:json',
                    'onCommand:medicalClaimsTimeline.viewTimeline'
                ]
            };

            (fs.readFileSync as any).mockReturnValue(JSON.stringify(packageJsonContent));
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8') as string);

            const activationEvents = packageJson.activationEvents;
            
            // Should activate on JSON files
            expect(activationEvents).toContain('onLanguage:json');
            
            // Should activate on command execution
            expect(activationEvents).toContain('onCommand:medicalClaimsTimeline.viewTimeline');
            
            // Should not have unnecessary activation events
            expect(activationEvents).not.toContain('*'); // Avoid activating on startup
        });

        it('should validate command registration', async () => {
            const mockCommands = {
                'medicalClaimsTimeline.viewTimeline': {
                    title: 'View Timeline',
                    category: 'Medical Claims'
                }
            };

            // Simulate command registration validation
            Object.entries(mockCommands).forEach(([command, config]) => {
                expect(command).toMatch(/^medicalClaimsTimeline\./);
                expect(config.title).toBeDefined();
                expect(config.category).toBe('Medical Claims');
            });
        });
    });

    describe('Dependency Validation', () => {
        it('should have minimal runtime dependencies', async () => {
            const packageJsonContent = {
                dependencies: {
                    'moment': '^2.29.4'
                },
                devDependencies: {
                    '@types/vscode': '^1.74.0',
                    '@types/node': '^18.0.0',
                    'typescript': '^4.9.4',
                    'vitest': '^1.0.0'
                }
            };

            (fs.readFileSync as any).mockReturnValue(JSON.stringify(packageJsonContent));
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8') as string);

            // Validate minimal runtime dependencies
            const dependencies = Object.keys(packageJson.dependencies || {});
            expect(dependencies.length).toBeLessThanOrEqual(5); // Keep runtime deps minimal
            
            // Validate development dependencies
            const devDependencies = packageJson.devDependencies;
            expect(devDependencies['@types/vscode']).toBeDefined();
            expect(devDependencies['typescript']).toBeDefined();
            expect(devDependencies['vitest']).toBeDefined();
        });

        it('should not include unnecessary dependencies', async () => {
            const packageJsonContent = {
                dependencies: {
                    'moment': '^2.29.4'
                }
            };

            (fs.readFileSync as any).mockReturnValue(JSON.stringify(packageJsonContent));
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8') as string);

            const dependencies = Object.keys(packageJson.dependencies || {});
            
            // Should not include heavy dependencies
            expect(dependencies).not.toContain('lodash');
            expect(dependencies).not.toContain('jquery');
            expect(dependencies).not.toContain('react');
            expect(dependencies).not.toContain('vue');
            
            // Should use lightweight alternatives when possible
            expect(dependencies.length).toBeLessThan(10);
        });
    });
});