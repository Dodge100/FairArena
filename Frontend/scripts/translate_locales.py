import json
import os
import time
from deep_translator import GoogleTranslator

# Configuration
SOURCE_FILE = 'Frontend/src/i18n/locales/en.json'
LOCALES_DIR = 'Frontend/src/i18n/locales'
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

def extract_missing_keys(source, target, prefix=''):
    """
    Recursively find keys present in source but missing in target.
    Returns a list of tuples: (dot_notation_key, text_to_translate)
    """
    missing = []

    if isinstance(source, dict):
        target_dict = target if isinstance(target, dict) else {}

        for key, value in source.items():
            full_key = f"{prefix}.{key}" if prefix else key

            if key not in target_dict:
                if isinstance(value, (dict, list)):
                    missing.extend(extract_missing_keys(value, {}, full_key))
                else:
                    missing.append((full_key, str(value)))
            else:
                missing.extend(extract_missing_keys(value, target_dict[key], full_key))

    elif isinstance(source, list):
        target_list = target if isinstance(target, list) else []

        for i, item in enumerate(source):
            full_key = f"{prefix}[{i}]"

            if i >= len(target_list):
                 if isinstance(item, (dict, list)):
                    missing.extend(extract_missing_keys(item, {}, full_key))
                 else:
                    missing.append((full_key, str(item)))
            else:
                missing.extend(extract_missing_keys(item, target_list[i], full_key))

    else:
        # Scalar value not in list/dict handled by parent calls
        pass

    return missing

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
            # For now assume structure matches source
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

    for lang in TARGET_LANGS:
        target_file = os.path.join(LOCALES_DIR, f"{lang}.json")
        print(f"Processing {lang}...")

        target_data = load_json(target_file)

        # 1. Identify missing content
        missing_entries = extract_missing_keys(source_data, target_data)

        if not missing_entries:
            print(f"  No missing keys for {lang}. Skipping.")
            continue

        print(f"  Found {len(missing_entries)} missing keys.")

        # 2. Extract texts to translate
        keys_to_update = [entry[0] for entry in missing_entries]
        texts_to_translate = [entry[1] for entry in missing_entries]

        # 3. Batch translate
        translated_texts = batch_translate(texts_to_translate, lang)

        # 4. Apply back to target data
        for key, text in zip(keys_to_update, translated_texts):
            set_nested_value(target_data, key, text)

        print(f"  Saving updates to {target_file}")
        save_json(target_file, target_data)

if __name__ == "__main__":
    main()
