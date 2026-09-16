# Vercel serverless entry point.
# Vercel looks for a callable named `app` in api/index.py and wraps it as a
# serverless function.  We simply re-export the FastAPI application object.

from app.main import app  # noqa: F401  (Vercel picks this up automatically)
