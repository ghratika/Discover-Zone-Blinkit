import urllib.request
import re

html = urllib.request.urlopen('https://images.search.yahoo.com/search/images?p=Daawat+Basmati+Rice').read().decode('utf-8')
print("IMGS:", re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html)[:10])
