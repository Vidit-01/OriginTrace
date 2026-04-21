import json
import os
import threading
from pathlib import Path
from typing import Any, Dict, Optional

class PersistentCache:
    def __init__(self, file_path: Path):
        self.file_path = file_path
        self._lock = threading.Lock()
        self._cache: Dict[str, Any] = self._load()

    def _load(self) -> Dict[str, Any]:
        if not self.file_path.exists():
            return {}
        try:
            with self.file_path.open("r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _save(self):
        try:
            with self.file_path.open("w", encoding="utf-8") as f:
                json.dump(self._cache, f, indent=2)
        except Exception as e:
            print(f"Error saving cache: {e}")

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            return self._cache.get(key)

    def set(self, key: str, value: Any):
        with self._lock:
            self._cache[key] = value
            self._save()

    def clear(self):
        with self._lock:
            self._cache = {}
            self._save()
