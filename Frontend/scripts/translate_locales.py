
import json
import os
from deep_translator import GoogleTranslator
from copy import deepcopy

# Configuration
SOURCE_FILE = 'Frontend/src/i18n/locales/en.json'
LOCALES_DIR = 'Frontend/src/i18n/locales'
TARGET_LANGS = ['fr', 'es', 'de', 'hi']

def load_json(path):
    if not os.path.exists(path):
        return {}
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n') # Add trailing newline

def translate_text(text, target_lang):
    try:
        # Use GoogleTranslator from deep_translator
        # It's a free scraper, might be slow or rate limited for large batches
        translator = GoogleTranslator(source='en', target=target_lang)
        return translator.translate(text)
    except Exception as e:
        print(f"Error translating '{text}' to {target_lang}: {e}")
        return text

def sync_keys(source, target, target_lang):
    """
    Recursively sync keys from source to target.
    If key missing in target, translate from source.
    If key exists, keep target (preserve manual edits).
    """
    updated = False

    # Handle dictionary (nested keys)
    if isinstance(source, dict):
        if not isinstance(target, dict):
            target = {} # Mismatch type, overwrite/reset to dict
            updated = True

        for key, value in source.items():
            if key not in target:
                print(f"[{target_lang}] New key found: {key}")
                if isinstance(value, (dict, list)):
                    # Initialize empty and recurse
                    target[key] = {} if isinstance(value, dict) else []
                    _, sub_updated = sync_keys(value, target[key], target_lang)
                else:
                    # Translate leaf value
                    target[key] = translate_text(str(value), target_lang)
                updated = True
            else:
                # Key exists, recurse to check sub-keys
                _, sub_updated = sync_keys(value, target[key], target_lang)
                if sub_updated:
                    updated = True

        return target, updated

    # Handle lists
    elif isinstance(source, list):
        if not isinstance(target, list):
            target = []
            updated = True

        # Basic list handling:
        # If source list is longer, translate new items.
        # If strict matching is needed, it's harder.
        # We will assume list indices correspond.

        for i, item in enumerate(source):
            if i >= len(target):
                print(f"[{target_lang}] New list item at index {i}")
                if isinstance(item, (dict, list)):
                     # Initialize and recurse
                    new_item = {} if isinstance(item, dict) else []
                    synced_item, _ = sync_keys(item, new_item, target_lang)
                    target.append(synced_item)
                else:
                    target.append(translate_text(str(item), target_lang))
                updated = True
            else:
                 # Item exists, recurse
                _, sub_updated = sync_keys(item, target[i], target_lang)
                if sub_updated:
                    updated = True

        return target, updated

    else:
        # Leaf node (string/number/etc)
        # If we reached here in recursion but target exists, we preserve it.
        # This function is usually called with collections, but if called with scalar, just return it.
        return target, updated

def main():
    print(f"Loading source: {SOURCE_FILE}")
    source_data = load_json(SOURCE_FILE)

    for lang in TARGET_LANGS:
        target_file = os.path.join(LOCALES_DIR, f"{lang}.json")
        print(f"Processing {lang} ({target_file})...")

        target_data = load_json(target_file)

        # Sync
        synced_data, updated = sync_keys(source_data, target_data, lang)

        if updated:
            print(f"Saving updates to {target_file}")
            save_json(target_file, synced_data)
        else:
            print(f"No changes for {lang}")

if __name__ == "__main__":
    main()
