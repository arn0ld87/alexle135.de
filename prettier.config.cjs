/** @type {import('prettier').Config} */
module.exports = {
  semi: true,
  singleQuote: true,
  printWidth: 100,
  trailingComma: 'es5',
  overrides: [
    {
      files: '*.astro',
      options: {
        printWidth: 100,
      },
    },
  ],
};
