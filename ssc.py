import sys
import os

if len(sys.argv) == 1:
   print("\nUsage: \n\n   ssc path/to/script.simple\n\nFor node.js support, run \n\n   ssc path/to/script.simple nodejs\n")
   sys.exit(1)

if len(sys.argv) > 2:
   if sys.argv[1] == "nodejs":
      os.system(f"node simplescript.js build {sys.argv[1]} --nodejs")
      sys.exit(1)

os.system(f"node simplescript.js build {sys.argv[1]}")