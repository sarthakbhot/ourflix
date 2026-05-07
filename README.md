# NETFLIXX

This is the gift site.

## How To See It

Open [preview.command](/Users/sarthakbhot/Documents/Athabasca%20University/ChatGPT/ourflix/preview.command:1)

Or from Terminal inside `ourflix` run:

```bash
python3 scripts/generate_manifest.py
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## How To Add Pictures

Put your images inside these folders:

- `media/month-1/images`
- `media/month-3/images`
- `media/month-6/images`

Put your videos inside these folders:

- `media/month-1/videos`
- `media/month-3/videos`
- `media/month-6/videos`

Then run [sync_media.command](/Users/sarthakbhot/Documents/Athabasca%20University/ChatGPT/ourflix/sync_media.command:1)

That refreshes the site data automatically.

## Important Naming Tips

- If you want a month's profile picture, name one image `profile.jpg` or `profile.png`.
- If you want the big top image, name one image `hero.jpg` or `cover.jpg`.
- If you want the top trailer video, name one video `trailer.mp4` or `hero.mov`.
- Any other images become gallery cards.
- The site will show however many gallery pictures you add for that month.
- If an image and video have similar names like `date-night.jpg` and `date-night.mp4`, that card will try to use that matching video first.

## Best Format To Send Me

If you want me to swap in your real memories next, the easiest format is:

- `JPG` or `PNG` for photos
- `MP4` or `MOV` for videos
- One portrait-ish image per month for the profile card
- One landscape image or video per month for the big top hero
- 4 to 8 extra photos per month for the gallery row

If you want to do only `First Month` right now, send just these:

- `month-1 profile.jpg`
- `month-1 hero.jpg` or `month-1 hero.mp4`
- `month-1 01.jpg`
- `month-1 02.jpg`
- `month-1 03.jpg`
- Optional: `month-1 04.jpg` to `month-1 06.jpg`

If you are sending them directly in chat, label them like this:

- `month-1 profile`
- `month-1 hero`
- `month-1 01`, `month-1 02`, `month-1 03`
- `month-3 profile`
- `month-6 profile`

If you want custom notes under each picture, send a short line for each one in this format:

- `month-1 01: our first really cute dinner`
- `month-3 02: the day she looked unreal`
- `month-6 hero: the softest video ever`

## Personalize The Words

Edit [data/config.json](/Users/sarthakbhot/Documents/Athabasca%20University/ChatGPT/ourflix/data/config.json:1) if you want to change:

- the site title
- month names
- month descriptions
- mood/status text

## Share It Later

This is a static website, so once you like it you can upload the `ourflix` folder to a host like Netlify, Vercel, or GitHub Pages and send her that link.
