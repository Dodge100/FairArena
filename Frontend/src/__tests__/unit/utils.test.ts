/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

/**
 * utils.test.ts
 *
 * Tests for cn, cnWithAnimations, shouldLoadImage, shouldAutoRefresh
 * from src/lib/utils.ts.
 */
import { describe, expect, it } from 'vitest';
import { cn, cnWithAnimations, shouldAutoRefresh, shouldLoadImage } from '../../lib/utils';

// ════════════════════════════════════════════════════════════════════════════
// cn
// ════════════════════════════════════════════════════════════════════════════
describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional falsy values', () => {
    const showBar = false;
    expect(cn('foo', showBar && 'bar', 'baz')).toBe('foo baz');
  });

  it('deduplicates via twMerge (tailwind conflicts resolved)', () => {
    // twMerge resolves conflicting Tailwind classes: last one wins
    const result = cn('p-4', 'p-8');
    expect(result).toBe('p-8');
  });

  it('handles undefined/null gracefully', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('handles arrays', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });

  it('handles objects (clsx syntax)', () => {
    expect(cn({ active: true, disabled: false })).toBe('active');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// cnWithAnimations
// ════════════════════════════════════════════════════════════════════════════
describe('cnWithAnimations', () => {
  const ENABLED = { enabled: true, reduceAnimations: true };
  const DISABLED = { enabled: false, reduceAnimations: false };
  const PARTIAL = { enabled: true, reduceAnimations: false };

  it('passes through classes unchanged when data saver is disabled', () => {
    const result = cnWithAnimations(DISABLED, 'transition-all', 'animate-spin', 'text-red-500');
    expect(result).toContain('transition-all');
    expect(result).toContain('animate-spin');
  });

  it('strips animation-related classes when reduceAnimations is on', () => {
    const result = cnWithAnimations(ENABLED, 'transition-all duration-300 animate-spin');
    expect(result).not.toContain('transition-all');
    expect(result).not.toContain('duration-300');
    expect(result).not.toContain('animate-spin');
  });

  it('preserves non-animation classes when reduceAnimations is on', () => {
    const result = cnWithAnimations(ENABLED, 'text-white bg-primary transition-all');
    expect(result).toContain('text-white');
    expect(result).toContain('bg-primary');
    expect(result).not.toContain('transition');
  });

  it('strips hover: classes when reduceAnimations is on', () => {
    const result = cnWithAnimations(ENABLED, 'hover:scale-105 text-lg');
    expect(result).not.toContain('hover:scale-105');
    expect(result).toContain('text-lg');
  });

  it('strips motion and group-hover: when reduceAnimations is on', () => {
    const result = cnWithAnimations(
      ENABLED,
      'motion-safe:animate-spin group-hover:opacity-100 block',
    );
    expect(result).not.toContain('motion-safe:animate-spin');
    expect(result).not.toContain('group-hover:opacity-100');
    expect(result).toContain('block');
  });

  it('passes through all classes when enabled=true but reduceAnimations=false', () => {
    const result = cnWithAnimations(PARTIAL, 'transition-all animate-spin text-sm');
    expect(result).toContain('transition-all');
    expect(result).toContain('animate-spin');
  });

  it('handles non-string class values without crashing', () => {
    expect(() =>
      cnWithAnimations(ENABLED, { active: true }, ['extra'], 'animate-bounce'),
    ).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// shouldLoadImage
// ════════════════════════════════════════════════════════════════════════════
describe('shouldLoadImage', () => {
  it('returns true when data saver is disabled', () => {
    expect(shouldLoadImage({ enabled: false, disableImages: true })).toBe(true);
  });

  it('returns false when data saver enabled AND disableImages = true', () => {
    expect(shouldLoadImage({ enabled: true, disableImages: true })).toBe(false);
  });

  it('returns true when data saver enabled but disableImages = false', () => {
    expect(shouldLoadImage({ enabled: true, disableImages: false })).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// shouldAutoRefresh
// ════════════════════════════════════════════════════════════════════════════
describe('shouldAutoRefresh', () => {
  it('returns true when data saver is disabled', () => {
    expect(shouldAutoRefresh({ enabled: false, disableAutoRefresh: true })).toBe(true);
  });

  it('returns false when data saver enabled AND disableAutoRefresh = true', () => {
    expect(shouldAutoRefresh({ enabled: true, disableAutoRefresh: true })).toBe(false);
  });

  it('returns true when data saver enabled but disableAutoRefresh = false', () => {
    expect(shouldAutoRefresh({ enabled: true, disableAutoRefresh: false })).toBe(true);
  });
});
