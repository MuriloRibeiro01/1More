// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'coverage/*'],
  },
  {
    // Regras do Design System: cor só via theme.ts e peso só via fontFamily.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/theme.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message: 'Cor solta: use os tokens de src/theme/theme.ts (useTheme().colors).',
        },
        {
          selector: 'Literal[value=/^(rgb|hsl)a?\\(/]',
          message: 'Cor solta: use os tokens de src/theme/theme.ts (useTheme().colors).',
        },
        {
          selector: 'Property[key.name="fontWeight"]',
          message: 'No RN o peso vem do fontFamily (theme.ts > type). Nunca use fontWeight.',
        },
        {
          selector: 'Property[key.name=/^(elevation|shadowRadius|shadowOpacity)$/]',
          message: 'Sem sombra difusa no Design System (use a borda de folha empilhada).',
        },
      ],
    },
  },
]);
