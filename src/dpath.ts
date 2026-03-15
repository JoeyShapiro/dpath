import { close, openSync, readSync } from 'fs';

type NamespaceContext = {
    defaultNamespace: string;
    prefixMappings: Record<string, string>;
};

function parseNamespaceDeclarations(startTagText: string): Map<string, string> {
    const declarations = new Map<string, string>();
    const namespaceRegex = /xmlns(?::([A-Za-z_][\w.-]*))?\s*=\s*("([^"]*)"|'([^']*)')/g;
    let match: RegExpExecArray | null;

    while ((match = namespaceRegex.exec(startTagText)) !== null) {
        const prefix = match[1] ?? '';
        const value = match[3] ?? match[4] ?? '';
        declarations.set(prefix, value);
    }

    return declarations;
}

function applyNamespaceDeclarations(parentContext: NamespaceContext, declarations: Map<string, string>): NamespaceContext {
    const nextContext: NamespaceContext = {
        defaultNamespace: parentContext.defaultNamespace,
        prefixMappings: { ...parentContext.prefixMappings },
    };

    for (const [prefix, uri] of declarations) {
        if (prefix === '') nextContext.defaultNamespace = uri;
        else nextContext.prefixMappings[prefix] = uri;
    }

    return nextContext;
}

function resolveNamespaceForTag(tagName: string, context: NamespaceContext): string {
    const splitIndex = tagName.indexOf(':');
    if (splitIndex !== -1) {
        const prefix = tagName.slice(0, splitIndex);
        return context.prefixMappings[prefix] ?? '';
    }

    return context.defaultNamespace;
}

export class Tag {
    public name: string = '';
    public line: number = 0;
    public namespace: string = '';

    constructor(name: string, line: number, namespace: string) {
        this.name = name;
        this.line = line;
        this.namespace = namespace;
    }
}

export function DeepPath(filename: string, filetype: string, line: number, column: number, tab_size: number = 4, size: number = 1_048_576): Array<Tag> {
    if (filetype == 'xml') {
        return XmlTag(filename, line, column, tab_size, size);
    }

    throw new Error(`Unsupported file type: ${filetype}`);
}

export function XmlTag(filename: string, line: number, column: number, tab_size: number = 4, size: number = 1_048_576): Array<Tag> {
    // TODO could do wasm, but its already so fast, i doubt it would help. might even be slower
    let stack: Array<Tag> = [];
    const namespaceStack: Array<NamespaceContext> = [{ defaultNamespace: '', prefixMappings: {} }];
    var tag = '';
    var startTagText = '';
    var startTagWasPushed = false;
    var inStartTag = false;
    var inEndTag = false;
    var inTagName = false;
    var curline = 1;
    var curcol = 1;
    var comment = false;
    var prevChar = '';
    var prevPrevChar = '';

    var data = Buffer.alloc(size);
    const f = openSync(filename, 'r');
    var n = readSync(f, data, 0, data.length, null);

    while (n > 0) {
        if (curline >= line && curcol >= column && !inTagName) break;

        for (let i = 0; i < n; i++) {
            // -_- String(60) == '60' not '<'
            const c = String.fromCharCode(data[i]);
            if (curline >= line && curcol >= column && !inTagName) break;
            curcol++;

            switch (c) {
                case '<':
                    const nc = String.fromCharCode(data[i + 1]);
                    if (nc == '?') break;
                    if (nc == '!') { // TODO are others possible
                        comment = true;
                        i+=2; // skip "!--"
                        curcol+=2;
                        stack.push(new Tag('!--', curline, ''));
                        inStartTag = false;
                        inEndTag = false;
                        inTagName = false;

                        break;
                    }
                    if (nc == '/') inEndTag = true;
                    else {
                        inStartTag = true;
                        inTagName = true;
                        startTagWasPushed = false;
                        startTagText = '';
                        tag = '';
                    }
                    break;
                case '>':
                    if (comment) {
                        // XML comments only end with "-->". Ignore standalone '>' inside comments.
                        // TODO the stack check is dangerous
                        if (prevPrevChar == '-' && prevChar == '-' && stack.length > 0 && stack[stack.length - 1].name == '!--') {
                            stack.pop();
                            comment = false;
                            break;
                        }
                    }

                    const isSelfClosing = String.fromCharCode(data[i - 1]) == '/';

                    if (inEndTag) {
                        stack.pop();

                        // End tags close the namespace scope of their matching start tags.
                        if (namespaceStack.length > 1) namespaceStack.pop();
                    } else if (inStartTag) {
                        if (inTagName && tag) {
                            stack.push(new Tag(tag, curline, ''));
                            startTagWasPushed = true;
                        }

                        // i dont like how this does this at this character. but it is smart
                        if (startTagWasPushed && stack.length > 0) {
                            const declarations = parseNamespaceDeclarations(startTagText);
                            const parentContext = namespaceStack[namespaceStack.length - 1];
                            const currentContext = applyNamespaceDeclarations(parentContext, declarations);

                            stack[stack.length - 1].namespace = resolveNamespaceForTag(stack[stack.length - 1].name, currentContext);
                            namespaceStack.push(currentContext);

                            if (isSelfClosing) {
                                stack.pop();
                                if (namespaceStack.length > 1) namespaceStack.pop();
                            }
                        }
                    }

                    tag = '';
                    startTagText = '';
                    startTagWasPushed = false;
                    inTagName = false;
                    inStartTag = false;
                    inEndTag = false;
                    break;
                case '\n':
                    if (inStartTag && !inEndTag) startTagText += c;
                    if (inStartTag && tag) {
                        stack.push(new Tag(tag, curline, ''));
                        startTagWasPushed = true;
                        tag = '';
                        inTagName = false;
                    }
                    curline++;
                    curcol = 1;
                    break;
                case ' ':
                    if (inStartTag && !inEndTag) startTagText += c;
                    if (inStartTag && tag) {
                        stack.push(new Tag(tag, curline, ''));
                        startTagWasPushed = true;
                        tag = '';
                        inTagName = false;
                    }
                    break;
                case '/':
                    if (inStartTag && !inEndTag) startTagText += c;
                    if (inStartTag && tag) {
                        stack.push(new Tag(tag, curline, ''));
                        tag = '';
                        inTagName = false;

                        // special case if the cursor is on in a self-closing tag
                        // we shouldnt care about a self-closing tag's namespaces. They wont be used for long
                        if (stack.length > 0 && curline >= line && curcol >= column) {
                            const declarations = parseNamespaceDeclarations(startTagText);
                            const parentContext = namespaceStack[namespaceStack.length - 1];
                            const currentContext = applyNamespaceDeclarations(parentContext, declarations);

                            stack[stack.length - 1].namespace = resolveNamespaceForTag(stack[stack.length - 1].name, currentContext);
                            namespaceStack.push(currentContext);
                        }
                    }
                    break;
                default:
                    if (inStartTag && !inEndTag) startTagText += c;
                    if (c === '\t') curcol += tab_size - 1; // even though tab is one character, it visually takes up multiple spaces
                    if (inStartTag && inTagName) tag += c;
            }

            prevPrevChar = prevChar;
            prevChar = c;
        }

        n = readSync(f, data, 0, data.length, null);
    }

    close(f);

    return stack;
}
