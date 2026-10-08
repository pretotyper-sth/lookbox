import json
import random
import threading
from collections import OrderedDict
from functools import lru_cache
from pathlib import Path


REFERENCE_DIR = Path(__file__).resolve().parents[1] / "assets" / "look-references"
REFERENCE_REV = "studio-snap-gender-reviewed-v2"
_DECKS: OrderedDict = OrderedDict()
_DECK_LOCK = threading.Lock()
_RANDOM = random.SystemRandom()


@lru_cache(maxsize=1)
def reference_catalog() -> tuple[dict, ...]:
    path = REFERENCE_DIR / "catalog.json"
    if not path.is_file():
        return ()
    data = json.loads(path.read_text())
    return tuple(
        row for row in data["references"]
        if row.get("gender") in ("m", "f")
        and Path(row["file"]).name == row["file"]
        and (REFERENCE_DIR / row["file"]).is_file()
    )


def choose_studio_reference(gender: str, user_id: str) -> dict | None:
    pool = [row for row in reference_catalog() if row["gender"] == gender]
    if not pool:
        return None
    key = (user_id, gender)
    with _DECK_LOCK:
        deck, previous = _DECKS.pop(key, ([], None))
        if not deck:
            deck = pool[:]
            _RANDOM.shuffle(deck)
            if len(deck) > 1 and deck[-1]["id"] == previous:
                deck[0], deck[-1] = deck[-1], deck[0]
        reference = deck.pop()
        _DECKS[key] = (deck, reference["id"])
        if len(_DECKS) > 256:
            _DECKS.popitem(last=False)
    return {**reference, "path": REFERENCE_DIR / reference["file"]}
