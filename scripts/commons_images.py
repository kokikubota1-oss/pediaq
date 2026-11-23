"""Find clearly licensed Wikimedia Commons images for PediaQ options.

An image is only attached when four separate compatible, attributed photos
are available. Retrieval does not prove medical correctness or pedagogical fit.
"""
import html
import json
import re
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
AGENT = "PediaQ-Education/0.8 (https://github.com/kokikubota1-oss/pediaq; educational image search)"
LICENSES = ("CC0", "PUBLIC DOMAIN", "CC BY ", "CC BY-SA ", "CC-BY-", "CC-BY-SA-")

def plain(s):
    return re.sub(r"\\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", s or ""))).strip()[:350]

def query_commons(search, used):
    params = {
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": search + " filetype:bitmap",
        "gsrnamespace": "6", "gsrlimit": "12",
        "prop": "imageinfo", "iiprop": "url|extmetadata",
        "iiurlwidth": "650",
    }
    uri = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(uri, headers={"User-Agent": AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=18) as resp:
        data = json.load(resp)
    pages = sorted(data.get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 999))
    for page in pages:
        if page.get("title") in used or not page.get("imageinfo"):
            continue
        meta = page["imageinfo"][0]
        fields = meta.get("extmetadata") or {}
        v = lambda key: (fields.get(key) or {}).get("value", "")
        license_name = plain(v("LicenseShortName")).upper()
        if not any(license_name == x or license_name.startswith(x) for x in LICENSES):
            continue
        if "NC" in license_name or "ND" in license_name:
            continue
        image_url = meta.get("thumburl")
        if not image_url or not image_url.startswith("https://"):
            continue
        used.add(page["title"])
        return {
            "url": image_url,
            "source": meta.get("descriptionurl", ""),
            "title": page["title"],
            "license": plain(v("LicenseShortName")),
            "license_url": plain(v("LicenseUrl")),
            "creator": plain(v("Artist")) or "See source",
            "provider": "Wikimedia Commons",
        }
    return None

def find_option_images(q):
    used = set()
    found = []
    for option in q["options"]:
        term = option["en"]
        if len(term) > 80:
            term = term[:80].rsplit(" ", 1)[0]
        try:
            image = query_commons(term, used)
        except (OSError, ValueError, KeyError) as error:
            print("Commons search unavailable:", repr(error))
            return None
        if image is None:
            return None
        found.append(image)
    return found
