/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  // 忽略 Prisma 和数据库相关测试（需要真实 DB）
  testPathIgnorePatterns: [],
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/api/**/*.ts',
    '!src/**/*.d.ts',
  ],
};
