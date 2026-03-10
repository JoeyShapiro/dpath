import { close, openSync, readSync } from 'fs';

export function DeepPath(filename: string, filetype: string, line: number, column: number, tab_size: number = 4, size: number = 1_048_576): Array<[string, number]> {
    if (filetype == 'xml') {
        return XmlTag(filename, line, column, tab_size, size);
    }

    throw new Error(`Unsupported file type: ${filetype}`);
}

export function XmlTag(filename: string, line: number, column: number, tab_size: number = 4, size: number = 1_048_576): Array<[string, number]> {
    // TODO store list of whole thing
    // TODO could do wasm, but its already so fast, i doubt it would help. might even be slower
    let stack: Array<[string, number]> = [];
    var tag = '';
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
                        stack.push(['!--', curline]);
                        inStartTag = false;
                        inEndTag = false;
                        inTagName = false;

                        break;
                    }
                    if (nc == '/') inEndTag = true;
                    else {
                        inStartTag = true;
                        inTagName = true;
                        tag = '';
                    }
                    break;
                case '>':
                    if (comment) {
                        // XML comments only end with "-->". Ignore standalone '>' inside comments.
                        // TODO the stack check is dangerous
                        if (prevPrevChar == '-' && prevChar == '-' && stack.length > 0 && stack[stack.length - 1][0] == '!--') {
                            stack.pop();
                            comment = false;
                            break;
                        }
                    }

                    if (inEndTag || String.fromCharCode(data[i - 1]) == '/') {
                        stack.pop();
                    } else if (inStartTag && inTagName) {
                        stack.push([tag, curline]);
                    }

                    tag = '';
                    inTagName = false;
                    inStartTag = false;
                    inEndTag = false;
                    break;
                case '\n':
                    if (inStartTag && tag) {
                        stack.push([tag, curline]);
                        tag = '';
                        inTagName = false;
                    }
                    curline++;
                    curcol = 1;
                    break;
                case ' ':
                    if (inStartTag && tag) {
                        stack.push([tag, curline]);
                        tag = '';
                        inTagName = false;
                    }
                    break;
                case '/':
                    if (inStartTag && tag) {
                        stack.push([tag, curline]);
                        tag = '';
                        inTagName = false;
                    }
                    break;
                default:
                    if (c === '\t') curcol += tab_size - 1; // even though tab is one character, it visually takes up multiple spaces
                    if (inStartTag && inTagName && !comment) tag += c;
            }

            prevPrevChar = prevChar;
            prevChar = c;
        }

        n = readSync(f, data, 0, data.length, null);
    }

    close(f);

    return stack;
}
