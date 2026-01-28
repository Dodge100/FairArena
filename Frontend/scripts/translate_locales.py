import json
import os
import time
import hashlib
import subprocess
from deep_translator import GoogleTranslator

# Configuration
SOURCE_FILE = 'Frontend/src/i18n/locales/en.json'
LOCALES_DIR = 'Frontend/src/i18n/locales'
HASHES_FILE = os.path.join(LOCALES_DIR, 'source_hashes.json')
TARGET_LANGS = ['fr', 'es', 'de', 'hi']
BATCH_SIZE = 50

# Global translators cache
TRANSLATORS = {}

def get_translator(lang):
    if lang not in TRANSLATORS:
        TRANSLATORS[lang] = GoogleTranslator(source='en', target=lang)
    return TRANSLATORS[lang]

def load_json(path):
    if not os.path.exists(path):
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error reading {path}: {e}")
        return {}

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')

def flatten_data(data, prefix=''):
    """
    Flattens a dictionary/list into a single dict of dot-notation keys.
    Compatible with set_nested_value format.
    """
    flat = {}
    if isinstance(data, dict):
        for key, value in data.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if isinstance(value, (dict, list)):
                flat.update(flatten_data(value, full_key))
            else:
                flat[full_key] = str(value)
    elif isinstance(data, list):
        for i, item in enumerate(data):
            full_key = f"{prefix}[{i}]"
            if isinstance(item, (dict, list)):
                flat.update(flatten_data(item, full_key))
            else:
                flat[full_key] = str(item)
    else:
        # Should be covered by parents, but for safety
        flat[prefix] = str(data)
    return flat

def get_hashes(flat_data):
    """
    Returns a dict of key -> md5 hash of value.
    """
    hashes = {}
    for k, v in flat_data.items():
        hashes[k] = hashlib.md5(v.encode('utf-8')).hexdigest()
    return hashes

def get_git_old_content(path, revision='HEAD~1'):
    """
    Tries to fetch the content of the file from a previous git revision.
    """
    # Convert path to posix for git if needed (Windows accepts / too)
    git_path = path.replace('\\', '/')
    cmd = ['git', 'show', f'{revision}:{git_path}']
    try:
        # Run command gracefully
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        if result.returncode == 0:
            return json.loads(result.stdout)
    except Exception as e:
        # Don't crash if git is missing or fails
        print(f"  [Info] Git fallback failed (this is normal if no git history): {e}")
    return None

def set_nested_value(data, key_path, value):
    """
    Sets a value in a nested dict/list using dot notation (e.g. "a.b[0].c")
    Autocreates intermediate dicts/lists if missing.
    """
    parts = []
    current_part = ""
    for char in key_path:
        if char == '.':
            if current_part: parts.append(current_part)
            current_part = ""
        elif char == '[':
            if current_part: parts.append(current_part)
            current_part = ""
        elif char == ']':
            pass
        else:
            current_part += char
    if current_part: parts.append(current_part)

    current = data
    for i, part in enumerate(parts[:-1]):
        next_part = parts[i+1]
        next_is_idx = next_part.isdigit()

        if part.isdigit():
            part_idx = int(part)
            while len(current) <= part_idx:
                current.append({})

            # Type check correction if needed could happen here
            current = current[part_idx]
        else:
            if part not in current:
                current[part] = [] if next_is_idx else {}
            current = current[part]

    # Set final value
    last_part = parts[-1]
    if last_part.isdigit():
        idx = int(last_part)
        while len(current) <= idx:
            current.append(None)
        current[idx] = value
    else:
        current[last_part] = value

def batch_translate(texts, target_lang):
    """
    Translates a list of texts in batches.
    """
    if not texts:
        return []

    translator = get_translator(target_lang)
    translated = []

    print(f"  Translating {len(texts)} strings in batches of {BATCH_SIZE}...")

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        try:
            results = translator.translate_batch(batch)
            translated.extend(results)
            print(f"    Batch {i//BATCH_SIZE + 1} done")
            time.sleep(1) # Be nice to the scraper
        except Exception as e:
            print(f"    Error in batch {i}: {e}. Skipping batch.")
            translated.extend(batch) # Fallback to original

    return translated

def main():
    print(f"Loading source: {SOURCE_FILE}")
    source_data = load_json(SOURCE_FILE)
    if not source_data:
        print("Source file empty or missing!")
        return

    flat_source = flatten_data(source_data)
    current_hashes = get_hashes(flat_source)

    # Check for changes
    changed_keys = set()
    old_hashes = load_json(HASHES_FILE)

    if not old_hashes:
        print("  No existing hash file found. Attempting to detect recent changes via Git...")
        # Try to get previous version from Git to compare
        old_content = get_git_old_content(SOURCE_FILE)
        if old_content:
            print("  Git history found. Comparing with HEAD~1...")
            flat_old = flatten_data(old_content)
            old_hashes = get_hashes(flat_old)
        else:
            print("  Could not retrieve old version from Git. Assuming initial sync (only truly missing keys will be added).")
            old_hashes = current_hashes # Treat current as baseline to avoid overwriting everything on first run

    # Identify changed keys
    if old_hashes:
        for k, h in current_hashes.items():
            if k in old_hashes and old_hashes[k] != h:
                changed_keys.add(k)

    if changed_keys:
        print(f"  Detected {len(changed_keys)} changed source keys (based on hash comparison).")
    else:
        print("  No changed keys detected.")

    for lang in TARGET_LANGS:
        target_file = os.path.join(LOCALES_DIR, f"{lang}.json")
        print(f"Processing {lang}...")
        target_data = load_json(target_file)
        flat_target = flatten_data(target_data)

        # 1. Missing Keys (in source but not in target)
        missing_keys = [k for k in flat_source if k not in flat_target]

        # 2. Changed Keys (content changed)
        # We process changed keys even if they exist in target
        keys_to_translate = list(set(missing_keys) | changed_keys)

        if not keys_to_translate:
            print(f"  No updates needed for {lang}.")
            continue

        print(f"  Updating {len(keys_to_translate)} keys ({len(missing_keys)} missing, {len(changed_keys)} changed/stale)...")

        # Prepare text list (order matters for batch_translate)
        texts_to_translate = [flat_source[k] for k in keys_to_translate]

        translated_texts = batch_translate(texts_to_translate, lang)

        # Apply updates
        for key, text in zip(keys_to_translate, translated_texts):
            set_nested_value(target_data, key, text)

        print(f"  Saving updates to {target_file}")
        save_json(target_file, target_data)

    print(f"Updating source hashes to {HASHES_FILE}")
    save_json(HASHES_FILE, current_hashes)

if __name__ == "__main__":
    main()
