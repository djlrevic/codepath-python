import ast

def hasLocationInformation(node: ast.AST):
    if getattr(node, "lineno", False):
        return True
    return False


class PrintNestedLocationAtCaretVisitor(ast.NodeVisitor):
    def __init__(self, line, col):
        self.loc = (line, col)

    def isOfInterest(self, node):
        return (not hasLocationInformation(node) or self.cursorEnclosedByNode(node))

    # most nodes in the program tree have line and column start/end locations.
    # We check if the given (line, col) is inside a particular node.
    # (i.e a `while` loop node can span multiple lines, and this would
    # check if the cursor is anywhere inside of it)
    def cursorEnclosedByNode(self, node):
        line, col = self.loc
        if isinstance(node, list):
            for item in node:
                r = self.cursorEnclosedByNode(item)
                if r:
                    return True
            return False

        inside = line >= node.lineno and line <= node.end_lineno
        if (inside and node.lineno == node.end_lineno):
            inside = col >= node.col_offset and col <= node.end_col_offset
        return inside

    # Recurse into the AST, only returning text from nodes that are enclosed by the cursor.
    # We modify text returned from nodes of interest for formatting, i.e. in visit_Dict 
    # to print a selection of nested dict values as `example_dict["key1"]["keyC"] = someValue`
    def visit(self, node):
        """Visit a node."""
        method = 'visit_' + node.__class__.__name__
        # default to generic visitor, unless e.g. visit_Assign exists, as it does below.
        visitor = getattr(self, method, self.generic_visit) 
        #print(f"Visiting {method}.")
        result = visitor(node)
        if result: return result


    def generic_visit(self, node):
        """Modified to recurse into nodes of interest, and propagate the first string returned."""
        for field, value in ast.iter_fields(node):
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, ast.AST) and self.isOfInterest(node):
                        result = self.visit(item)
                        if result:
                            return result
            elif isinstance(value, ast.AST) and self.isOfInterest(node):
                result = self.visit(value)
                if result:
                    return result
        
        return False

    def visit_Assign(self, node):
        #print("ASSIGN: " + " ".join([name.id for name in node.targets]))
        assert (len(node.targets) == 1), "Multiple assignment not supported"

        if isinstance(node.value, ast.Dict):
            return node.targets[0].id + str(self.visit(node.value))
        else:
            return node.targets[0].id + " = " + str(self.visit(node.value))

    def visit_Dict(self, node):
        #print(f"In dict, {node._fields}, {node._attributes}, line {node.lineno}")
        for key, value in zip(node.keys, node.values):
            if self.cursorEnclosedByNode(key):
                return f"[\"{self.visit(key)}\"]"

            if self.cursorEnclosedByNode(value):
                if isinstance(value, ast.Dict):
                    return f"[\"{key.value}\"]{self.visit(value)}"
                else:
                    return f"[\"{key.value}\"] = {self.visit(value)}"
            
            if self.cursorEnclosedByNode(value): 
                return f"[\"{key.value}\"] = {self.visit(value)}"
    
    def visit_Constant(self, node):
        #print(f"In dict, {node._fields}, {node._attributes}, line {node.lineno}")
        if self.cursorEnclosedByNode(node):
            return f"{node.value}"
        return False


    def visit_JoinedStr(self, node):
        # An f-string, comprising a series of FormattedValue and Constant nodes.
        # We want to add it as it appears in code.
        if self.cursorEnclosedByNode(node):
            return ast.unparse(node) # gives a string representation of the fstring code that made the node
        return self.generic_visit(node)

    def visit_FormattedValue(self, node):
        if self.cursorEnclosedByNode(node):
            return ast.unparse(node)
        return self.generic_visit(node)
