# Internationalization (i18n) Setup

## Overview

The FairArena home page now supports **5 languages** with full accessibility:

- 🇬🇧 English (en)
- 🇪🇸 Spanish (es)
- 🇮🇳 Hindi (hi)
- 🇫🇷 French (fr)
- 🇩🇪 German (de)

## Features

### ✅ Accessibility (WCAG 2.1 AA Compliant)

- **ARIA Labels**: All interactive elements have proper `aria-label` attributes
- **Semantic HTML**: Uses `<section>`, `<header>`, `<nav>` with proper heading hierarchy
- **Keyboard Navigation**: Full keyboard support with visible focus indicators
- **Screen Reader Support**: Proper `role` attributes and `aria-labelledby` references
- **Language Attributes**: `lang` attribute on language selector buttons
- **Focus Management**: Focus rings with `focus:ring-2` and `focus:ring-offset-2`

### 🌍 Internationalization

- **Auto-detection**: Automatically detects user's browser language
- **Persistence**: Saves language preference to localStorage
- **Fallback**: Defaults to English if translation not available
- **Language Selector**: Fixed-position dropdown in top-right corner

## File Structure

```
src/
├── i18n/
│   └── config.ts          # i18n configuration and translations
├── components/
│   └── LanguageSelector.tsx  # Language switcher component
└── pages/
    └── Home.tsx           # Internationalized home page
```

## Usage

### Adding New Languages

1. **Add translation to `src/i18n/config.ts`**:

```typescript
const resources = {
  // ... existing languages
  ja: {
    // Japanese
    translation: {
      home: {
        hero: {
          title: 'AI駆動のハッカソン管理プラットフォーム',
          // ... more translations
        },
      },
    },
  },
};
```

2. **Add language to selector in `src/components/LanguageSelector.tsx`**:

```typescript
const languages = [
  // ... existing languages
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
];
```

### Using Translations in Components

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <h1>{t('home.hero.title')}</h1>
  );
}
```

### Changing Language Programmatically

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { i18n } = useTranslation();

  const changeToSpanish = () => {
    i18n.changeLanguage('es');
  };

  return <button onClick={changeToSpanish}>Español</button>;
}
```

## Accessibility Checklist

✅ All text has sufficient color contrast (4.5:1 minimum)
✅ Focus indicators visible on all interactive elements
✅ Keyboard navigation works throughout the page
✅ Screen readers can navigate using landmarks
✅ All images have alt text (icons use `aria-hidden="true"`)
✅ Headings follow proper hierarchy (h1 → h2 → h3)
✅ Form inputs have associated labels
✅ Language can be changed without page reload
✅ ARIA labels describe button purposes
✅ Links have descriptive text

## Testing

### Manual Testing

1. **Keyboard Navigation**: Tab through all interactive elements
2. **Screen Reader**: Test with NVDA (Windows) or VoiceOver (Mac)
3. **Language Switching**: Change language and verify all text updates
4. **Focus Indicators**: Ensure focus rings are visible
5. **Color Contrast**: Use browser DevTools to check contrast ratios

### Automated Testing

```bash
# Install axe-core for accessibility testing
pnpm add -D @axe-core/react

# Run accessibility audit
pnpm test:a11y
```

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Translations are bundled (no runtime fetching)
- Language detection happens once on mount
- No layout shift when changing languages
- Optimized with React.memo where appropriate

## Future Enhancements

- [ ] Add more languages (Portuguese, Chinese, Japanese, Korean)
- [ ] Implement lazy loading for translation files
- [ ] Add RTL (Right-to-Left) support for Arabic/Hebrew
- [ ] Create translation management dashboard
- [ ] Add pluralization support
- [ ] Implement date/time localization
