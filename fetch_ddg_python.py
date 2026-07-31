import re
import urllib.parse
import time
from duckduckgo_search import DDGS

def get_image(query):
    try:
        with DDGS() as ddgs:
            results = list(ddgs.images(
                keywords=query,
                region="wt-wt",
                safesearch="moderate",
                max_results=1
            ))
            if results:
                return results[0]['image']
    except Exception as e:
        print(f"Error fetching {query}: {e}")
    return None

def main():
    html_path = 'ui/index.html'
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # We match "https://placehold.co/400x400/FFF/000?text=BRAND"
    # Note: in JS it's inside double quotes `"https://placehold.co/..."`
    pattern = r'"https://placehold\.co/400x400/FFF/000\?text=([^"]+)"'
    
    matches = list(re.finditer(pattern, html))
    print(f"Found {len(matches)} placeholder images to replace.")
    
    new_html = html
    replaced = 0
    
    for match in matches:
        full_match = match.group(0)
        brand_encoded = match.group(1)
        brand = urllib.parse.unquote(brand_encoded)
        
        print(f"Searching for: {brand}")
        img_url = get_image(f"{brand} product packaging")
        if img_url:
            print(f"  Found: {img_url}")
            new_html = new_html.replace(full_match, f'"{img_url}"')
            replaced += 1
        else:
            print(f"  Not found for: {brand}")
            
        time.sleep(1) # prevent rate limiting
        
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(new_html)
        
    print(f"Successfully replaced {replaced} images.")

if __name__ == "__main__":
    main()
