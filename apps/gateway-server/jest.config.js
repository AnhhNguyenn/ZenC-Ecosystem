/** @type {import('jest').Config} */
const config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '@entities/(.*)': '<rootDir>/entities/$1',
    '@common/(.*)': '<rootDir>/common/$1',
    '@auth/(.*)': '<rootDir>/auth/$1',
    '@voice/(.*)': '<rootDir>/voice/$1',
    '@admin/(.*)': '<rootDir>/admin/$1',
    '@security/(.*)': '<rootDir>/security/$1',
  },
};

module.exports = config;
