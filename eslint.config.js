import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Der Spielzustand nutzt bewusst JSON-Objekte als Maps (ID -> Entität), damit er
      // serialisierbar bleibt; Entfernen per delete ist dort beabsichtigt.
      '@typescript-eslint/no-dynamic-delete': 'off',
    },
  },
  {
    // Die Simulation muss headless und deterministisch bleiben (CLAUDE.md §5.1).
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@angular/*', 'phaser', 'phaser/*', 'electron', 'electron/*'] },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Nur den geseedeten RNG aus sim/rng.ts verwenden.' },
        { object: 'Date', property: 'now', message: 'Spielzeit kommt aus state.time, nicht aus der Systemuhr.' },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage'],
    },
  },
);
