import { readFileSync } from 'fs';

export function DeepPath(filename: string, filetype: string, line: number): Array<[string, number]> {
    if (filetype == 'xml') {
        return XmlTag(filename, line);
    }

    throw new Error(`Unsupported file type: ${filetype}`);
}

export function XmlTag(filename: string, line: number): Array<[string, number]> {
    let stack: Array<[string, number]> = [];
    var tag = '';
    var inStartTag = false;
    var inEndTag = false;
    var inTag = false;
    var curline = 1;

    const data = readFileSync(filename, 'utf8');
    
    for (let i = 0; i < data.length; i++) {
        const c = data[i];
        if (curline == line) break;
    
        switch (c) {
            case '<':
                if (data[i + 1] == '?') break;
                if (data[i + 1] == '/') inEndTag = true;
                else {
                    inStartTag = true;
                    inTag = true;
                }
                break;
            case '>':
                if (data[i - 1] != '/') {
                    if (inStartTag) stack.push([tag, curline]);
                    else if (inEndTag) stack.pop();
                }
                tag = '';
                inStartTag = false;
                inEndTag = false;
                break;
            case '\n':
                curline++;
                break;
            default:
                if (inStartTag && c == ' ') inTag = false;
                else if (inStartTag && inTag) tag += c;
        }
    }

    return stack;
}
