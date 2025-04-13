import { close, openSync, readSync } from 'fs';

export function DeepPath(filename: string, filetype: string, line: number): Array<[string, number]> {
    if (filetype == 'xml') {
        return XmlTag(filename, line);
    }

    throw new Error(`Unsupported file type: ${filetype}`);
}

export function XmlTag(filename: string, line: number, size: number = 1_048_576): Array<[string, number]> {
    // TODO store list of whole thing
    // TODO could do wasm, but its already so fast, i doubt it would help. might even be slower
    let stack: Array<[string, number]> = [];
    var tag = '';
    var inStartTag = false;
    var inEndTag = false;
    var inTagName = false;
    var curline = 1;

    var data = Buffer.alloc(size);
    const f = openSync(filename, 'r');
    var n = readSync(f, data, 0, data.length, null);

    while (n > 0) {
        if (curline == line + 1) break;

        for (let i = 0; i < n; i++) {
            // -_- String(60) == '60' not '<'
            const c = String.fromCharCode(data[i]);
            if (curline == line + 1) break;

            switch (c) {
                case '<':
                    const nc = String.fromCharCode(data[i + 1]);
                    if (nc == '?') break;
                    if (nc == '/') inEndTag = true;
                    else {
                        inStartTag = true;
                        inTagName = true;
                    }
                    break;
                case '>':
                    if ((inEndTag || String.fromCharCode(data[i - 1]) == '/') && curline != line) {
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
                    break;
                case ' ':
                    if (inStartTag && tag) {
                        stack.push([tag, curline]);
                        tag = '';
                        inTagName = false;
                    }
                    break;
                default:
                    if (inStartTag && inTagName) tag += c;
            }
        }

        n = readSync(f, data, 0, data.length, null);
    }

    close(f);

    return stack;
}
