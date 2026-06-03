import os, sys
os.chdir('/Users/fiatte/Documents/GitHub/divimo')
from http.server import HTTPServer, SimpleHTTPRequestHandler
HTTPServer(('', 3456), SimpleHTTPRequestHandler).serve_forever()
