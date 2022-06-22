import argparse
import ast
import sys
from visitor import PrintNestedLocationAtCaretVisitor

parser = argparse.ArgumentParser(
    description="Give the nested 'path' to the dict at a given row/col. If no filename is given, will read from stdin")
parser.add_argument('infile', nargs='?', type=str, default="")
parser.add_argument('row', type=int)
parser.add_argument('col', type=int)

args = parser.parse_args()

if (not args.infile):
    pythonProgramText = sys.stdin.read()
else:
    with open(args.infile) as f:
        pythonProgramText = f.read()

# print("Parsing")
tree = ast.parse(pythonProgramText)
#print(ast.dump(tree, indent=4))
visitor = PrintNestedLocationAtCaretVisitor(args.row, args.col)
result = visitor.visit(tree)
# print("Results:")
print(result) # this stdout gets read by the extension
quit()
