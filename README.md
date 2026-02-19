# Udemy Subtitle Downloader

A Tampermonkey/Greasemonkey userscript that automatically captures and downloads subtitle files (.vtt) from Udemy courses.

## Features

- **Auto-Capture Mode**: Automatically navigates through all course lectures and captures subtitles
- **Manual Capture**: Subtitles are captured as you browse through lectures
- **Organized ZIP Download**: Downloads all captured subtitles in a ZIP file organized by sections
- **Clean VTT Files**: Removes thumbnail sprite references from subtitle files
- **Multi-language Section Names**: Normalizes section names (Turkish, Spanish, Portuguese, German, Japanese, Korean, Russian) to English
- **Detailed Report**: Generates a report.txt with captured files, skipped videos, and any errors
- **Modern UI**: Clean, dark-themed floating panel that doesn't interfere with video playback

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari) or [Greasemonkey](https://www.greasespot.net/) (Firefox)
2. Click the install link below or create a new script and paste the code

[![Install](https://img.shields.io/badge/Install-Userscript-green)](https://greasyfork.org/scripts/566493-udemy-subtitle-downloader)

## Usage

1. Navigate to any Udemy course lecture page
2. A floating panel will appear in the bottom-right corner
3. Choose your capture method:

### Auto-Capture (Recommended)
- Click **"Start Auto-Capture"** to automatically go through all lectures
- The script will expand each section, click each video, and wait for subtitles to load
- Progress is shown in the status area
- Click **"Stop Capture"** anytime to pause

### Manual Capture
- Simply navigate through lectures manually
- Subtitles are automatically captured as each video loads
- The counter shows how many subtitles have been collected

### Download
- Click **"Download ZIP"** to download all captured subtitles
- Files are organized in folders by section name
- A `report.txt` is included with:
  - List of all captured files
  - Any skipped videos (no subtitle detected)
  - Any failed downloads (403 errors)

### Clear
- Click **"Clear All"** to remove all captured subtitles and start fresh

## Notes

- Subtitles must be enabled on the video for capture to work
- Some videos may not have subtitles available
- If you get 403 errors during download, your session may have expired - clear and recapture
- The script only captures actual subtitle files, not thumbnail sprites

## Compatibility

- Works with Udemy's current (2024-2025) video player
- Tested on Chrome, Firefox, and Edge with Tampermonkey

## Author

**oaslan**

## License

MIT License - Feel free to modify and distribute.

## Changelog

### v1.0
- Initial release
- Auto-capture functionality
- ZIP download with section folders
- Verified skip detection in reports
- Clean, modern UI
