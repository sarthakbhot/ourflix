#!/usr/bin/env python3

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".ogg"}
SPECIAL_IMAGE_PREFIXES = ("profile", "avatar", "dp", "hero", "cover", "banner")

TITLES = [
    "You, Me, and the Softest Plot Twist",
    "The Part Where I Smile Again",
    "Main Character Energy Detected",
    "A Tiny Scene With Huge Feelings",
    "This One Needed Its Own Poster",
    "The Moment That Still Wins",
    "The Scene I Would Never Skip",
    "Proof We Were Ridiculously Cute",
]

CAPTIONS = [
    "One little memory with an unfair amount of emotional impact.",
    "Cute enough to deserve the full dramatic soundtrack treatment.",
    "A favorite frame from a chapter that somehow keeps getting better.",
    "Exactly the kind of moment that turns into a forever favorite.",
    "Soft, chaotic, adorable, and fully worth keeping forever.",
    "A scene that absolutely belongs in the permanent favorites list.",
]

ITEM_COPY_OVERRIDES = {
    "08-little-fish-keychains": {
        "title": "Cute Couple Keychains",
        "caption": "Just cute couple keychains.",
    },
}


@dataclass
class MonthConfig:
    id: str
    label: str
    short_label: str
    tagline: str
    description: str
    highlight: str
    status: str
    preview_title: str
    preview_caption: str
    profile_image: str | None = None
    hero_image: str | None = None
    items: list[dict] | None = None


def list_media(folder: Path, extensions: Iterable[str]) -> list[Path]:
    if not folder.exists():
        return []

    return sorted(
        [path for path in folder.iterdir() if path.is_file() and path.suffix.lower() in extensions],
        key=lambda path: path.name.lower(),
    )


def to_web_path(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def pick_preferred(paths: list[Path], prefixes: tuple[str, ...]) -> Path | None:
    lowered = tuple(prefix.lower() for prefix in prefixes)
    for path in paths:
        if path.stem.lower().startswith(lowered):
            return path

    return paths[0] if paths else None


def normalize_stem(path: Path) -> str:
    return re.sub(r"[^a-z0-9]+", "", path.stem.lower())


def is_special_image(path: Path) -> bool:
    return path.stem.lower().startswith(SPECIAL_IMAGE_PREFIXES)


def choose_gallery_images(image_paths: list[Path]) -> list[Path]:
    primary = [path for path in image_paths if not is_special_image(path)]
    if primary:
        return primary

    return [path for path in image_paths if is_special_image(path)]


def build_placeholder_item(month: MonthConfig, index: int) -> dict:
    return {
        "id": f"{month.id}-placeholder-{index + 1:02d}",
        "title": TITLES[index % len(TITLES)],
        "caption": CAPTIONS[index % len(CAPTIONS)],
        "kicker": f"Scene {index + 1:02d}",
        "image": None,
        "videoOptions": [],
    }


def build_item(
    image_path: Path,
    root: Path,
    month: MonthConfig,
    index: int,
    video_paths: list[Path],
) -> dict:
    cleaned_bits = [
        bit
        for bit in image_path.stem.replace("_", " ").replace("-", " ").split()
        if not bit.isdigit()
    ]
    derived_title = " ".join(bit.capitalize() for bit in cleaned_bits[:6]).strip()
    copy_override = ITEM_COPY_OVERRIDES.get(image_path.stem.lower(), {})
    title = derived_title if len(derived_title) >= 5 else TITLES[index % len(TITLES)]

    normalized_image = normalize_stem(image_path)
    matching_videos = [
        path for path in video_paths if normalize_stem(path).startswith(normalized_image)
    ]

    return {
        "id": f"{month.id}-memory-{index + 1:02d}",
        "title": copy_override.get("title", title),
        "caption": copy_override.get(
            "caption",
            CAPTIONS[(index + len(month.label)) % len(CAPTIONS)],
        ),
        "kicker": f"Scene {index + 1:02d}",
        "image": to_web_path(image_path, root),
        "videoOptions": [to_web_path(path, root) for path in matching_videos],
    }


def resolve_configured_path(web_path: str | None, root: Path) -> Path | None:
    if not web_path:
        return None

    path = root / web_path
    return path if path.is_file() else None


def build_configured_item(
    item_config: dict,
    root: Path,
    month: MonthConfig,
    index: int,
    video_paths: list[Path],
) -> dict:
    image_web_path = item_config.get("image")
    image_path = resolve_configured_path(image_web_path, root)
    matching_videos = []

    if image_path:
        normalized_image = normalize_stem(image_path)
        matching_videos = [
            path for path in video_paths if normalize_stem(path).startswith(normalized_image)
        ]

    configured_videos = item_config.get("videoOptions")
    video_options = (
        [str(path) for path in configured_videos]
        if configured_videos is not None
        else [to_web_path(path, root) for path in matching_videos]
    )

    return {
        "id": item_config.get("id") or f"{month.id}-memory-{index + 1:02d}",
        "title": item_config.get("title") or TITLES[index % len(TITLES)],
        "caption": item_config.get("caption") or CAPTIONS[index % len(CAPTIONS)],
        "kicker": item_config.get("kicker") or f"Scene {index + 1:02d}",
        "image": image_web_path if image_path else None,
        "videoOptions": video_options,
    }


def main() -> None:
    site_root = Path(__file__).resolve().parent.parent
    config_path = site_root / "data" / "config.json"
    output_path = site_root / "data" / "library.generated.json"

    config = json.loads(config_path.read_text(encoding="utf-8"))
    site = config["site"]
    months_config = [
        MonthConfig(
            id=entry["id"],
            label=entry["label"],
            short_label=entry["shortLabel"],
            tagline=entry["tagline"],
            description=entry["description"],
            highlight=entry["highlight"],
            status=entry["status"],
            preview_title=entry["previewTitle"],
            preview_caption=entry["previewCaption"],
            profile_image=entry.get("profileImage"),
            hero_image=entry.get("heroImage"),
            items=entry.get("items"),
        )
        for entry in config["months"]
    ]

    manifest_months = []

    for month in months_config:
        month_root = site_root / "media" / month.id
        image_paths = list_media(month_root / "images", IMAGE_EXTENSIONS)
        video_paths = list_media(month_root / "videos", VIDEO_EXTENSIONS)

        profile_image = resolve_configured_path(month.profile_image, site_root) or pick_preferred(
            image_paths, ("profile", "avatar", "dp")
        )
        hero_image = (
            resolve_configured_path(month.hero_image, site_root)
            or pick_preferred(image_paths, ("hero", "cover", "banner"))
            or profile_image
        )
        hero_video = pick_preferred(video_paths, ("trailer", "hero", "cover"))

        if month.items is not None:
            items = [
                build_configured_item(item_config, site_root, month, index, video_paths)
                for index, item_config in enumerate(month.items)
            ]
        else:
            gallery_images = choose_gallery_images(image_paths)
            items = [
                build_item(image_path, site_root, month, index, video_paths)
                for index, image_path in enumerate(gallery_images)
            ]

            while len(items) < 6:
                items.append(build_placeholder_item(month, len(items)))

        manifest_months.append(
            {
                "id": month.id,
                "label": month.label,
                "shortLabel": month.short_label,
                "tagline": month.tagline,
                "description": month.description,
                "highlight": month.highlight,
                "status": month.status,
                "previewTitle": month.preview_title,
                "previewCaption": month.preview_caption,
                "profileImage": to_web_path(profile_image, site_root) if profile_image else None,
                "heroImage": to_web_path(hero_image, site_root) if hero_image else None,
                "heroVideo": to_web_path(hero_video, site_root) if hero_video else None,
                "videos": [to_web_path(video_path, site_root) for video_path in video_paths],
                "items": items,
            }
        )

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "site": site,
        "months": manifest_months,
    }

    output_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"Updated {output_path}")


if __name__ == "__main__":
    main()
