import { readFileSync } from 'fs';
import { argv } from 'process';

const args = argv.slice(2);
const data = readFileSync(args[0], 'utf8');

let stack = [];
var tag = '';
var inStartTag = false;
var inEndTag = false;
var inTag = false;
var line = 1;

for (let i = 0; i < data.length; i++) {
    const c = data[i];
    if (line == args[1]) break;

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
                if (inStartTag) stack.push([tag, line]);
                else if (inEndTag) stack.pop();
            }
            tag = '';
            inStartTag = false;
            inEndTag = false;
            break;
        case '\n':
            line++;
            break;
        default:
            if (inStartTag && c == ' ') inTag = false;
            else if (inStartTag && inTag) tag += c;
    }
}

console.log(stack);
