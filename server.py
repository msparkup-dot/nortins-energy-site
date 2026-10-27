"""Servidor HTTP simples com fallback para .html — uso local apenas."""
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

class HTMLFallbackHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.translate_path(self.path)
        # Se o caminho não existe mas existe um .html correspondente, serve o .html
        if not os.path.exists(path) and not path.endswith('/'):
            html_path = path + '.html'
            if os.path.isfile(html_path):
                self.path = self.path + '.html'
        return super().do_GET()

if __name__ == '__main__':
    port = 4173
    server = HTTPServer(('0.0.0.0', port), HTMLFallbackHandler)
    print(f'Servindo em http://localhost:{port}/ (fallback .html ativo)')
    server.serve_forever()