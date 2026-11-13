"""Print the API's OpenAPI schema as JSON, without starting a server.

Usage (from `backend/`): python -m scripts.export_openapi > ../frontend/openapi.json
"""

import json
import sys

from app.main import app

json.dump(app.openapi(), sys.stdout, indent=2, sort_keys=True)
sys.stdout.write("\n")
