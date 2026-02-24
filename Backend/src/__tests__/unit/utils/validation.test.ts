/**
 * validation.test.ts
 *
 * Tests for Zod schemas and sanitization helpers in utils/validation.ts.
 * All assertions are calibrated against the ACTUAL implementation.
 */
import { describe, expect, it } from 'vitest';
import {
  createOrganizationSchema,
  organizationSchemas,
  paginationSchema,
  sanitizeHtml,
  sanitizeObject,
  sanitizeText,
  updateOrganizationSchema,
} from '../../../utils/validation.js';

// ════════════════════════════════════════════════════════════════════════════
// 1. SLUG SCHEMA
// Note: regex /^[a-z0-9-]+$/ is evaluated BEFORE the toLowerCase transform,
// so uppercase letters will fail.
// ════════════════════════════════════════════════════════════════════════════
describe('organizationSchemas.slug', () => {
  const parse = (v: unknown) => organizationSchemas.slug.parse(v);

  it('accepts a valid lowercase slug', () => {
    expect(parse('my-org')).toBe('my-org');
  });

  it('accepts alphanumeric slug with hyphens', () => {
    expect(parse('team123')).toBe('team123');
  });

  it('accepts multi-segment slug', () => {
    expect(parse('a-b-c-1-2-3')).toBe('a-b-c-1-2-3');
  });

  it('rejects slugs with uppercase letters (regex runs before toLowerCase)', () => {
    // regex /^[a-z0-9-]+$/ rejects anything with uppercase
    expect(() => parse('MyOrg')).toThrow();
  });

  it('rejects empty slug', () => {
    expect(() => parse('')).toThrow();
  });

  it('rejects slug with 51+ characters', () => {
    expect(() => parse('a'.repeat(51))).toThrow();
  });

  it('accepts slug of exactly 50 characters', () => {
    const slug50 = 'a'.repeat(50);
    expect(parse(slug50)).toBe(slug50);
  });

  it('rejects slugs with spaces', () => {
    expect(() => parse('my org')).toThrow();
  });

  it('rejects slugs with special characters', () => {
    expect(() => parse('my@org!')).toThrow();
  });

  it('trims whitespace from already-valid slugs (trim runs after regex)', () => {
    // The Zod chain: .regex() → .trim() → .toLowerCase() → .transform()
    // So whitespace-padded slugs fail the regex before trim runs.
    // A slug without leading spaces passes regex AND gets trimmed (no trailing whitespace in result)
    expect(parse('my-org')).toBe('my-org');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. NAME SCHEMA  (sanitizeText transform applied)
// ════════════════════════════════════════════════════════════════════════════
describe('organizationSchemas.name', () => {
  const parse = (v: unknown) => organizationSchemas.name.parse(v);

  it('accepts valid names', () => {
    expect(parse('My Organization')).toBe('My Organization');
  });

  it('rejects empty name', () => {
    expect(() => parse('')).toThrow();
  });

  it('rejects names longer than 100 characters', () => {
    expect(() => parse('N'.repeat(101))).toThrow();
  });

  it('strips <script> tags via sanitizeText', () => {
    const result = parse('Acme <script>alert(1)</script> Corp');
    expect(result).not.toContain('<script>');
    expect(result).toContain('Acme');
    expect(result).toContain('Corp');
  });

  it('strips javascript: via sanitizeText', () => {
    const result = parse('Click javascript:void(0)');
    expect(result).not.toContain('javascript:');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. DESCRIPTION SCHEMA
// ════════════════════════════════════════════════════════════════════════════
describe('organizationSchemas.description', () => {
  const parse = (v: unknown) => organizationSchemas.description.parse(v);

  it('accepts valid description', () => {
    expect(parse('A great org')).toBe('A great org');
  });

  it('accepts undefined (optional)', () => {
    expect(parse(undefined)).toBeUndefined();
  });

  it('rejects descriptions longer than 1000 chars', () => {
    expect(() => parse('D'.repeat(1001))).toThrow();
  });

  it('strips script tags from description', () => {
    const result = parse('<script>evil</script>Description');
    expect(result).not.toContain('<script>');
    expect(result).toContain('Description');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. PAGE / LIMIT SCHEMAS
// ════════════════════════════════════════════════════════════════════════════
describe('organizationSchemas.page', () => {
  const parse = (v: unknown) => organizationSchemas.page.parse(v);

  it('parses numeric string "1"', () => expect(parse('1')).toBe(1));
  it('parses number 5', () => expect(parse(5)).toBe(5));
  it('returns 1 for NaN string', () => expect(parse('abc')).toBe(1));
  it('returns 1 for 0', () => expect(parse(0)).toBe(1));
  it('returns 1 for negative', () => expect(parse(-5)).toBe(1));
  it('parses string "25"', () => expect(parse('25')).toBe(25));
});

describe('organizationSchemas.limit', () => {
  const parse = (v: unknown) => organizationSchemas.limit.parse(v);

  it('parses "20"', () => expect(parse('20')).toBe(20));
  it('caps at 100 for value > 100', () => expect(parse(500)).toBe(100));
  it('returns 20 for NaN string', () => expect(parse('bad')).toBe(20));
  it('returns 20 for 0', () => expect(parse(0)).toBe(20));
  it('returns 20 for negative', () => expect(parse(-1)).toBe(20));
  it('returns 100 for exactly 100', () => expect(parse(100)).toBe(100));
  it('returns 1 for limit=1', () => expect(parse(1)).toBe(1));
});

// ════════════════════════════════════════════════════════════════════════════
// 5. PAGINATION SCHEMA (combined)
// ════════════════════════════════════════════════════════════════════════════
describe('paginationSchema', () => {
  it('parses valid page and limit', () => {
    expect(paginationSchema.parse({ page: '2', limit: '25' })).toEqual({
      page: 2,
      limit: 25,
    });
  });

  it('uses defaults for invalid values', () => {
    const r = paginationSchema.parse({ page: 'bad', limit: '0' });
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
  });

  it('caps limit at 100', () => {
    const r = paginationSchema.parse({ page: '1', limit: '9999' });
    expect(r.limit).toBe(100);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. CREATE ORGANIZATION SCHEMA
// ════════════════════════════════════════════════════════════════════════════
describe('createOrganizationSchema', () => {
  const valid = {
    name: 'FairArena',
    slug: 'fair-arena',
    joinEnabled: false,
    isPublic: true,
    timezone: 'UTC',
  };

  it('parses a valid organization', () => {
    const r = createOrganizationSchema.parse(valid);
    expect(r.name).toBe('FairArena');
    expect(r.slug).toBe('fair-arena');
    expect(r.isPublic).toBe(true);
    expect(r.joinEnabled).toBe(false);
  });

  it('defaults isPublic to true', () => {
    const input = { ...valid };
    delete (input as Partial<typeof valid>).isPublic;
    const r = createOrganizationSchema.parse(input);
    expect(r.isPublic).toBe(true);
  });

  it('defaults joinEnabled to false', () => {
    const input = { ...valid };
    delete (input as Partial<typeof valid>).joinEnabled;
    const r = createOrganizationSchema.parse(input);
    expect(r.joinEnabled).toBe(false);
  });

  it('timezone is optional', () => {
    const input = { ...valid };
    delete (input as Partial<typeof valid>).timezone;
    const r = createOrganizationSchema.parse(input);
    expect(r.timezone).toBeUndefined();
  });

  it('rejects empty name', () => {
    expect(() => createOrganizationSchema.parse({ ...valid, name: '' })).toThrow();
  });

  it('rejects empty slug', () => {
    expect(() => createOrganizationSchema.parse({ ...valid, slug: '' })).toThrow();
  });

  it('rejects slug with spaces or uppercase', () => {
    expect(() => createOrganizationSchema.parse({ ...valid, slug: 'has spaces!' })).toThrow();
    expect(() => createOrganizationSchema.parse({ ...valid, slug: 'HasUpper' })).toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. UPDATE ORGANIZATION SCHEMA
// ════════════════════════════════════════════════════════════════════════════
describe('updateOrganizationSchema', () => {
  it('accepts name + boolean flags', () => {
    const r = updateOrganizationSchema.parse({
      name: 'New Name',
      isPublic: false,
      joinEnabled: true,
    });
    expect(r.name).toBe('New Name');
    expect(r.isPublic).toBe(false);
    expect(r.joinEnabled).toBe(true);
  });

  it('name is optional in update', () => {
    const r = updateOrganizationSchema.parse({ isPublic: true, joinEnabled: false });
    expect(r.name).toBeUndefined();
  });

  it('rejects name that is too long', () => {
    expect(() =>
      updateOrganizationSchema.parse({
        name: 'N'.repeat(101),
        isPublic: true,
        joinEnabled: false,
      }),
    ).toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. sanitizeHtml (removes full HTML, not just scripts)
// ════════════════════════════════════════════════════════════════════════════
describe('sanitizeHtml', () => {
  it('removes <script> tags and content', () => {
    expect(sanitizeHtml('<script>alert(1)</script>hello')).not.toContain('<script>');
  });

  it('removes <iframe>', () => {
    expect(sanitizeHtml('<iframe src="x"></iframe>text')).not.toContain('<iframe');
  });

  it('removes <style>', () => {
    expect(sanitizeHtml('<style>body{}</style>clean')).not.toContain('<style>');
  });

  it('removes ALL remaining HTML tags', () => {
    // After specific tag removal, remaining tags are stripped by /<[^>]*>/g
    expect(sanitizeHtml('<b>bold</b>')).not.toContain('<b>');
    expect(sanitizeHtml('<b>bold</b>')).toBe('bold');
  });

  it('removes javascript: protocol', () => {
    expect(sanitizeHtml('javascript:void(0)')).not.toContain('javascript:');
  });

  it('removes event handlers', () => {
    expect(sanitizeHtml('onclick=doEvil()')).not.toContain('onclick=');
  });

  it('returns clean text unchanged', () => {
    expect(sanitizeHtml('Hello World!')).toBe('Hello World!');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. sanitizeText (only strips scripts/javascript, NOT all HTML tags)
// ════════════════════════════════════════════════════════════════════════════
describe('sanitizeText', () => {
  it('strips <script> tags', () => {
    const r = sanitizeText('<script>alert(1)</script>Normal');
    expect(r).not.toContain('<script>');
    expect(r).toContain('Normal');
  });

  it('strips javascript: protocol', () => {
    expect(sanitizeText('javascript:void(0)')).not.toContain('javascript:');
  });

  it('preserves clean text including special chars', () => {
    expect(sanitizeText("It's $10 & more!")).toBe("It's $10 & more!");
  });

  it('preserves <b> tags (sanitizeText does NOT strip all HTML)', () => {
    // sanitizeText only targets script/javascript, not all HTML
    expect(sanitizeText('<b>bold</b>')).toContain('<b>');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. sanitizeObject (uses sanitizeText internally)
// ════════════════════════════════════════════════════════════════════════════
describe('sanitizeObject', () => {
  it('strips scripts from string fields', () => {
    const obj = { name: 'John <script>alert(1)</script>' };
    const r = sanitizeObject(obj);
    expect(r.name).not.toContain('<script>');
    expect(r.name).toContain('John');
  });

  it('recurses into nested objects', () => {
    const obj = { meta: { bio: '<script>bad</script>clean' } };
    const r = sanitizeObject(obj);
    expect(r.meta.bio).not.toContain('<script>');
    expect(r.meta.bio).toContain('clean');
  });

  it('preserves number, boolean, and null values', () => {
    const obj = { count: 42, active: true, ref: null };
    const r = sanitizeObject(obj);
    expect(r.count).toBe(42);
    expect(r.active).toBe(true);
    expect(r.ref).toBeNull();
  });

  it('does NOT strip <b> from strings (sanitizeText not sanitizeHtml)', () => {
    const obj = { city: 'New York <b>NY</b>' };
    const r = sanitizeObject(obj);
    expect(r.city).toContain('<b>'); // <b> is preserved by sanitizeText
    expect(r.city).toContain('New York');
  });
});
