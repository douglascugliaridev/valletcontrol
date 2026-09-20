import type { Config } from 'jest';

export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  // Mascara o NestJS (v12 é ESM-only) nos testes unitários: os use cases
  // e hasher só usam @Injectable(), que é pass-through no stub.
  moduleNameMapper: {
    '^@nestjs/common$': '<rootDir>/test/nestjs-common.stub.ts',
  },
  collectCoverageFrom: ['**/*.use-case.ts', '**/*.hasher.ts', '**/enum-mapper.ts'],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov'],
  testEnvironment: 'node',
} satisfies Config;
