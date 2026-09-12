import os
import sys

# Ensure project root is in sys.path so server and main modules are resolvable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import app
