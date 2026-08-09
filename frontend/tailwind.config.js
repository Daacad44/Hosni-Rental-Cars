/**
 * Tailwind maps to the CSS-variable design tokens in styles/tokens.css.
 * No raw hex in components, and no default palette classes (blue-*, indigo-*,
 * violet-*) as brand colour — only these token-backed names.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          100: 'var(--color-primary-100)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          600: 'var(--color-accent-600)',
        },
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          alt: 'var(--color-surface-alt)',
        },
        border: 'var(--color-border)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        'on-accent': 'var(--color-on-accent)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        xs: ['12px', '1.5'],
        sm: ['14px', '1.5'],
        base: ['16px', '1.5'],
        lg: ['18px', '1.5'],
        xl: ['24px', '1.3'],
        '2xl': ['32px', '1.2'],
      },
      spacing: {
        row: '44px',
        sidebar: '240px',
        topbar: '56px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.08)',
        float: '0 8px 24px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};
