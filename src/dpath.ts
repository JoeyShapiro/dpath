import { close, openSync, readSync } from 'fs';

export function DeepPath(filename: string, filetype: string, line: number, column: number, size: number = 1_048_576): Array<[string, number]> {
    if (filetype == 'xml') {
        return XmlTag(filename, line, column, size);
    }

    throw new Error(`Unsupported file type: ${filetype}`);
}

export function XmlTag(filename: string, line: number, column: number, size: number = 1_048_576): Array<[string, number]> {
    // TODO store list of whole thing
    // TODO could do wasm, but its already so fast, i doubt it would help. might even be slower
    let stack: Array<[string, number]> = [];
    var tag = '';
    var inStartTag = false;
    var inEndTag = false;
    var inTagName = false;
    var curline = 1;
    var curcol = 0;
    var comment = false;
    var prevChar = '';
    var prevPrevChar = '';

    var data = Buffer.alloc(size);
    const f = openSync(filename, 'r');
    var n = readSync(f, data, 0, data.length, null);

    while (n > 0) {
        if (curline == line && curcol == column) break;

        for (let i = 0; i < n; i++) {
            // -_- String(60) == '60' not '<'
            const c = String.fromCharCode(data[i]);
            curcol++;
            if (curline == line && curcol == column) break;

            switch (c) {
                case '<':
                    curcol++;
                    const nc = String.fromCharCode(data[i + 1]);
                    if (nc == '?') break;
                    if (nc == '!') {
                        comment = true;
                        stack.push(['!--', curline]);
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
                        if (prevPrevChar == '-' && prevChar == '-' && stack.length > 0 && stack[stack.length - 1][0] == '!--') {
                            stack.pop();
                            comment = false;
                        }
                        break;
                    }

                    if ((inEndTag || String.fromCharCode(data[i - 1]) == '/') && curline != line) {
                        stack.pop();
                    } else if (inStartTag && inTagName && !comment) {
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
                    curcol = 0;
                    break;
                case ' ':
                    if (inStartTag && tag) {
                        stack.push([tag, curline]);
                        tag = '';
                        inTagName = false;
                    }
                    break;
                default:
                    if (inStartTag && inTagName && !comment) tag += c;
                    curcol++;
            }

            prevPrevChar = prevChar;
            prevChar = c;
        }

        n = readSync(f, data, 0, data.length, null);
    }

    close(f);

    return stack;
}
