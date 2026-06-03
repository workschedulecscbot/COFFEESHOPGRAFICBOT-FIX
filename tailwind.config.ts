import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: ['class', '.dark'],
  plugins: [
    function ({ addVariant }) {
      // Имитируем поведение @custom-variant dark (&:where(.dark, .dark *));
      addVariant('dark', ({ container }) => {
        container.walkRules(rule => {
          rule.selector = `:where(.dark, .dark *) ${rule.selector}`;
        });
      });
    },
  ],
};

export default config;
