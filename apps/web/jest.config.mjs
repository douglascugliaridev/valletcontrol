const config = {
  roots: ['<rootDir>'],
  modulePaths: ['<rootDir>'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@valletcontrol/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@valletcontrol/config(.*)$': '<rootDir>/../../packages/config$1',
  },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testEnvironment: 'node',
};

export default config;
