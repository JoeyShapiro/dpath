import { readFileSync } from 'fs';

export function XmlTag(filename: string, line: number) {
    let stack = [];
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
