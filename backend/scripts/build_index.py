"""
CLI script to (re)build the Chroma knowledge-base index.

Usage:
    python scripts/build_index.py
    python scripts/build_index.py --env-file .env.staging
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import Settings
from app.services.factory import create_assistant


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebuild the Codixel Chroma index.")
    parser.add_argument("--env-file", default=".env", help="Path to .env file (default: .env)")
    args = parser.parse_args()

    print(f"Loading settings from: {args.env_file}")
    settings = Settings.from_env(env_file=args.env_file)

    print("Building index — this will crawl the website and process documents…")
    create_assistant(settings, rebuild_index=True)
    print("Done. Index saved to:", settings.chroma_path)


if __name__ == "__main__":
    main()
